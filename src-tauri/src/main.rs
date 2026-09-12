// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backup;
mod commands;
mod core;
mod crypto;
mod db;
mod models;
mod pdf;
mod vault_state;

use tauri::Manager;
use db::DbState;
use vault_state::VaultState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();
            let conn = db::init_db(handle);
            app.manage(DbState(std::sync::Mutex::new(conn)));
            app.manage(VaultState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::vault_status,
            commands::vault_create,
            commands::vault_unlock,
            commands::vault_lock,
            commands::vault_touch_activity,
            commands::vault_set_auto_lock,
            commands::vault_change_master_password,
            commands::secrets_list,
            commands::secrets_create,
            commands::secrets_bulk_create,
            commands::secrets_update,
            commands::secrets_delete,
            commands::secrets_reveal,
            commands::secrets_export,
            commands::passwords_list,
            commands::passwords_create,
            commands::passwords_update,
            commands::passwords_delete,
            commands::passwords_reveal,
            commands::databases_list,
            commands::databases_create,
            commands::databases_update,
            commands::databases_delete,
            commands::databases_reveal,
            commands::projects_migrate,
            commands::app_data_dir,
            backup::backup_export,
            backup::backup_preview,
            backup::backup_restore,
            core::clients_list,
            core::clients_create,
            core::clients_update,
            core::clients_delete,
            core::projects_list,
            core::projects_get,
            core::projects_create,
            core::projects_update,
            core::projects_delete,
            core::project_links_list,
            core::project_links_create,
            core::project_links_delete,
            core::project_notes_list,
            core::project_notes_create,
            core::project_notes_update,
            core::project_notes_delete,
            core::project_files_list,
            core::project_files_upload,
            core::project_files_read,
            core::project_files_open,
            core::project_files_delete,
            core::settings_get_all,
            core::settings_set,
            core::settings_set_many,
            core::invoices_list,
            core::invoices_get,
            core::invoices_create,
            core::invoices_update,
            core::invoices_set_status,
            core::invoices_duplicate,
            core::invoices_delete,
            core::payments_list,
            core::payments_create,
            core::payments_delete,
            core::dashboard_stats,
            pdf::invoices_generate_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nexforge Studio Manager");
}
