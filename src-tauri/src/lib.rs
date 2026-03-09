mod db;

use db::Db;
use tauri::Manager;

#[tauri::command]
fn get_or_create_conversation(
    db: tauri::State<Db>,
    my_address: String,
    other_address: String,
) -> Result<String, String> {
    db.get_or_create_conversation(&my_address, &other_address)
}

#[tauri::command]
fn get_conversations(db: tauri::State<Db>, my_address: String) -> Result<Vec<db::ConversationRow>, String> {
    db.get_conversations(&my_address)
}

#[tauri::command]
fn get_messages(
    db: tauri::State<Db>,
    conversation_id: String,
    my_address: String,
) -> Result<Vec<db::MessageRow>, String> {
    db.get_messages(&conversation_id, &my_address)
}

#[tauri::command]
fn send_message(
    db: tauri::State<Db>,
    conversation_id: String,
    sender_address: String,
    content: String,
    reply_to_id: Option<String>,
    reply_content: Option<String>,
    reply_sender: Option<String>,
) -> Result<db::MessageRow, String> {
    db.send_message(
        &conversation_id,
        &sender_address,
        &content,
        reply_to_id.as_deref(),
        reply_content.as_deref(),
        reply_sender.as_deref(),
    )
}

#[tauri::command]
fn update_message(
    db: tauri::State<Db>,
    message_id: String,
    sender_address: String,
    new_content: String,
) -> Result<db::MessageRow, String> {
    db.update_message(&message_id, &sender_address, &new_content)
}

#[tauri::command]
fn add_reaction(
    db: tauri::State<Db>,
    message_id: String,
    user_address: String,
    emoji: String,
) -> Result<db::MessageRow, String> {
    db.add_reaction(&message_id, &user_address, &emoji)
}

#[tauri::command]
fn create_invoice(
    db: tauri::State<Db>,
    conversation_id: String,
    sender_address: String,
    recipient_address: String,
    amount_wei: String,
    currency: String,
    description: String,
) -> Result<db::InvoiceRow, String> {
    db.create_invoice(
        &conversation_id,
        &sender_address,
        &recipient_address,
        &amount_wei,
        &currency,
        &description,
    )
}

#[tauri::command]
fn get_invoices(
    db: tauri::State<Db>,
    conversation_id: String,
    my_address: String,
) -> Result<Vec<db::InvoiceRow>, String> {
    db.get_invoices(&conversation_id, &my_address)
}

#[tauri::command]
fn update_invoice_status(
    db: tauri::State<Db>,
    invoice_id: String,
    status: String,
    tx_hash: Option<String>,
    decline_reason: Option<String>,
) -> Result<db::InvoiceRow, String> {
    db.update_invoice_status(&invoice_id, &status, tx_hash.as_deref(), decline_reason.as_deref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let db = Db::new(path)?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_or_create_conversation,
            get_conversations,
            get_messages,
            send_message,
            update_message,
            add_reaction,
            create_invoice,
            get_invoices,
            update_invoice_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
