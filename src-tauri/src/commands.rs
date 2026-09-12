//! Tauri command surface. This is the ONLY boundary between the frontend
//! and the vault: the frontend never sees the master password after this
//! call returns, never sees the derived key, and only ever receives
//! plaintext secret values from explicit `reveal_*` / `*_secrets` calls the
//! user triggered (Reveal / Copy / Export). Nothing here is logged.

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::crypto;
use crate::db::DbState;
use crate::models::*;
use crate::vault_state::{enforce_autolock, touch, VaultState};

fn now() -> String {
    Utc::now().to_rfc3339()
}

// ---------------------------------------------------------------------
// Vault lifecycle
// ---------------------------------------------------------------------

#[tauri::command]
pub fn vault_status(db: State<DbState>, vault: State<VaultState>) -> VaultStatus {
    enforce_autolock(&vault);
    let conn = db.0.lock().unwrap();
    let initialized: bool = conn
        .query_row("SELECT COUNT(*) FROM vault_config WHERE id = 1", [], |r| {
            r.get::<_, i64>(0)
        })
        .map(|c| c > 0)
        .unwrap_or(false);
    let auto_lock_minutes: i64 = conn
        .query_row(
            "SELECT auto_lock_minutes FROM vault_config WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or(15);
    let rt = vault.0.lock().unwrap();
    VaultStatus {
        initialized,
        unlocked: rt.key.is_some(),
        auto_lock_minutes,
    }
}

#[tauri::command]
pub fn vault_create(
    db: State<DbState>,
    vault: State<VaultState>,
    master_password: String,
) -> Result<(), String> {
    if master_password.len() < 8 {
        return Err("Master password must be at least 8 characters.".into());
    }
    let conn = db.0.lock().unwrap();
    let already: bool = conn
        .query_row("SELECT COUNT(*) FROM vault_config WHERE id = 1", [], |r| {
            r.get::<_, i64>(0)
        })
        .map(|c| c > 0)
        .unwrap_or(false);
    if already {
        return Err("Vault already initialized.".into());
    }

    let salt = crypto::generate_raw_salt();
    let key = crypto::derive_key(&master_password, &salt).map_err(|e| e.to_string())?;
    let (verifier_ct, verifier_nonce) = crypto::make_verifier(&key).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO vault_config (id, salt, verifier_ciphertext, verifier_nonce, auto_lock_minutes, created_at) VALUES (1, ?1, ?2, ?3, 15, ?4)",
        params![salt, verifier_ct, verifier_nonce, now()],
    )
    .map_err(|e| e.to_string())?;

    let mut rt = vault.0.lock().unwrap();
    rt.key = Some(key);
    rt.last_activity = std::time::Instant::now();
    rt.auto_lock_minutes = 15;
    Ok(())
}

#[tauri::command]
pub fn vault_unlock(
    db: State<DbState>,
    vault: State<VaultState>,
    master_password: String,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    let row = conn
        .query_row(
            "SELECT salt, verifier_ciphertext, verifier_nonce, auto_lock_minutes FROM vault_config WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (salt, verifier_ct, verifier_nonce, auto_lock_minutes) =
        row.ok_or_else(|| "Vault has not been created yet.".to_string())?;

    let key = crypto::derive_key(&master_password, &salt).map_err(|e| e.to_string())?;
    if !crypto::check_verifier(&key, &verifier_ct, &verifier_nonce) {
        return Err("Incorrect master password.".into());
    }

    let mut rt = vault.0.lock().unwrap();
    rt.key = Some(key);
    rt.last_activity = std::time::Instant::now();
    rt.auto_lock_minutes = auto_lock_minutes;
    Ok(())
}

#[tauri::command]
pub fn vault_lock(vault: State<VaultState>) {
    let mut rt = vault.0.lock().unwrap();
    rt.key = None;
}

#[tauri::command]
pub fn vault_touch_activity(vault: State<VaultState>) {
    touch(&vault);
}

#[tauri::command]
pub fn vault_set_auto_lock(
    db: State<DbState>,
    vault: State<VaultState>,
    minutes: i64,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE vault_config SET auto_lock_minutes = ?1 WHERE id = 1",
        params![minutes],
    )
    .map_err(|e| e.to_string())?;
    let mut rt = vault.0.lock().unwrap();
    rt.auto_lock_minutes = minutes;
    Ok(())
}

