//! SQLite persistence layer — the single local database for the whole app
//! (projects, clients, invoices, notes, links, file metadata, settings) plus
//! the encrypted vault tables (secrets, passwords, database credentials).
//! Sensitive columns (encrypted_value/nonce, encrypted_password/nonce, the
//! database-credential secret fields) only ever hold ciphertext produced by
//! crypto.rs — this module never sees plaintext secrets.

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

/// Root folder for everything this app writes: `<OS app-data dir>/`.
/// On macOS this resolves to `~/Library/Application Support/studios.nexforge.manager/`.
pub fn app_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("app data dir should resolve");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn db_path(app: &tauri::AppHandle) -> PathBuf {
    app_dir(app).join("nexforge.sqlite3")
}

/// `<app-data>/files/project_<id>/...` — where uploaded project files live.
/// Never exposed to the frontend as a raw path; only accessed through
/// Tauri commands that validate ids and file names.
pub fn files_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app_dir(app).join("files");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn backups_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app_dir(app).join("backups");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn init_db(app: &tauri::AppHandle) -> Connection {
    let path = db_path(app);
    let conn = Connection::open(path).expect("failed to open local database");
    conn.execute_batch("PRAGMA foreign_keys = ON;").ok();
    create_base_tables(&conn);
    run_migrations(&conn);
    conn
}

fn create_base_tables(conn: &Connection) {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS vault_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            salt TEXT NOT NULL,
            verifier_ciphertext TEXT NOT NULL,
            verifier_nonce TEXT NOT NULL,
            auto_lock_minutes INTEGER NOT NULL DEFAULT 15,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            company TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            website TEXT,
            gstin TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            client TEXT,
            description TEXT,
            status TEXT,
            framework TEXT,
            backend TEXT,
            database_type TEXT,
            hosting TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_links (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            type TEXT NOT NULL,
            url TEXT NOT NULL,
            label TEXT
        );

        CREATE TABLE IF NOT EXISTS project_notes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_files (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER NOT NULL DEFAULT 0,
            category TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            invoice_number TEXT NOT NULL UNIQUE,
            client_id TEXT,
            project_id TEXT,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Draft',
            currency TEXT NOT NULL DEFAULT 'INR',
            subtotal REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            tax REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            notes TEXT,
            payment_terms TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS invoice_items (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL,
            description TEXT,
            quantity REAL NOT NULL DEFAULT 1,
            rate REAL NOT NULL DEFAULT 0,
            amount REAL NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_date TEXT NOT NULL,
            payment_method TEXT,
            reference TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS secrets (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            environment TEXT NOT NULL,
            encrypted_value TEXT NOT NULL,
            nonce TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS passwords (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            title TEXT NOT NULL,
            username TEXT,
            encrypted_password TEXT NOT NULL,
            nonce TEXT NOT NULL,
            website_url TEXT,
            environment TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS databases (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            host TEXT,
            port TEXT,
            database_name TEXT,
            username TEXT,
            encrypted_connection_string TEXT,
            connection_string_nonce TEXT,
            encrypted_password TEXT,
            password_nonce TEXT,
            environment TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        "#,
    )
    .expect("failed to initialize base schema");
}

/// Idempotent column additions for databases created by earlier versions of
/// this app. SQLite has no "ADD COLUMN IF NOT EXISTS" we can rely on across
/// versions, so we check `PRAGMA table_info` ourselves and only add what's
/// missing. Safe to run on every launch.
fn run_migrations(conn: &Connection) {
    add_column_if_missing(conn, "projects", "client_id", "TEXT");
    add_column_if_missing(conn, "projects", "category", "TEXT");
    add_column_if_missing(conn, "projects", "tech_stack", "TEXT");
    add_column_if_missing(conn, "projects", "repository_url", "TEXT");
    add_column_if_missing(conn, "projects", "live_url", "TEXT");
    add_column_if_missing(conn, "projects", "staging_url", "TEXT");
    add_column_if_missing(conn, "projects", "start_date", "TEXT");
    add_column_if_missing(conn, "projects", "deadline", "TEXT");
    add_column_if_missing(conn, "projects", "budget", "REAL");
    add_column_if_missing(conn, "projects", "notes", "TEXT");
}

fn add_column_if_missing(conn: &Connection, table: &str, column: &str, sql_type: &str) {
    let mut stmt = match conn.prepare(&format!("PRAGMA table_info({table})")) {
        Ok(s) => s,
        Err(_) => return,
    };
    let existing: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    if existing.iter().any(|c| c == column) {
        return;
    }
    let _ = conn.execute(
        &format!("ALTER TABLE {table} ADD COLUMN {column} {sql_type}"),
        [],
    );
}
