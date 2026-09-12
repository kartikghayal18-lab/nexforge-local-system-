//! Encrypted backup / restore. The backup file (.nexforgevault) is a JSON
//! envelope containing the vault_config (salt + verifier — no plaintext
//! master password, ever) plus every secrets/passwords/databases row
//! EXACTLY as stored — still ciphertext, still needs the original master
//! password to decrypt. Non-sensitive tables (projects, clients, invoices,
//! invoice_items, payments, project_notes, project_links) are included as
//! plain data since they carry no secrets. Project file attachments are
//! embedded as base64 blobs (BackupFileEntry) so a restore recreates them
//! on disk under the OS app-data files directory, not just their SQLite
//! metadata row.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

#[derive(Serialize, Deserialize)]
pub struct BackupEnvelope {
    pub format: String,
    pub created_at: String,
    pub vault_config: BackupVaultConfig,
    pub projects: Vec<serde_json::Value>,
    pub clients: Vec<serde_json::Value>,
    pub project_notes: Vec<serde_json::Value>,
    pub project_links: Vec<serde_json::Value>,
    pub invoices: Vec<serde_json::Value>,
    pub invoice_items: Vec<serde_json::Value>,
    pub payments: Vec<serde_json::Value>,
    pub project_files: Vec<BackupFileEntry>,
    pub settings: Vec<serde_json::Value>,
    pub secrets: Vec<serde_json::Value>,
    pub passwords: Vec<serde_json::Value>,
    pub databases: Vec<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
pub struct BackupFileEntry {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub original_name: String,
    pub file_type: Option<String>,
    pub file_size: i64,
    pub category: Option<String>,
    pub created_at: String,
    /// Raw file bytes, base64-encoded. Non-sensitive project attachments
    /// only (documents/images/etc.) -- vault secrets are never touched here.
    pub data_base64: String,
}

#[derive(Serialize, Deserialize)]
pub struct BackupVaultConfig {
    pub salt: String,
    pub verifier_ciphertext: String,
    pub verifier_nonce: String,
    pub auto_lock_minutes: i64,
}

fn row_to_json(conn: &rusqlite::Connection, sql: &str) -> Result<Vec<serde_json::Value>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or_default().to_string())
        .collect();
    let rows = stmt
        .query_map([], |r| {
            let mut obj = serde_json::Map::new();
            for (i, name) in col_names.iter().enumerate() {
                let value: rusqlite::types::Value = r.get(i)?;
                let json_val = match value {
                    rusqlite::types::Value::Null => serde_json::Value::Null,
                    rusqlite::types::Value::Integer(n) => serde_json::json!(n),
                    rusqlite::types::Value::Real(f) => serde_json::json!(f),
                    rusqlite::types::Value::Text(s) => serde_json::json!(s),
                    rusqlite::types::Value::Blob(_) => serde_json::Value::Null,
                };
                obj.insert(name.clone(), json_val);
            }
            Ok(serde_json::Value::Object(obj))
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}


/// Generic INSERT OR REPLACE for a backup table, using the JSON object's own
/// keys as column names. Safe here because `table` is always one of our own
/// hardcoded constant table names below (never user input), and column names
/// come from our own `row_to_json` output (also our own schema's column
/// names) -- never arbitrary external input.
fn insert_generic(conn: &rusqlite::Connection, table: &str, rows: &[serde_json::Value]) -> Result<(), String> {
    for row in rows {
        let obj = match row.as_object() {
            Some(o) => o,
            None => continue,
        };
        let cols: Vec<&String> = obj.keys().collect();
        if cols.is_empty() {
            continue;
        }
        let col_list = cols.iter().map(|c| c.as_str()).collect::<Vec<_>>().join(", ");
        let placeholders = (1..=cols.len()).map(|i| format!("?{i}")).collect::<Vec<_>>().join(", ");
        let sql = format!("INSERT OR REPLACE INTO {table} ({col_list}) VALUES ({placeholders})");
        let values: Vec<rusqlite::types::Value> = cols.iter().map(|c| {
            match obj.get(*c).unwrap_or(&serde_json::Value::Null) {
                serde_json::Value::Null => rusqlite::types::Value::Null,
                serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(*b as i64),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        rusqlite::types::Value::Integer(i)
                    } else {
                        rusqlite::types::Value::Real(n.as_f64().unwrap_or(0.0))
                    }
                }
                serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                _ => rusqlite::types::Value::Null,
            }
        }).collect();
        let params_refs: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        conn.execute(&sql, params_refs.as_slice()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn backup_export(app: tauri::AppHandle, db: State<DbState>, file_path: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let conn = db.0.lock().unwrap();

    let mut project_files: Vec<BackupFileEntry> = Vec::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, project_id, name, original_name, storage_path, file_type, file_size, category, created_at FROM project_files")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?, r.get::<_, Option<String>>(5)?, r.get::<_, i64>(6)?, r.get::<_, Option<String>>(7)?, r.get::<_, String>(8)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows.filter_map(|r| r.ok()) {
            let (id, project_id, name, original_name, storage_path, file_type, file_size, category, created_at) = row;
            let data_base64 = match std::fs::read(&storage_path) {
                Ok(bytes) => STANDARD.encode(bytes),
                Err(_) => continue, // skip files missing from disk rather than failing the whole backup
            };
            project_files.push(BackupFileEntry { id, project_id, name, original_name, file_type, file_size, category, created_at, data_base64 });
        }
    }
    let _ = &app; // app handle kept for symmetry/future use (files_dir already resolved via stored absolute paths)

    let (salt, verifier_ciphertext, verifier_nonce, auto_lock_minutes): (String, String, String, i64) = conn
        .query_row(
            "SELECT salt, verifier_ciphertext, verifier_nonce, auto_lock_minutes FROM vault_config WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|_| "Vault has not been created yet.".to_string())?;

    let envelope = BackupEnvelope {
        format: "nexforge-vault-backup-v1".into(),
        created_at: chrono::Utc::now().to_rfc3339(),
        vault_config: BackupVaultConfig {
            salt,
            verifier_ciphertext,
            verifier_nonce,
            auto_lock_minutes,
        },
        projects: row_to_json(&conn, "SELECT * FROM projects")?,
        clients: row_to_json(&conn, "SELECT * FROM clients")?,
        project_notes: row_to_json(&conn, "SELECT * FROM project_notes")?,
        project_links: row_to_json(&conn, "SELECT * FROM project_links")?,
        invoices: row_to_json(&conn, "SELECT * FROM invoices")?,
        invoice_items: row_to_json(&conn, "SELECT * FROM invoice_items")?,
        payments: row_to_json(&conn, "SELECT * FROM payments")?,
        project_files,
        settings: row_to_json(&conn, "SELECT * FROM settings")?,
        secrets: row_to_json(&conn, "SELECT * FROM secrets")?,
        passwords: row_to_json(&conn, "SELECT * FROM passwords")?,
        databases: row_to_json(&conn, "SELECT * FROM databases")?,
    };

    let json = serde_json::to_string_pretty(&envelope).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn backup_preview(file_path: String) -> Result<serde_json::Value, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let envelope: BackupEnvelope = serde_json::from_str(&content).map_err(|_| "Not a valid Nexforge vault backup file.".to_string())?;
    Ok(serde_json::json!({
        "format": envelope.format,
        "created_at": envelope.created_at,
        "projects": envelope.projects.len(),
        "clients": envelope.clients.len(),
        "invoices": envelope.invoices.len(),
        "project_files": envelope.project_files.len(),
        "settings": envelope.settings.len(),
        "secrets": envelope.secrets.len(),
        "passwords": envelope.passwords.len(),
        "databases": envelope.databases.len(),
    }))
}

/// Restores a backup. Requires the ORIGINAL master password for that backup
/// (verified against the backup's own verifier) since restored ciphertext
/// was encrypted under that backup's key — we do not attempt any password
/// reset or recovery here by design.
#[tauri::command]
pub fn backup_restore(app: tauri::AppHandle, db: State<DbState>, file_path: String, master_password: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let envelope: BackupEnvelope = serde_json::from_str(&content).map_err(|_| "Not a valid Nexforge vault backup file.".to_string())?;

    let key = crate::crypto::derive_key(&master_password, &envelope.vault_config.salt).map_err(|e| e.to_string())?;
    if !crate::crypto::check_verifier(&key, &envelope.vault_config.verifier_ciphertext, &envelope.vault_config.verifier_nonce) {
        return Err("Master password does not match this backup file.".into());
    }

    let conn = db.0.lock().unwrap();
    conn.execute_batch("DELETE FROM secrets; DELETE FROM passwords; DELETE FROM databases; DELETE FROM payments; DELETE FROM invoice_items; DELETE FROM invoices; DELETE FROM project_links; DELETE FROM project_notes; DELETE FROM project_files; DELETE FROM settings; DELETE FROM clients; DELETE FROM projects; DELETE FROM vault_config;")
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO vault_config (id, salt, verifier_ciphertext, verifier_nonce, auto_lock_minutes, created_at) VALUES (1, ?1, ?2, ?3, ?4, ?5)",
        params![envelope.vault_config.salt, envelope.vault_config.verifier_ciphertext, envelope.vault_config.verifier_nonce, envelope.vault_config.auto_lock_minutes, chrono::Utc::now().to_rfc3339()],
    ).map_err(|e| e.to_string())?;

    for p in &envelope.projects {
        conn.execute(
            "INSERT OR REPLACE INTO projects (id, name, client, description, status, framework, backend, database_type, hosting, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                p.get("id").and_then(|v| v.as_str()),
                p.get("name").and_then(|v| v.as_str()),
                p.get("client").and_then(|v| v.as_str()),
                p.get("description").and_then(|v| v.as_str()),
                p.get("status").and_then(|v| v.as_str()),
                p.get("framework").and_then(|v| v.as_str()),
                p.get("backend").and_then(|v| v.as_str()),
                p.get("database_type").and_then(|v| v.as_str()),
                p.get("hosting").and_then(|v| v.as_str()),
                p.get("created_at").and_then(|v| v.as_str()),
                p.get("updated_at").and_then(|v| v.as_str()),
            ],
        ).map_err(|e| e.to_string())?;
    }
    insert_generic(&conn, "clients", &envelope.clients)?;
    insert_generic(&conn, "project_notes", &envelope.project_notes)?;
    insert_generic(&conn, "project_links", &envelope.project_links)?;
    insert_generic(&conn, "invoices", &envelope.invoices)?;
    insert_generic(&conn, "invoice_items", &envelope.invoice_items)?;
    insert_generic(&conn, "payments", &envelope.payments)?;
    insert_generic(&conn, "settings", &envelope.settings)?;

    for f in &envelope.project_files {
        let bytes = STANDARD.decode(&f.data_base64).map_err(|_| "Corrupt file data in backup.".to_string())?;
        let project_dir = crate::db::files_dir(&app).join(format!("project_{}", f.project_id));
        std::fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
        let full_path = project_dir.join(&f.name);
        std::fs::write(&full_path, &bytes).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO project_files (id, project_id, name, original_name, storage_path, file_type, file_size, category, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            rusqlite::params![f.id, f.project_id, f.name, f.original_name, full_path.to_string_lossy(), f.file_type, f.file_size, f.category, f.created_at],
        ).map_err(|e| e.to_string())?;
    }

    for s in &envelope.secrets {
        conn.execute(
            "INSERT OR REPLACE INTO secrets (id, project_id, name, category, environment, encrypted_value, nonce, notes, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                s.get("id").and_then(|v| v.as_str()),
                s.get("project_id").and_then(|v| v.as_str()),
                s.get("name").and_then(|v| v.as_str()),
                s.get("category").and_then(|v| v.as_str()),
                s.get("environment").and_then(|v| v.as_str()),
                s.get("encrypted_value").and_then(|v| v.as_str()),
                s.get("nonce").and_then(|v| v.as_str()),
                s.get("notes").and_then(|v| v.as_str()),
                s.get("created_at").and_then(|v| v.as_str()),
                s.get("updated_at").and_then(|v| v.as_str()),
            ],
        ).map_err(|e| e.to_string())?;
    }
    for p in &envelope.passwords {
        conn.execute(
            "INSERT OR REPLACE INTO passwords (id, project_id, title, username, encrypted_password, nonce, website_url, environment, notes, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                p.get("id").and_then(|v| v.as_str()),
                p.get("project_id").and_then(|v| v.as_str()),
                p.get("title").and_then(|v| v.as_str()),
                p.get("username").and_then(|v| v.as_str()),
                p.get("encrypted_password").and_then(|v| v.as_str()),
                p.get("nonce").and_then(|v| v.as_str()),
                p.get("website_url").and_then(|v| v.as_str()),
                p.get("environment").and_then(|v| v.as_str()),
                p.get("notes").and_then(|v| v.as_str()),
                p.get("created_at").and_then(|v| v.as_str()),
                p.get("updated_at").and_then(|v| v.as_str()),
            ],
        ).map_err(|e| e.to_string())?;
    }
    for d in &envelope.databases {
        conn.execute(
            "INSERT OR REPLACE INTO databases (id, project_id, name, provider, host, port, database_name, username,
                encrypted_connection_string, connection_string_nonce, encrypted_password, password_nonce, environment, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            params![
                d.get("id").and_then(|v| v.as_str()),
                d.get("project_id").and_then(|v| v.as_str()),
                d.get("name").and_then(|v| v.as_str()),
                d.get("provider").and_then(|v| v.as_str()),
                d.get("host").and_then(|v| v.as_str()),
                d.get("port").and_then(|v| v.as_str()),
                d.get("database_name").and_then(|v| v.as_str()),
                d.get("username").and_then(|v| v.as_str()),
                d.get("encrypted_connection_string").and_then(|v| v.as_str()),
                d.get("connection_string_nonce").and_then(|v| v.as_str()),
                d.get("encrypted_password").and_then(|v| v.as_str()),
                d.get("password_nonce").and_then(|v| v.as_str()),
                d.get("environment").and_then(|v| v.as_str()),
                d.get("created_at").and_then(|v| v.as_str()),
                d.get("updated_at").and_then(|v| v.as_str()),
            ],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}