#[tauri::command]
pub fn vault_change_master_password(
    db: State<DbState>,
    vault: State<VaultState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 8 {
        return Err("New master password must be at least 8 characters.".into());
    }
    let conn = db.0.lock().unwrap();
    let (salt, verifier_ct, verifier_nonce): (String, String, String) = conn
        .query_row(
            "SELECT salt, verifier_ciphertext, verifier_nonce FROM vault_config WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|_| "Vault not initialized.".to_string())?;

    let old_key = crypto::derive_key(&current_password, &salt).map_err(|e| e.to_string())?;
    if !crypto::check_verifier(&old_key, &verifier_ct, &verifier_nonce) {
        return Err("Current master password is incorrect.".into());
    }

    let new_salt = crypto::generate_raw_salt();
    let new_key = crypto::derive_key(&new_password, &new_salt).map_err(|e| e.to_string())?;

    // Re-encrypt every secret/password/database field under the new key.
    reencrypt_all(&conn, &old_key, &new_key).map_err(|e| e.to_string())?;

    let (new_verifier_ct, new_verifier_nonce) =
        crypto::make_verifier(&new_key).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE vault_config SET salt = ?1, verifier_ciphertext = ?2, verifier_nonce = ?3 WHERE id = 1",
        params![new_salt, new_verifier_ct, new_verifier_nonce],
    )
    .map_err(|e| e.to_string())?;

    let mut rt = vault.0.lock().unwrap();
    rt.key = Some(new_key);
    rt.last_activity = std::time::Instant::now();
    Ok(())
}

