//! Non-vault business data commands: clients, projects, invoices, payments,
//! project notes/links/files, settings, and dashboard aggregates. None of
//! this data is encrypted — it isn't sensitive — but it is real SQLite
//! persistence, not localStorage, so it survives app restarts and doesn't
//! live in the browser.

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::db::DbState;
use crate::models::*;

fn now() -> String {
    Utc::now().to_rfc3339()
}

// ---------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------

#[tauri::command]
pub fn clients_list(db: State<DbState>) -> Result<Vec<Client>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, company, email, phone, address, website, gstin, notes, created_at, updated_at FROM clients ORDER BY name ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Client {
                id: r.get(0)?, name: r.get(1)?, company: r.get(2)?, email: r.get(3)?, phone: r.get(4)?,
                address: r.get(5)?, website: r.get(6)?, gstin: r.get(7)?, notes: r.get(8)?,
                created_at: r.get(9)?, updated_at: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn clients_create(db: State<DbState>, input: NewClient) -> Result<String, String> {
    if input.name.trim().is_empty() {
        return Err("Client name is required.".into());
    }
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO clients (id, name, company, email, phone, address, website, gstin, notes, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)",
        params![id, input.name.trim(), input.company, input.email, input.phone, input.address, input.website, input.gstin, input.notes, ts],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn clients_update(db: State<DbState>, input: UpdateClient) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE clients SET name=?1, company=?2, email=?3, phone=?4, address=?5, website=?6, gstin=?7, notes=?8, updated_at=?9 WHERE id=?10",
        params![input.name.trim(), input.company, input.email, input.phone, input.address, input.website, input.gstin, input.notes, now(), input.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clients_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    let linked_projects: i64 = conn
        .query_row("SELECT COUNT(*) FROM projects WHERE client_id = ?1", params![id], |r| r.get(0))
        .unwrap_or(0);
    let linked_invoices: i64 = conn
        .query_row("SELECT COUNT(*) FROM invoices WHERE client_id = ?1", params![id], |r| r.get(0))
        .unwrap_or(0);
    if linked_projects > 0 || linked_invoices > 0 {
        return Err(format!(
            "Cannot delete: this client has {linked_projects} project(s) and {linked_invoices} invoice(s) linked to it."
        ));
    }
    conn.execute("DELETE FROM clients WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------

fn row_to_project(r: &rusqlite::Row) -> rusqlite::Result<ProjectFull> {
    Ok(ProjectFull {
        id: r.get(0)?, name: r.get(1)?, client: r.get(2)?, description: r.get(3)?, status: r.get(4)?,
        framework: r.get(5)?, backend: r.get(6)?, database_type: r.get(7)?, hosting: r.get(8)?,
        created_at: r.get(9)?, updated_at: r.get(10)?, client_id: r.get(11)?, category: r.get(12)?,
        tech_stack: r.get(13)?, repository_url: r.get(14)?, live_url: r.get(15)?, staging_url: r.get(16)?,
        start_date: r.get(17)?, deadline: r.get(18)?, budget: r.get(19)?, notes: r.get(20)?,
    })
}

const PROJECT_COLUMNS: &str = "id, name, client, description, status, framework, backend, database_type, hosting, created_at, updated_at, client_id, category, tech_stack, repository_url, live_url, staging_url, start_date, deadline, budget, notes";

#[tauri::command]
pub fn projects_list(db: State<DbState>) -> Result<Vec<ProjectFull>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare(&format!("SELECT {PROJECT_COLUMNS} FROM projects ORDER BY updated_at DESC"))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_project).map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn projects_get(db: State<DbState>, id: String) -> Result<Option<ProjectFull>, String> {
    let conn = db.0.lock().unwrap();
    conn.query_row(&format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"), params![id], row_to_project)
        .optional()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn projects_create(db: State<DbState>, input: NewProject) -> Result<String, String> {
    if input.name.trim().is_empty() {
        return Err("Project name is required.".into());
    }
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, client, description, status, framework, backend, database_type, hosting, created_at, updated_at,
            client_id, category, tech_stack, repository_url, live_url, staging_url, start_date, deadline, budget, notes)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
        params![id, input.name.trim(), input.client, input.description, input.status.unwrap_or_else(|| "Planning".into()),
            input.framework, input.backend, input.database_type, input.hosting, ts,
            input.client_id, input.category, input.tech_stack, input.repository_url, input.live_url, input.staging_url,
            input.start_date, input.deadline, input.budget, input.notes],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn projects_update(db: State<DbState>, input: UpdateProject) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE projects SET name=?1, client=?2, description=?3, status=?4, framework=?5, backend=?6, database_type=?7, hosting=?8,
            client_id=?9, category=?10, tech_stack=?11, repository_url=?12, live_url=?13, staging_url=?14, start_date=?15, deadline=?16,
            budget=?17, notes=?18, updated_at=?19 WHERE id=?20",
        params![input.name.trim(), input.client, input.description, input.status, input.framework, input.backend, input.database_type, input.hosting,
            input.client_id, input.category, input.tech_stack, input.repository_url, input.live_url, input.staging_url, input.start_date, input.deadline,
            input.budget, input.notes, now(), input.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn projects_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM project_links WHERE project_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM project_notes WHERE project_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM secrets WHERE project_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM passwords WHERE project_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM databases WHERE project_id = ?1", params![id]).map_err(|e| e.to_string())?;
    // Files on disk are intentionally left in place here; project_files rows
    // are removed so they no longer show in the UI. A future cleanup pass
    // could also delete the on-disk folder.
    conn.execute("DELETE FROM project_files WHERE project_id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------
// Project links
// ---------------------------------------------------------------------

#[tauri::command]
pub fn project_links_list(db: State<DbState>, project_id: String) -> Result<Vec<ProjectLinkRecord>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, project_id, type, url, label FROM project_links WHERE project_id = ?1 ORDER BY rowid ASC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![project_id], |r| {
        Ok(ProjectLinkRecord { id: r.get(0)?, project_id: r.get(1)?, link_type: r.get(2)?, url: r.get(3)?, label: r.get(4)? })
    }).map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn project_links_create(db: State<DbState>, input: NewProjectLink) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO project_links (id, project_id, type, url, label) VALUES (?1,?2,?3,?4,?5)",
        params![id, input.project_id, input.link_type, input.url, input.label],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn project_links_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM project_links WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------
// Project notes
// ---------------------------------------------------------------------

#[tauri::command]
pub fn project_notes_list(db: State<DbState>, project_id: String) -> Result<Vec<ProjectNote>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, project_id, title, content, created_at, updated_at FROM project_notes WHERE project_id = ?1 ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![project_id], |r| {
        Ok(ProjectNote { id: r.get(0)?, project_id: r.get(1)?, title: r.get(2)?, content: r.get(3)?, created_at: r.get(4)?, updated_at: r.get(5)? })
    }).map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn project_notes_create(db: State<DbState>, input: NewProjectNote) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO project_notes (id, project_id, title, content, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?5)",
        params![id, input.project_id, input.title, input.content, ts],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn project_notes_update(db: State<DbState>, input: UpdateProjectNote) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE project_notes SET title=?1, content=?2, updated_at=?3 WHERE id=?4",
        params![input.title, input.content, now(), input.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn project_notes_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM project_notes WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------
// Project files — metadata in SQLite, bytes on disk under the OS app-data dir
// ---------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES: usize = 50 * 1024 * 1024; // 50MB

fn sanitize_filename(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let cleaned: String = base
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' || c == ' ' { c } else { '_' })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() { "file".to_string() } else { trimmed.to_string() }
}

#[tauri::command]
pub fn project_files_list(db: State<DbState>, project_id: String) -> Result<Vec<ProjectFile>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, project_id, name, original_name, file_type, file_size, category, created_at FROM project_files WHERE project_id = ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![project_id], |r| {
        Ok(ProjectFile { id: r.get(0)?, project_id: r.get(1)?, name: r.get(2)?, original_name: r.get(3)?, file_type: r.get(4)?, file_size: r.get(5)?, category: r.get(6)?, created_at: r.get(7)? })
    }).map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn project_files_upload(
    app: AppHandle,
    db: State<DbState>,
    project_id: String,
    original_name: String,
    category: Option<String>,
    file_type: Option<String>,
    data_base64: String,
) -> Result<ProjectFile, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let bytes = STANDARD.decode(&data_base64).map_err(|_| "Could not decode file data.".to_string())?;
    if bytes.len() > MAX_FILE_SIZE_BYTES {
        return Err(format!("File is too large (max {}MB).", MAX_FILE_SIZE_BYTES / (1024 * 1024)));
    }

    let project_dir = crate::db::files_dir(&app).join(format!("project_{project_id}"));
    std::fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let safe_name = sanitize_filename(&original_name);
    let stored_name = format!("{id}_{safe_name}");
    let full_path = project_dir.join(&stored_name);
    std::fs::write(&full_path, &bytes).map_err(|e| e.to_string())?;

    let ts = now();
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO project_files (id, project_id, name, original_name, storage_path, file_type, file_size, category, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![id, project_id, stored_name, safe_name, full_path.to_string_lossy(), file_type, bytes.len() as i64, category, ts],
    ).map_err(|e| e.to_string())?;

    Ok(ProjectFile { id, project_id, name: stored_name, original_name: safe_name, file_type, file_size: bytes.len() as i64, category, created_at: ts })
}

#[tauri::command]
pub fn project_files_read(db: State<DbState>, id: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let path: String = {
        let conn = db.0.lock().unwrap();
        conn.query_row("SELECT storage_path FROM project_files WHERE id = ?1", params![id], |r| r.get(0))
            .map_err(|_| "File not found.".to_string())?
    };
    let bytes = std::fs::read(&path).map_err(|_| "File is missing from disk.".to_string())?;
    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
pub fn project_files_open(app: AppHandle, db: State<DbState>, id: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path: String = {
        let conn = db.0.lock().unwrap();
        conn.query_row("SELECT storage_path FROM project_files WHERE id = ?1", params![id], |r| r.get(0))
            .map_err(|_| "File not found.".to_string())?
    };
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn project_files_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let path: String = {
        let conn = db.0.lock().unwrap();
        conn.query_row("SELECT storage_path FROM project_files WHERE id = ?1", params![id], |r| r.get(0))
            .map_err(|_| "File not found.".to_string())?
    };
    std::fs::remove_file(&path).ok();
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM project_files WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------
// Settings (business profile, invoice defaults, tax defaults)
// ---------------------------------------------------------------------

#[tauri::command]
pub fn settings_get_all(db: State<DbState>) -> Result<std::collections::HashMap<String, String>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT key, value FROM settings").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub fn settings_set(db: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value, now()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn settings_set_many(db: State<DbState>, values: std::collections::HashMap<String, String>) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    let ts = now();
    for (key, value) in values {
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value, ts],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------
// Invoices, items, payments
// ---------------------------------------------------------------------

fn compute_invoice_totals(items: &[InvoiceItemInput], discount: f64, tax_rate_percent: f64) -> (f64, f64, f64, f64) {
    let subtotal: f64 = items.iter().map(|i| i.quantity * i.rate).sum();
    let taxable = (subtotal - discount).max(0.0);
    let tax = taxable * (tax_rate_percent / 100.0);
    let total = taxable + tax;
    (subtotal, discount, tax, total)
}

fn generate_invoice_number(conn: &rusqlite::Connection) -> String {
    let prefix: String = conn
        .query_row("SELECT value FROM settings WHERE key = 'invoice_prefix'", [], |r| r.get(0))
        .unwrap_or_else(|_| "NF".to_string());
    let year = Utc::now().format("%Y").to_string();
    let like_pattern = format!("{prefix}-{year}-%");
    let mut stmt = conn.prepare("SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?1").unwrap();
    let existing: Vec<String> = stmt
        .query_map(params![like_pattern], |r| r.get::<_, String>(0))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    let max_n = existing
        .iter()
        .filter_map(|s| s.rsplit('-').next())
        .filter_map(|s| s.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{prefix}-{year}-{:03}", max_n + 1)
}

fn load_invoice(conn: &rusqlite::Connection, id: &str) -> Result<Invoice, String> {
    let (invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms, created_at, updated_at): (String, Option<String>, Option<String>, String, String, String, String, f64, f64, f64, f64, Option<String>, Option<String>, String, String) = conn.query_row(
        "SELECT invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms, created_at, updated_at FROM invoices WHERE id = ?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?, r.get(9)?, r.get(10)?, r.get(11)?, r.get(12)?, r.get(13)?, r.get(14)?)),
    ).map_err(|_| "Invoice not found.".to_string())?;

    let mut stmt = conn.prepare("SELECT id, description, quantity, rate, amount FROM invoice_items WHERE invoice_id = ?1 ORDER BY sort_order ASC").map_err(|e| e.to_string())?;
    let items: Vec<InvoiceItemRow> = stmt
        .query_map(params![id], |r| {
            Ok(InvoiceItemRow { id: r.get(0)?, description: r.get(1)?, quantity: r.get(2)?, rate: r.get(3)?, amount: r.get(4)? })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let amount_paid: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ?1", params![id], |r| r.get(0))
        .unwrap_or(0.0);

    Ok(Invoice {
        id: id.to_string(), invoice_number, client_id, project_id, issue_date, due_date, status, currency,
        subtotal, discount, tax, total, notes, payment_terms, created_at, updated_at, items, amount_paid,
    })
}

#[tauri::command]
pub fn invoices_list(db: State<DbState>) -> Result<Vec<Invoice>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id FROM invoices ORDER BY issue_date DESC, created_at DESC").map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    ids.iter().map(|id| load_invoice(&conn, id)).collect()
}

#[tauri::command]
pub fn invoices_get(db: State<DbState>, id: String) -> Result<Invoice, String> {
    let conn = db.0.lock().unwrap();
    load_invoice(&conn, &id)
}

#[tauri::command]
pub fn invoices_create(db: State<DbState>, input: NewInvoice) -> Result<String, String> {
    if input.items.is_empty() {
        return Err("Add at least one invoice item.".into());
    }
    let conn = db.0.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let invoice_number = match input.invoice_number {
        Some(n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => generate_invoice_number(&conn),
    };
    let exists: bool = conn.query_row("SELECT COUNT(*) FROM invoices WHERE invoice_number = ?1", params![invoice_number], |r| r.get::<_, i64>(0)).map(|c| c > 0).unwrap_or(false);
    if exists {
        return Err(format!("Invoice number {invoice_number} already exists."));
    }

    let (subtotal, discount, tax, total) = compute_invoice_totals(&input.items, input.discount, input.tax_rate_percent);
    let ts = now();
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)",
        params![id, invoice_number, input.client_id, input.project_id, input.issue_date, input.due_date, input.status, input.currency,
            subtotal, discount, tax, total, input.notes, input.payment_terms, ts],
    ).map_err(|e| e.to_string())?;

    for (i, item) in input.items.iter().enumerate() {
        let amount = item.quantity * item.rate;
        conn.execute(
            "INSERT INTO invoice_items (id, invoice_id, description, quantity, rate, amount, sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![Uuid::new_v4().to_string(), id, item.description, item.quantity, item.rate, amount, i as i64],
        ).map_err(|e| e.to_string())?;
    }

    Ok(id)
}

#[tauri::command]
pub fn invoices_update(db: State<DbState>, input: UpdateInvoice) -> Result<(), String> {
    if input.items.is_empty() {
        return Err("Add at least one invoice item.".into());
    }
    let (subtotal, discount, tax, total) = compute_invoice_totals(&input.items, input.discount, input.tax_rate_percent);
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE invoices SET client_id=?1, project_id=?2, issue_date=?3, due_date=?4, status=?5, currency=?6, subtotal=?7, discount=?8, tax=?9, total=?10, notes=?11, payment_terms=?12, updated_at=?13 WHERE id=?14",
        params![input.client_id, input.project_id, input.issue_date, input.due_date, input.status, input.currency, subtotal, discount, tax, total, input.notes, input.payment_terms, now(), input.id],
    ).map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM invoice_items WHERE invoice_id = ?1", params![input.id]).map_err(|e| e.to_string())?;
    for (i, item) in input.items.iter().enumerate() {
        let amount = item.quantity * item.rate;
        conn.execute(
            "INSERT INTO invoice_items (id, invoice_id, description, quantity, rate, amount, sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![Uuid::new_v4().to_string(), input.id, item.description, item.quantity, item.rate, amount, i as i64],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn invoices_set_status(db: State<DbState>, id: String, status: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("UPDATE invoices SET status = ?1, updated_at = ?2 WHERE id = ?3", params![status, now(), id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn invoices_duplicate(db: State<DbState>, id: String) -> Result<String, String> {
    let conn = db.0.lock().unwrap();
    let existing = load_invoice(&conn, &id)?;
    let new_id = Uuid::new_v4().to_string();
    let new_number = generate_invoice_number(&conn);
    let ts = now();
    let today = Utc::now().format("%Y-%m-%d").to_string();
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,'Draft',?7,?8,?9,?10,?11,?12,?13,?14,?14)",
        params![new_id, new_number, existing.client_id, existing.project_id, today, existing.due_date, existing.currency,
            existing.subtotal, existing.discount, existing.tax, existing.total, existing.notes, existing.payment_terms, ts],
    ).map_err(|e| e.to_string())?;
    for (i, item) in existing.items.iter().enumerate() {
        conn.execute(
            "INSERT INTO invoice_items (id, invoice_id, description, quantity, rate, amount, sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![Uuid::new_v4().to_string(), new_id, item.description, item.quantity, item.rate, item.amount, i as i64],
        ).map_err(|e| e.to_string())?;
    }
    Ok(new_id)
}

#[tauri::command]
pub fn invoices_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM invoice_items WHERE invoice_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM payments WHERE invoice_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM invoices WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn payments_list(db: State<DbState>, invoice_id: String) -> Result<Vec<Payment>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, invoice_id, amount, payment_date, payment_method, reference, notes, created_at FROM payments WHERE invoice_id = ?1 ORDER BY payment_date DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![invoice_id], |r| {
        Ok(Payment { id: r.get(0)?, invoice_id: r.get(1)?, amount: r.get(2)?, payment_date: r.get(3)?, payment_method: r.get(4)?, reference: r.get(5)?, notes: r.get(6)?, created_at: r.get(7)? })
    }).map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).map(Ok).collect()
}

#[tauri::command]
pub fn payments_create(db: State<DbState>, input: NewPayment) -> Result<String, String> {
    let conn = db.0.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO payments (id, invoice_id, amount, payment_date, payment_method, reference, notes, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![id, input.invoice_id, input.amount, input.payment_date, input.payment_method, input.reference, input.notes, now()],
    ).map_err(|e| e.to_string())?;

    // Auto-advance status based on total paid so far, unless already Cancelled.
    let total: f64 = conn.query_row("SELECT total FROM invoices WHERE id = ?1", params![input.invoice_id], |r| r.get(0)).unwrap_or(0.0);
    let paid: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id = ?1", params![input.invoice_id], |r| r.get(0)).unwrap_or(0.0);
    let current_status: String = conn.query_row("SELECT status FROM invoices WHERE id = ?1", params![input.invoice_id], |r| r.get(0)).unwrap_or_default();
    if current_status != "Cancelled" {
        let new_status = if paid >= total && total > 0.0 { "Paid" } else if paid > 0.0 { "Partially Paid" } else { current_status.as_str() };
        conn.execute("UPDATE invoices SET status = ?1, updated_at = ?2 WHERE id = ?3", params![new_status, now(), input.invoice_id]).map_err(|e| e.to_string())?;
    }
    Ok(id)
}

#[tauri::command]
pub fn payments_delete(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM payments WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------
// Dashboard aggregates
// ---------------------------------------------------------------------

#[tauri::command]
pub fn dashboard_stats(db: State<DbState>) -> Result<DashboardStats, String> {
    let conn = db.0.lock().unwrap();
    let total_projects: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0)).unwrap_or(0);
    let total_clients: i64 = conn.query_row("SELECT COUNT(*) FROM clients", [], |r| r.get(0)).unwrap_or(0);
    let total_invoices: i64 = conn.query_row("SELECT COUNT(*) FROM invoices", [], |r| r.get(0)).unwrap_or(0);
    let paid_invoices: i64 = conn.query_row("SELECT COUNT(*) FROM invoices WHERE status = 'Paid'", [], |r| r.get(0)).unwrap_or(0);
    let overdue_invoices: i64 = conn.query_row("SELECT COUNT(*) FROM invoices WHERE status = 'Overdue'", [], |r| r.get(0)).unwrap_or(0);
    let pending_invoices: i64 = conn.query_row("SELECT COUNT(*) FROM invoices WHERE status IN ('Draft','Sent','Partially Paid')", [], |r| r.get(0)).unwrap_or(0);
    let total_revenue: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM payments", [], |r| r.get(0)).unwrap_or(0.0);
    let total_invoiced: f64 = conn.query_row("SELECT COALESCE(SUM(total),0) FROM invoices WHERE status != 'Cancelled'", [], |r| r.get(0)).unwrap_or(0.0);
    let outstanding_amount = (total_invoiced - total_revenue).max(0.0);

    Ok(DashboardStats {
        total_projects, total_clients, total_invoices, paid_invoices, pending_invoices, overdue_invoices,
        total_revenue, outstanding_amount,
    })
}
