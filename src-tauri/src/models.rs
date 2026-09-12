use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct VaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub auto_lock_minutes: i64,
}

#[derive(Serialize)]
pub struct SecretRecord {
    pub id: String,
    pub project_id: Option<String>,
    pub name: String,
    pub category: String,
    pub environment: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct NewSecret {
    pub project_id: Option<String>,
    pub name: String,
    pub category: String,
    pub environment: String,
    pub value: String,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSecret {
    pub id: String,
    pub name: String,
    pub category: String,
    pub environment: String,
    pub notes: Option<String>,
    /// None = keep existing encrypted value untouched.
    pub new_value: Option<String>,
}

#[derive(Serialize)]
pub struct PasswordRecord {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub username: Option<String>,
    pub website_url: Option<String>,
    pub environment: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct NewPassword {
    pub project_id: Option<String>,
    pub title: String,
    pub username: Option<String>,
    pub password: String,
    pub website_url: Option<String>,
    pub environment: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePassword {
    pub id: String,
    pub title: String,
    pub username: Option<String>,
    pub website_url: Option<String>,
    pub environment: Option<String>,
    pub notes: Option<String>,
    pub new_password: Option<String>,
}

#[derive(Serialize)]
pub struct DatabaseRecord {
    pub id: String,
    pub project_id: Option<String>,
    pub name: String,
    pub provider: String,
    pub host: Option<String>,
    pub port: Option<String>,
    pub database_name: Option<String>,
    pub username: Option<String>,
    pub environment: Option<String>,
    pub has_connection_string: bool,
    pub has_password: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct NewDatabase {
    pub project_id: Option<String>,
    pub name: String,
    pub provider: String,
    pub host: Option<String>,
    pub port: Option<String>,
    pub database_name: Option<String>,
    pub username: Option<String>,
    pub connection_string: Option<String>,
    pub password: Option<String>,
    pub environment: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateDatabase {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub host: Option<String>,
    pub port: Option<String>,
    pub database_name: Option<String>,
    pub username: Option<String>,
    pub environment: Option<String>,
    pub new_connection_string: Option<String>,
    pub new_password: Option<String>,
}

#[derive(Serialize)]
pub struct DatabaseSecrets {
    pub connection_string: Option<String>,
    pub password: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct ProjectMigrate {
    pub id: String,
    pub name: String,
    pub client: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub framework: Option<String>,
    pub backend: Option<String>,
    pub database_type: Option<String>,
    pub hosting: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------
// Core business data (non-sensitive — stored as plain columns)
// ---------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct Client {
    pub id: String,
    pub name: String,
    pub company: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub website: Option<String>,
    pub gstin: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct NewClient {
    pub name: String,
    pub company: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub website: Option<String>,
    pub gstin: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateClient {
    pub id: String,
    pub name: String,
    pub company: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub website: Option<String>,
    pub gstin: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectFull {
    pub id: String,
    pub name: String,
    pub client_id: Option<String>,
    pub client: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub tech_stack: Option<String>,
    pub framework: Option<String>,
    pub backend: Option<String>,
    pub database_type: Option<String>,
    pub hosting: Option<String>,
    pub repository_url: Option<String>,
    pub live_url: Option<String>,
    pub staging_url: Option<String>,
    pub start_date: Option<String>,
    pub deadline: Option<String>,
    pub budget: Option<f64>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct NewProject {
    pub name: String,
    pub client_id: Option<String>,
    pub client: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub tech_stack: Option<String>,
    pub framework: Option<String>,
    pub backend: Option<String>,
    pub database_type: Option<String>,
    pub hosting: Option<String>,
    pub repository_url: Option<String>,
    pub live_url: Option<String>,
    pub staging_url: Option<String>,
    pub start_date: Option<String>,
    pub deadline: Option<String>,
    pub budget: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProject {
    pub id: String,
    pub name: String,
    pub client_id: Option<String>,
    pub client: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub tech_stack: Option<String>,
    pub framework: Option<String>,
    pub backend: Option<String>,
    pub database_type: Option<String>,
    pub hosting: Option<String>,
    pub repository_url: Option<String>,
    pub live_url: Option<String>,
    pub staging_url: Option<String>,
    pub start_date: Option<String>,
    pub deadline: Option<String>,
    pub budget: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectLinkRecord {
    pub id: String,
    pub project_id: String,
    #[serde(rename = "type")]
    pub link_type: String,
    pub url: String,
    pub label: Option<String>,
}

#[derive(Deserialize)]
pub struct NewProjectLink {
    pub project_id: String,
    #[serde(rename = "type")]
    pub link_type: String,
    pub url: String,
    pub label: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectNote {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct NewProjectNote {
    pub project_id: String,
    pub title: String,
    pub content: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProjectNote {
    pub id: String,
    pub title: String,
    pub content: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectFile {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub original_name: String,
    pub file_type: Option<String>,
    pub file_size: i64,
    pub category: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct InvoiceItemRow {
    pub id: String,
    pub description: String,
    pub quantity: f64,
    pub rate: f64,
    pub amount: f64,
}

#[derive(Deserialize, Clone)]
pub struct InvoiceItemInput {
    pub description: String,
    pub quantity: f64,
    pub rate: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Invoice {
    pub id: String,
    pub invoice_number: String,
    pub client_id: Option<String>,
    pub project_id: Option<String>,
    pub issue_date: String,
    pub due_date: String,
    pub status: String,
    pub currency: String,
    pub subtotal: f64,
    pub discount: f64,
    pub tax: f64,
    pub total: f64,
    pub notes: Option<String>,
    pub payment_terms: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub items: Vec<InvoiceItemRow>,
    pub amount_paid: f64,
}

#[derive(Deserialize)]
pub struct NewInvoice {
    pub invoice_number: Option<String>,
    pub client_id: Option<String>,
    pub project_id: Option<String>,
    pub issue_date: String,
    pub due_date: String,
    pub status: String,
    pub currency: String,
    pub discount: f64,
    pub tax_rate_percent: f64,
    pub notes: Option<String>,
    pub payment_terms: Option<String>,
    pub items: Vec<InvoiceItemInput>,
}

#[derive(Deserialize)]
pub struct UpdateInvoice {
    pub id: String,
    pub client_id: Option<String>,
    pub project_id: Option<String>,
    pub issue_date: String,
    pub due_date: String,
    pub status: String,
    pub currency: String,
    pub discount: f64,
    pub tax_rate_percent: f64,
    pub notes: Option<String>,
    pub payment_terms: Option<String>,
    pub items: Vec<InvoiceItemInput>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Payment {
    pub id: String,
    pub invoice_id: String,
    pub amount: f64,
    pub payment_date: String,
    pub payment_method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct NewPayment {
    pub invoice_id: String,
    pub amount: f64,
    pub payment_date: String,
    pub payment_method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct DashboardStats {
    pub total_projects: i64,
    pub total_clients: i64,
    pub total_invoices: i64,
    pub paid_invoices: i64,
    pub pending_invoices: i64,
    pub overdue_invoices: i64,
    pub total_revenue: f64,
    pub outstanding_amount: f64,
}