fn reencrypt_all(
    conn: &rusqlite::Connection,
    old_key: &[u8; crypto::KEY_LEN],
    new_key: &[u8; crypto::KEY_LEN],
) -> Result<(), String> {
    // secrets
    let mut stmt = conn
        .prepare("SELECT id, encrypted_value, nonce FROM secrets")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, String)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    for (id, ct, nonce) in rows {
        let plain = crypto::decrypt(old_key, &ct, &nonce).map_err(|e| e.to_string())?;
        let (new_ct, new_nonce) = crypto::encrypt(new_key, &plain).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE secrets SET encrypted_value = ?1, nonce = ?2 WHERE id = ?3",
            params![new_ct, new_nonce, id],
        )
        .map_err(|e| e.to_string())?;
    }

    // passwords
    let mut stmt = conn
        .prepare("SELECT id, encrypted_password, nonce FROM passwords")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, String)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    for (id, ct, nonce) in rows {
        let plain = crypto::decrypt(old_key, &ct, &nonce).map_err(|e| e.to_string())?;
        let (new_ct, new_nonce) = crypto::encrypt(new_key, &plain).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE passwords SET encrypted_password = ?1, nonce = ?2 WHERE id = ?3",
            params![new_ct, new_nonce, id],
        )
        .map_err(|e| e.to_string())?;
    }

    // databases (connection string + password, both optional)
    let mut stmt = conn
        .prepare("SELECT id, encrypted_connection_string, connection_string_nonce, encrypted_password, password_nonce FROM databases")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, Option<String>, Option<String>, Option<String>, Option<String>)> = stmt
        .query_map([], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    for (id, cs_ct, cs_nonce, pw_ct, pw_nonce) in rows {
        let mut new_cs: Option<(String, String)> = None;
        if let (Some(ct), Some(nonce)) = (cs_ct, cs_nonce) {
            let plain = crypto::decrypt(old_key, &ct, &nonce).map_err(|e| e.to_string())?;
            new_cs = Some(crypto::encrypt(new_key, &plain).map_err(|e| e.to_string())?);
        }
        let mut new_pw: Option<(String, String)> = None;
        if let (Some(ct), Some(nonce)) = (pw_ct, pw_nonce) {
            let plain = crypto::decrypt(old_key, &ct, &nonce).map_err(|e| e.to_string())?;
            new_pw = Some(crypto::encrypt(new_key, &plain).map_err(|e| e.to_string())?);
        }
        if let Some((ct, nonce)) = new_cs {
            conn.execute(
                "UPDATE databases SET encrypted_connection_string = ?1, connection_string_nonce = ?2 WHERE id = ?3",
                params![ct, nonce, id],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some((ct, nonce)) = new_pw {
            conn.execute(
                "UPDATE databases SET encrypted_password = ?1, password_nonce = ?2 WHERE id = ?3",
                params![ct, nonce, id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn get_key(vault: &State<VaultState>) -> Result<[u8; crypto::KEY_LEN], String> {
    enforce_autolock(vault);
    let rt = vault.0.lock().unwrap();
    match &rt.key {
        Some(k) => Ok(**k),
        None => Err("Vault is locked.".into()),
    }
}

// ---------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------

#[tauri::command]
pub fn secrets_list(db: State<DbState>, vault: State<VaultState>, project_id: Option<String>) -> Result<Vec<SecretRecord>, String> {
    enforce_autolock(&vault);
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, category, environment, notes, created_at, updated_at FROM secrets
             WHERE (?1 IS NULL OR project_id = ?1) ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |r| {
            Ok(SecretRecord {
                id: r.get(0)?,
                project_id: r.get(1)?,
                name: r.get(2)?,
                category: r.get(3)?,
                environment: r.get(4)?,
                notes: r.get(5)?,
                created_at: r.get(6)?,
                updated_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn secrets_create(db: State<DbState>, vault: State<VaultState>, input: NewSecret) -> Result<String, String> {
    let key = get_key(&vault)?;
    let (ct, nonce) = crypto::encrypt(&key, &input.value).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO secrets (id, project_id, name, category, environment, encrypted_value, nonce, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        params![id, input.project_id, input.name, input.category, input.environment, ct, nonce, input.notes, now()],
    )
    .map_err(|e| e.to_string())?;
    touch(&vault);
    Ok(id)
}

/// Bulk create — used by the .env importer.
#[tauri::command]
pub fn secrets_bulk_create(db: State<DbState>, vault: State<VaultState>, items: Vec<NewSecret>) -> Result<usize, String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    let mut count = 0usize;
    for input in items {
        let (ct, nonce) = crypto::encrypt(&key, &input.value).map_err(|e| e.to_string())?;
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO secrets (id, project_id, name, category, environment, encrypted_value, nonce, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            params![id, input.project_id, input.name, input.category, input.environment, ct, nonce, input.notes, now()],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }
    touch(&vault);
    Ok(count)
}

#[tauri::command]
pub fn secrets_update(db: State<DbState>, vault: State<VaultState>, input: UpdateSecret) -> Result<(), String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    if let Some(new_value) = input.new_value {
        let (ct, nonce) = crypto::encrypt(&key, &new_value).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE secrets SET name=?1, category=?2, environment=?3, notes=?4, encrypted_value=?5, nonce=?6, updated_at=?7 WHERE id=?8",
            params![input.name, input.category, input.environment, input.notes, ct, nonce, now(), input.id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE secrets SET name=?1, category=?2, environment=?3, notes=?4, updated_at=?5 WHERE id=?6",
            params![input.name, input.category, input.environment, input.notes, now(), input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    touch(&vault);
    Ok(())
}

#[tauri::command]
pub fn secrets_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM secrets WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn secrets_reveal(db: State<DbState>, vault: State<VaultState>, id: String) -> Result<String, String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    let (ct, nonce): (String, String) = conn
        .query_row("SELECT encrypted_value, nonce FROM secrets WHERE id = ?1", params![id], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(|_| "Secret not found.".to_string())?;
    touch(&vault);
    crypto::decrypt(&key, &ct, &nonce).map_err(|e| e.to_string())
}

/// Reveals every secret's plaintext for a project (or all), for .env export.
/// Only ever invoked by an explicit user "Export" action.
#[tauri::command]
pub fn secrets_export(db: State<DbState>, vault: State<VaultState>, project_id: Option<String>) -> Result<Vec<(String, String)>, String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT name, encrypted_value, nonce FROM secrets WHERE (?1 IS NULL OR project_id = ?1) ORDER BY name ASC")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, String)> = stmt
        .query_map(params![project_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    touch(&vault);
    let mut out = Vec::with_capacity(rows.len());
    for (name, ct, nonce) in rows {
        let value = crypto::decrypt(&key, &ct, &nonce).map_err(|e| e.to_string())?;
        out.push((name, value));
    }
    Ok(out)
}

// ---------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------

#[tauri::command]
pub fn passwords_list(db: State<DbState>, vault: State<VaultState>, project_id: Option<String>) -> Result<Vec<PasswordRecord>, String> {
    enforce_autolock(&vault);
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, username, website_url, environment, notes, created_at, updated_at FROM passwords
             WHERE (?1 IS NULL OR project_id = ?1) ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |r| {
            Ok(PasswordRecord {
                id: r.get(0)?,
                project_id: r.get(1)?,
                title: r.get(2)?,
                username: r.get(3)?,
                website_url: r.get(4)?,
                environment: r.get(5)?,
                notes: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn passwords_create(db: State<DbState>, vault: State<VaultState>, input: NewPassword) -> Result<String, String> {
    let key = get_key(&vault)?;
    let (ct, nonce) = crypto::encrypt(&key, &input.password).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO passwords (id, project_id, title, username, encrypted_password, nonce, website_url, environment, notes, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)",
        params![id, input.project_id, input.title, input.username, ct, nonce, input.website_url, input.environment, input.notes, now()],
    )
    .map_err(|e| e.to_string())?;
    touch(&vault);
    Ok(id)
}

#[tauri::command]
pub fn passwords_update(db: State<DbState>, vault: State<VaultState>, input: UpdatePassword) -> Result<(), String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    if let Some(new_password) = input.new_password {
        let (ct, nonce) = crypto::encrypt(&key, &new_password).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE passwords SET title=?1, username=?2, website_url=?3, environment=?4, notes=?5, encrypted_password=?6, nonce=?7, updated_at=?8 WHERE id=?9",
            params![input.title, input.username, input.website_url, input.environment, input.notes, ct, nonce, now(), input.id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE passwords SET title=?1, username=?2, website_url=?3, environment=?4, notes=?5, updated_at=?6 WHERE id=?7",
            params![input.title, input.username, input.website_url, input.environment, input.notes, now(), input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    touch(&vault);
    Ok(())
}

#[tauri::command]
pub fn passwords_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM passwords WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn passwords_reveal(db: State<DbState>, vault: State<VaultState>, id: String) -> Result<String, String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    let (ct, nonce): (String, String) = conn
        .query_row("SELECT encrypted_password, nonce FROM passwords WHERE id = ?1", params![id], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(|_| "Password not found.".to_string())?;
    touch(&vault);
    crypto::decrypt(&key, &ct, &nonce).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------
// Database credentials
// ---------------------------------------------------------------------

#[tauri::command]
pub fn databases_list(db: State<DbState>, vault: State<VaultState>, project_id: Option<String>) -> Result<Vec<DatabaseRecord>, String> {
    enforce_autolock(&vault);
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, provider, host, port, database_name, username, environment,
                    encrypted_connection_string, encrypted_password, created_at, updated_at
             FROM databases WHERE (?1 IS NULL OR project_id = ?1) ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |r| {
            let cs: Option<String> = r.get(9)?;
            let pw: Option<String> = r.get(10)?;
            Ok(DatabaseRecord {
                id: r.get(0)?,
                project_id: r.get(1)?,
                name: r.get(2)?,
                provider: r.get(3)?,
                host: r.get(4)?,
                port: r.get(5)?,
                database_name: r.get(6)?,
                username: r.get(7)?,
                environment: r.get(8)?,
                has_connection_string: cs.is_some(),
                has_password: pw.is_some(),
                created_at: r.get(11)?,
                updated_at: r.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn databases_create(db: State<DbState>, vault: State<VaultState>, input: NewDatabase) -> Result<String, String> {
    let key = get_key(&vault)?;
    let mut cs_ct: Option<String> = None;
    let mut cs_nonce: Option<String> = None;
    if let Some(v) = &input.connection_string {
        if !v.is_empty() {
            let (ct, nonce) = crypto::encrypt(&key, v).map_err(|e| e.to_string())?;
            cs_ct = Some(ct);
            cs_nonce = Some(nonce);
        }
    }
    let mut pw_ct: Option<String> = None;
    let mut pw_nonce: Option<String> = None;
    if let Some(v) = &input.password {
        if !v.is_empty() {
            let (ct, nonce) = crypto::encrypt(&key, v).map_err(|e| e.to_string())?;
            pw_ct = Some(ct);
            pw_nonce = Some(nonce);
        }
    }
    let id = Uuid::new_v4().to_string();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO databases (id, project_id, name, provider, host, port, database_name, username,
            encrypted_connection_string, connection_string_nonce, encrypted_password, password_nonce, environment, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)",
        params![id, input.project_id, input.name, input.provider, input.host, input.port, input.database_name, input.username,
            cs_ct, cs_nonce, pw_ct, pw_nonce, input.environment, now()],
    )
    .map_err(|e| e.to_string())?;
    touch(&vault);
    Ok(id)
}

#[tauri::command]
pub fn databases_update(db: State<DbState>, vault: State<VaultState>, input: UpdateDatabase) -> Result<(), String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE databases SET name=?1, provider=?2, host=?3, port=?4, database_name=?5, username=?6, environment=?7, updated_at=?8 WHERE id=?9",
        params![input.name, input.provider, input.host, input.port, input.database_name, input.username, input.environment, now(), input.id],
    )
    .map_err(|e| e.to_string())?;

    if let Some(v) = input.new_connection_string {
        let (ct, nonce) = crypto::encrypt(&key, &v).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE databases SET encrypted_connection_string=?1, connection_string_nonce=?2 WHERE id=?3",
            params![ct, nonce, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.new_password {
        let (ct, nonce) = crypto::encrypt(&key, &v).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE databases SET encrypted_password=?1, password_nonce=?2 WHERE id=?3",
            params![ct, nonce, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    touch(&vault);
    Ok(())
}

#[tauri::command]
pub fn databases_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM databases WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn databases_reveal(db: State<DbState>, vault: State<VaultState>, id: String) -> Result<DatabaseSecrets, String> {
    let key = get_key(&vault)?;
    let conn = db.0.lock().unwrap();
    let (cs_ct, cs_nonce, pw_ct, pw_nonce): (Option<String>, Option<String>, Option<String>, Option<String>) = conn
        .query_row(
            "SELECT encrypted_connection_string, connection_string_nonce, encrypted_password, password_nonce FROM databases WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|_| "Database credential not found.".to_string())?;
    touch(&vault);

    let connection_string = match (cs_ct, cs_nonce) {
        (Some(ct), Some(nonce)) => Some(crypto::decrypt(&key, &ct, &nonce).map_err(|e| e.to_string())?),
        _ => None,
    };
    let password = match (pw_ct, pw_nonce) {
        (Some(ct), Some(nonce)) => Some(crypto::decrypt(&key, &ct, &nonce).map_err(|e| e.to_string())?),
        _ => None,
    };
    Ok(DatabaseSecrets { connection_string, password })
}

// ---------------------------------------------------------------------
// Project mirror (for linking + "Migrate Existing Data")
// ---------------------------------------------------------------------

#[tauri::command]
pub fn projects_migrate(db: State<DbState>, projects: Vec<ProjectMigrate>) -> Result<usize, String> {
    let conn = db.0.lock().unwrap();
    let mut count = 0usize;
    for p in projects {
        conn.execute(
            "INSERT INTO projects (id, name, client, description, status, framework, backend, database_type, hosting, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, client=excluded.client, description=excluded.description,
                status=excluded.status, framework=excluded.framework, backend=excluded.backend,
                database_type=excluded.database_type, hosting=excluded.hosting, updated_at=excluded.updated_at",
            params![p.id, p.name, p.client, p.description, p.status, p.framework, p.backend, p.database_type, p.hosting, p.created_at, p.updated_at],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub fn app_data_dir(app: AppHandle) -> String {
    crate::db::db_path(&app).to_string_lossy().to_string()
}
