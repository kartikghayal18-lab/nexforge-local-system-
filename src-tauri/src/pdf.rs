//! Real PDF generation for invoices using `printpdf` (pure Rust, no system
//! dependency). This produces an actual PDF file on disk — NOT a screenshot
//! of the UI and NOT the browser's print-to-PDF. The caller (frontend)
//! chooses the save path via a native Tauri file dialog and passes it here.

use printpdf::*;
use rusqlite::OptionalExtension;
use std::fs::File;
use std::io::BufWriter;
use tauri::State;

use crate::db::DbState;

fn money(v: f64, currency: &str) -> String {
    format!("{currency} {v:.2}")
}

#[tauri::command]
pub fn invoices_generate_pdf(db: State<DbState>, id: String, out_path: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();

    // Invoice header
    let (invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms, amount_paid): (
        String, Option<String>, Option<String>, String, String, String, String, f64, f64, f64, f64, Option<String>, Option<String>, f64,
    ) = conn
        .query_row(
            "SELECT invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, payment_terms,
                COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id), 0.0)
             FROM invoices WHERE id = ?1",
            [&id],
            |r| {
                Ok((
                    r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?,
                    r.get(7)?, r.get(8)?, r.get(9)?, r.get(10)?, r.get(11)?, r.get(12)?, r.get(13)?,
                ))
            },
        )
        .map_err(|_| "Invoice not found.".to_string())?;

    let client_name: String = client_id
        .as_ref()
        .and_then(|cid| {
            conn.query_row("SELECT name FROM clients WHERE id = ?1", [cid], |r| r.get::<_, String>(0))
                .optional()
                .ok()
                .flatten()
        })
        .unwrap_or_else(|| "—".to_string());

    let project_name: Option<String> = project_id.as_ref().and_then(|pid| {
        conn.query_row("SELECT name FROM projects WHERE id = ?1", [pid], |r| r.get::<_, String>(0))
            .optional()
            .ok()
            .flatten()
    });

    let mut stmt = conn
        .prepare("SELECT description, quantity, rate, amount FROM invoice_items WHERE invoice_id = ?1 ORDER BY sort_order ASC")
        .map_err(|e| e.to_string())?;
    let items: Vec<(String, f64, f64, f64)> = stmt
        .query_map([&id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Business profile from settings
    let get_setting = |key: &str| -> String {
        conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get::<_, String>(0))
            .optional()
            .ok()
            .flatten()
            .unwrap_or_default()
    };
    let business_name = {
        let v = get_setting("business_name");
        if v.is_empty() { "Your Business".to_string() } else { v }
    };
    let business_email = get_setting("business_email");
    let business_phone = get_setting("business_phone");
    let business_address = get_setting("business_address");
    let business_website = get_setting("business_website");
    let business_gstin = get_setting("gstin");
    let footer_text = get_setting("footer_text");
    let business_logo_base64 = get_setting("business_logo_base64");

    drop(conn);

    // --- Build the PDF ---
    let (doc, page1, layer1) = PdfDocument::new(&format!("Invoice {invoice_number}"), Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;
    let layer = doc.get_page(page1).get_layer(layer1);

    // printpdf 0.7's `Mm` wraps f32, not f64 -- every PDF coordinate below is
    // f32 for that reason. The SQLite-derived money values (subtotal, tax,
    // discount, total, amount_paid, qty, rate) stay f64 throughout and are
    // only ever passed to `money()` for string formatting, never into `Mm`,
    // so they're unaffected by this.
    let left: f32 = 15.0;
    let right: f32 = 195.0;
    let mut y: f32 = 280.0;
    let mut text_left: f32 = left;

    if !business_logo_base64.is_empty() {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        if let Ok(bytes) = STANDARD.decode(&business_logo_base64) {
            if let Ok(decoded) = image::load_from_memory(&bytes) {
                let rgba = decoded.to_rgba8();
                let (w, h) = rgba.dimensions();
                let img = Image::from_dynamic_image(&image::DynamicImage::ImageRgba8(rgba));
                let logo_h_mm: f32 = 18.0;
                let logo_w_mm: f32 = logo_h_mm * (w as f32 / h.max(1) as f32);
                // Image::add_to_layer scales relative to the image's native
                // pixel size at 300 DPI; convert our desired mm size into
                // that scale factor (300 DPI => 1px = 25.4/300 mm).
                let px_to_mm: f32 = 25.4 / 300.0;
                img.add_to_layer(
                    layer.clone(),
                    ImageTransform {
                        translate_x: Some(Mm(left)),
                        translate_y: Some(Mm(y - logo_h_mm + 4.0)),
                        scale_x: Some(logo_w_mm / (w as f32 * px_to_mm)),
                        scale_y: Some(logo_h_mm / (h as f32 * px_to_mm)),
                        ..Default::default()
                    },
                );
                text_left = left + logo_w_mm + 6.0;
            }
        }
    }

    layer.use_text(&business_name, 16.0, Mm(text_left), Mm(y), &font_bold);
    y -= 6.0;
    for line in [&business_address, &business_email, &business_phone, &business_website] {
        if !line.is_empty() {
            layer.use_text(line, 9.0, Mm(text_left), Mm(y), &font);
            y -= 4.5;
        }
    }
    if !business_gstin.is_empty() {
        layer.use_text(format!("GSTIN: {business_gstin}"), 9.0, Mm(text_left), Mm(y), &font);
        y -= 4.5;
    }

    // Invoice title block (right side)
    layer.use_text("INVOICE", 20.0, Mm(right - 40.0), Mm(280.0), &font_bold);
    layer.use_text(format!("# {invoice_number}"), 10.0, Mm(right - 40.0), Mm(273.0), &font);
    layer.use_text(format!("Status: {status}"), 10.0, Mm(right - 40.0), Mm(268.0), &font);
    layer.use_text(format!("Issue date: {issue_date}"), 9.0, Mm(right - 40.0), Mm(263.0), &font);
    layer.use_text(format!("Due date: {due_date}"), 9.0, Mm(right - 40.0), Mm(258.0), &font);

    y -= 10.0;
    layer.use_text("Bill To:", 10.0, Mm(left), Mm(y), &font_bold);
    y -= 5.0;
    layer.use_text(&client_name, 10.0, Mm(left), Mm(y), &font);
    if let Some(pname) = &project_name {
        y -= 5.0;
        layer.use_text(format!("Project: {pname}"), 9.0, Mm(left), Mm(y), &font);
    }

    y -= 12.0;
    // Table header
    layer.use_text("Description", 9.0, Mm(left), Mm(y), &font_bold);
    layer.use_text("Qty", 9.0, Mm(130.0), Mm(y), &font_bold);
    layer.use_text("Rate", 9.0, Mm(150.0), Mm(y), &font_bold);
    layer.use_text("Amount", 9.0, Mm(175.0), Mm(y), &font_bold);
    y -= 3.0;
    layer.add_line(printpdf::Line {
        points: vec![
            (Point::new(Mm(left), Mm(y)), false),
            (Point::new(Mm(right), Mm(y)), false),
        ],
        is_closed: false,
    });
    y -= 5.0;

    for (desc, qty, rate, amount) in &items {
        if y < 40.0 {
            break; // simple single-page cap; multi-page pagination is a future improvement
        }
        layer.use_text(desc, 9.0, Mm(left), Mm(y), &font);
        layer.use_text(format!("{qty:.2}"), 9.0, Mm(130.0), Mm(y), &font);
        layer.use_text(money(*rate, &currency), 9.0, Mm(150.0), Mm(y), &font);
        layer.use_text(money(*amount, &currency), 9.0, Mm(175.0), Mm(y), &font);
        y -= 6.0;
    }

    y -= 4.0;
    layer.add_line(printpdf::Line {
        points: vec![
            (Point::new(Mm(120.0), Mm(y)), false),
            (Point::new(Mm(right), Mm(y)), false),
        ],
        is_closed: false,
    });
    y -= 6.0;

    let totals_label_x: f32 = 140.0;
    let totals_value_x: f32 = 175.0;
    layer.use_text("Subtotal:", 9.0, Mm(totals_label_x), Mm(y), &font);
    layer.use_text(money(subtotal, &currency), 9.0, Mm(totals_value_x), Mm(y), &font);
    y -= 5.5;
    if discount > 0.0 {
        layer.use_text("Discount:", 9.0, Mm(totals_label_x), Mm(y), &font);
        layer.use_text(format!("-{}", money(discount, &currency)), 9.0, Mm(totals_value_x), Mm(y), &font);
        y -= 5.5;
    }
    if tax > 0.0 {
        layer.use_text("Tax:", 9.0, Mm(totals_label_x), Mm(y), &font);
        layer.use_text(money(tax, &currency), 9.0, Mm(totals_value_x), Mm(y), &font);
        y -= 5.5;
    }
    layer.use_text("Total:", 11.0, Mm(totals_label_x), Mm(y), &font_bold);
    layer.use_text(money(total, &currency), 11.0, Mm(totals_value_x), Mm(y), &font_bold);
    y -= 5.5;
    if amount_paid > 0.0 {
        layer.use_text("Paid:", 9.0, Mm(totals_label_x), Mm(y), &font);
        layer.use_text(money(amount_paid, &currency), 9.0, Mm(totals_value_x), Mm(y), &font);
        y -= 5.5;
        layer.use_text("Balance due:", 9.0, Mm(totals_label_x), Mm(y), &font_bold);
        layer.use_text(money(total - amount_paid, &currency), 9.0, Mm(totals_value_x), Mm(y), &font_bold);
        y -= 5.5;
    }

    y -= 8.0;
    if let Some(terms) = &payment_terms {
        if !terms.is_empty() {
            layer.use_text("Payment terms:", 9.0, Mm(left), Mm(y), &font_bold);
            y -= 5.0;
            layer.use_text(terms, 9.0, Mm(left), Mm(y), &font);
            y -= 6.0;
        }
    }
    if let Some(n) = &notes {
        if !n.is_empty() {
            layer.use_text("Notes:", 9.0, Mm(left), Mm(y), &font_bold);
            y -= 5.0;
            layer.use_text(n, 9.0, Mm(left), Mm(y), &font);
            y -= 6.0;
        }
    }
    if !footer_text.is_empty() {
        layer.use_text(&footer_text, 8.0, Mm(left), Mm(15.0), &font);
    }

    let file = File::create(&out_path).map_err(|e| format!("Could not create PDF file: {e}"))?;
    doc.save(&mut BufWriter::new(file)).map_err(|e| format!("Could not write PDF: {e}"))?;

    Ok(())
}
