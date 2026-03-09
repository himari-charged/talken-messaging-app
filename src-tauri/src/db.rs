use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
struct ReactionEntry {
    emoji: String,
    #[serde(rename = "userIds")]
    user_ids: Vec<String>,
}

/// Max message content length (chars) to prevent abuse and storage bloat.
const MAX_CONTENT_LEN: usize = 10_000;
/// Max address length (Quai addresses are typically 0x + 40+ hex chars).
const MAX_ADDRESS_LEN: usize = 100;
/// Max conversation id length (two addresses + separator).
const MAX_CONVERSATION_ID_LEN: usize = 200;
/// Max invoice description length.
const MAX_INVOICE_DESC_LEN: usize = 2_000;
/// Max amount_wei string length (u128 decimal).
const MAX_AMOUNT_WEI_LEN: usize = 50;

fn is_valid_address(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() || s.len() > MAX_ADDRESS_LEN {
        return false;
    }
    let hex = s.strip_prefix("0x").unwrap_or(s);
    hex.chars().all(|c| c.is_ascii_hexdigit()) && !hex.is_empty()
}

fn validate_conversation_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > MAX_CONVERSATION_ID_LEN {
        return Err("Invalid conversation id".into());
    }
    Ok(())
}

pub struct Db(Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationRow {
    pub id: String,
    pub other_address: String,
    pub last_content: Option<String>,
    pub last_at: Option<i64>,
    pub last_sender_address: Option<String>,
    pub unread_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageRow {
    pub id: String,
    pub conversation_id: String,
    pub sender_address: String,
    pub content: String,
    pub created_at: i64,
    #[serde(default)]
    pub reply_to_id: Option<String>,
    #[serde(default)]
    pub reply_content: Option<String>,
    #[serde(default)]
    pub reply_sender: Option<String>,
    #[serde(default)]
    pub reactions: Option<String>,
    #[serde(default)]
    pub edited_at: Option<i64>,
    #[serde(default)]
    pub updated_content: Option<String>,
}

/// Invoice: sender expects payment from recipient. amount_wei is in wei (string for large values).
#[derive(Debug, Serialize, Deserialize)]
pub struct InvoiceRow {
    pub id: String,
    pub conversation_id: String,
    /// Address that created the invoice (expects to receive payment).
    pub sender_address: String,
    /// Address that should pay.
    pub recipient_address: String,
    pub amount_wei: String,
    pub currency: String,
    pub description: String,
    /// pending | paid | declined
    pub status: String,
    /// Transaction hash when status is paid.
    pub tx_hash: Option<String>,
    /// Reason given when status is declined.
    pub decline_reason: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

fn get_db_path(app_data_dir: PathBuf) -> PathBuf {
    std::fs::create_dir_all(&app_data_dir).ok();
    app_data_dir.join("talken.db")
}

impl Db {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        let path = get_db_path(app_data_dir);
        let conn = Connection::open(&path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user1 TEXT NOT NULL,
                user2 TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(user1, user2)
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_address TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            );
            CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_address TEXT NOT NULL,
                recipient_address TEXT NOT NULL,
                amount_wei TEXT NOT NULL,
                currency TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL,
                tx_hash TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            );
            CREATE INDEX IF NOT EXISTS idx_invoices_conversation ON invoices(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
            "#,
        )
        .map_err(|e| e.to_string())?;
        // Migrations: add new message columns if missing
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN reply_to_id TEXT", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN reply_content TEXT", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN reply_sender TEXT", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN reactions TEXT", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN edited_at INTEGER", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN updated_content TEXT", []);
        let _ = conn.execute("ALTER TABLE invoices ADD COLUMN decline_reason TEXT", []);
        Ok(Db(Mutex::new(conn)))
    }

    fn conversation_id(a: &str, b: &str) -> String {
        let mut v = [a, b];
        v.sort();
        format!("{}::{}", v[0], v[1])
    }

    pub fn get_or_create_conversation(
        &self,
        my_address: &str,
        other_address: &str,
    ) -> Result<String, String> {
        let my = my_address.trim();
        let other = other_address.trim();
        if !is_valid_address(my) {
            return Err("Invalid sender address".into());
        }
        if !is_valid_address(other) {
            return Err("Invalid recipient address".into());
        }
        if my.eq_ignore_ascii_case(other) {
            return Err("Cannot create conversation with self".into());
        }
        let id = Self::conversation_id(my, other);
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT OR IGNORE INTO conversations (id, user1, user2, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, my, other, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(id)
    }

    pub fn get_conversations(&self, my_address: &str) -> Result<Vec<ConversationRow>, String> {
        let my = my_address.trim();
        if !is_valid_address(my) {
            return Err("Invalid address".into());
        }
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            r#"
            SELECT c.id,
                   CASE WHEN c.user1 = ?1 THEN c.user2 ELSE c.user1 END AS other_address,
                   (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_content,
                   (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_at,
                   (SELECT sender_address FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender_address,
                   (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_address != ?1
                    AND m.created_at > (SELECT COALESCE(MAX(created_at), 0) FROM messages m2 WHERE m2.conversation_id = c.id AND m2.sender_address = ?1)) AS unread_count
            FROM conversations c
            WHERE c.user1 = ?1 OR c.user2 = ?1
            ORDER BY last_at DESC NULLS LAST
            "#,
        ).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![my], |row| {
                Ok(ConversationRow {
                    id: row.get(0)?,
                    other_address: row.get(1)?,
                    last_content: row.get(2)?,
                    last_at: row.get(3)?,
                    last_sender_address: row.get(4)?,
                    unread_count: row.get::<_, i64>(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    pub fn get_messages(
        &self,
        conversation_id: &str,
        my_address: &str,
    ) -> Result<Vec<MessageRow>, String> {
        validate_conversation_id(conversation_id)?;
        if !is_valid_address(my_address.trim()) {
            return Err("Invalid address".into());
        }
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, sender_address, content, created_at, reply_to_id, reply_content, reply_sender, reactions, edited_at, updated_content FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
        ).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![conversation_id], |row| {
                Ok(MessageRow {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    sender_address: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    reply_to_id: row.get::<_, Option<String>>(5).ok().flatten(),
                    reply_content: row.get::<_, Option<String>>(6).ok().flatten(),
                    reply_sender: row.get::<_, Option<String>>(7).ok().flatten(),
                    reactions: row.get::<_, Option<String>>(8).ok().flatten(),
                    edited_at: row.get::<_, Option<i64>>(9).ok().flatten(),
                    updated_content: row.get::<_, Option<String>>(10).ok().flatten(),
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    pub fn send_message(
        &self,
        conversation_id: &str,
        sender_address: &str,
        content: &str,
        reply_to_id: Option<&str>,
        reply_content: Option<&str>,
        reply_sender: Option<&str>,
    ) -> Result<MessageRow, String> {
        validate_conversation_id(conversation_id)?;
        if !is_valid_address(sender_address.trim()) {
            return Err("Invalid sender address".into());
        }
        let content_trimmed = content.trim();
        if content_trimmed.is_empty() {
            return Err("Message cannot be empty".into());
        }
        if content_trimmed.len() > MAX_CONTENT_LEN {
            return Err(format!("Message too long (max {} characters)", MAX_CONTENT_LEN));
        }
        let sender = sender_address.trim();
        let conv_id = conversation_id.trim();
        let id = format!("msg_{}_{}", sender, chrono::Utc::now().timestamp_millis());
        let created_at = chrono::Utc::now().timestamp_millis();
        let r_id = reply_to_id.map(|s| s.trim()).filter(|s| !s.is_empty());
        let r_content = reply_content.map(|s| s.trim()).filter(|s| !s.is_empty());
        let r_sender = reply_sender.map(|s| s.trim()).filter(|s| !s.is_empty());
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, conversation_id, sender_address, content, created_at, reply_to_id, reply_content, reply_sender, reactions) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '[]')",
            params![id, conv_id, sender, content_trimmed, created_at, r_id, r_content, r_sender],
        )
        .map_err(|e| e.to_string())?;
        Ok(MessageRow {
            id: id.clone(),
            conversation_id: conv_id.to_string(),
            sender_address: sender.to_string(),
            content: content_trimmed.to_string(),
            created_at,
            reply_to_id: r_id.map(String::from),
            reply_content: r_content.map(String::from),
            reply_sender: r_sender.map(String::from),
            reactions: Some("[]".to_string()),
            edited_at: None,
            updated_content: None,
        })
    }

    pub fn update_message(
        &self,
        message_id: &str,
        sender_address: &str,
        new_content: &str,
    ) -> Result<MessageRow, String> {
        let id = message_id.trim();
        if id.is_empty() {
            return Err("Invalid message id".into());
        }
        if !is_valid_address(sender_address.trim()) {
            return Err("Invalid sender address".into());
        }
        let content_trimmed = new_content.trim();
        if content_trimmed.is_empty() {
            return Err("Message cannot be empty".into());
        }
        if content_trimmed.len() > MAX_CONTENT_LEN {
            return Err(format!("Message too long (max {} characters)", MAX_CONTENT_LEN));
        }
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE messages SET content = ?1, edited_at = ?2, updated_content = ?3 WHERE id = ?4 AND sender_address = ?5",
            params![content_trimmed, now, content_trimmed, id, sender_address.trim()],
        )
        .map_err(|e| e.to_string())?;
        if conn.changes() == 0 {
            return Err("Message not found or not yours".into());
        }
        let mut stmt = conn.prepare("SELECT id, conversation_id, sender_address, content, created_at, reply_to_id, reply_content, reply_sender, reactions, edited_at, updated_content FROM messages WHERE id = ?1").map_err(|e| e.to_string())?;
        stmt.query_row(params![id], |row| {
            Ok(MessageRow {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                sender_address: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                reply_to_id: row.get::<_, Option<String>>(5).ok().flatten(),
                reply_content: row.get::<_, Option<String>>(6).ok().flatten(),
                reply_sender: row.get::<_, Option<String>>(7).ok().flatten(),
                reactions: row.get::<_, Option<String>>(8).ok().flatten(),
                edited_at: row.get::<_, Option<i64>>(9).ok().flatten(),
                updated_content: row.get::<_, Option<String>>(10).ok().flatten(),
            })
        }).map_err(|e| e.to_string())
    }

    pub fn add_reaction(
        &self,
        message_id: &str,
        user_address: &str,
        emoji: &str,
    ) -> Result<MessageRow, String> {
        let id = message_id.trim();
        if id.is_empty() {
            return Err("Invalid message id".into());
        }
        if !is_valid_address(user_address.trim()) {
            return Err("Invalid user address".into());
        }
        let emoji_trimmed = emoji.trim();
        if emoji_trimmed.is_empty() || emoji_trimmed.len() > 20 {
            return Err("Invalid emoji".into());
        }
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let reactions_json: String = conn.query_row(
            "SELECT COALESCE(reactions, '[]') FROM messages WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|_| "Message not found".to_string())?;
        let mut reactions: Vec<ReactionEntry> = serde_json::from_str(&reactions_json).unwrap_or_default();
        let user = user_address.trim().to_string();
        if let Some(ref mut entry) = reactions.iter_mut().find(|e| e.emoji == emoji_trimmed) {
            if entry.user_ids.contains(&user) {
                entry.user_ids.retain(|u| u != &user);
                if entry.user_ids.is_empty() {
                    reactions.retain(|e| e.emoji != emoji_trimmed);
                }
            } else {
                entry.user_ids.push(user);
            }
        } else {
            reactions.push(ReactionEntry { emoji: emoji_trimmed.to_string(), user_ids: vec![user] });
        }
        let new_json = serde_json::to_string(&reactions).map_err(|e| e.to_string())?;
        conn.execute("UPDATE messages SET reactions = ?1 WHERE id = ?2", params![new_json, id])
            .map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT id, conversation_id, sender_address, content, created_at, reply_to_id, reply_content, reply_sender, reactions, edited_at, updated_content FROM messages WHERE id = ?1").map_err(|e| e.to_string())?;
        stmt.query_row(params![id], |row| {
            Ok(MessageRow {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                sender_address: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                reply_to_id: row.get::<_, Option<String>>(5).ok().flatten(),
                reply_content: row.get::<_, Option<String>>(6).ok().flatten(),
                reply_sender: row.get::<_, Option<String>>(7).ok().flatten(),
                reactions: row.get::<_, Option<String>>(8).ok().flatten(),
                edited_at: row.get::<_, Option<i64>>(9).ok().flatten(),
                updated_content: row.get::<_, Option<String>>(10).ok().flatten(),
            })
        }).map_err(|e| e.to_string())
    }

    pub fn create_invoice(
        &self,
        conversation_id: &str,
        sender_address: &str,
        recipient_address: &str,
        amount_wei: &str,
        currency: &str,
        description: &str,
    ) -> Result<InvoiceRow, String> {
        validate_conversation_id(conversation_id)?;
        if !is_valid_address(sender_address.trim()) {
            return Err("Invalid sender address".into());
        }
        if !is_valid_address(recipient_address.trim()) {
            return Err("Invalid recipient address".into());
        }
        let amount = amount_wei.trim();
        if amount.is_empty() || amount.len() > MAX_AMOUNT_WEI_LEN {
            return Err("Invalid amount".into());
        }
        if !amount.chars().all(|c| c.is_ascii_digit()) {
            return Err("Amount must be a non-negative integer (wei)".into());
        }
        let curr = currency.trim();
        if curr.is_empty() || curr.len() > 20 {
            return Err("Invalid currency".into());
        }
        let desc = description.trim();
        if desc.len() > MAX_INVOICE_DESC_LEN {
            return Err(format!(
                "Description too long (max {} characters)",
                MAX_INVOICE_DESC_LEN
            ));
        }
        let sender = sender_address.trim();
        let recipient = recipient_address.trim();
        let conv_id = conversation_id.trim();
        let now = chrono::Utc::now().timestamp_millis();
        let id = format!("inv_{}_{}", sender, now);
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            INSERT INTO invoices (id, conversation_id, sender_address, recipient_address, amount_wei, currency, description, status, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8)
            "#,
            params![id, conv_id, sender, recipient, amount, curr, desc, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(InvoiceRow {
            id: id.clone(),
            conversation_id: conv_id.to_string(),
            sender_address: sender.to_string(),
            recipient_address: recipient.to_string(),
            amount_wei: amount.to_string(),
            currency: curr.to_string(),
            description: desc.to_string(),
            status: "pending".to_string(),
            tx_hash: None,
            decline_reason: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn get_invoices(&self, conversation_id: &str, my_address: &str) -> Result<Vec<InvoiceRow>, String> {
        validate_conversation_id(conversation_id)?;
        if !is_valid_address(my_address.trim()) {
            return Err("Invalid address".into());
        }
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, conversation_id, sender_address, recipient_address, amount_wei, currency, description, status, tx_hash, created_at, updated_at, decline_reason FROM invoices WHERE conversation_id = ?1 ORDER BY created_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![conversation_id.trim()], |row| {
                Ok(InvoiceRow {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    sender_address: row.get(2)?,
                    recipient_address: row.get(3)?,
                    amount_wei: row.get(4)?,
                    currency: row.get(5)?,
                    description: row.get(6)?,
                    status: row.get(7)?,
                    tx_hash: row.get(8).ok().flatten(),
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    decline_reason: row.get::<_, Option<String>>(11).ok().flatten(),
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    pub fn update_invoice_status(
        &self,
        invoice_id: &str,
        status: &str,
        tx_hash: Option<&str>,
        decline_reason: Option<&str>,
    ) -> Result<InvoiceRow, String> {
        if invoice_id.trim().is_empty() {
            return Err("Invalid invoice id".into());
        }
        let s = status.trim().to_lowercase();
        if s != "paid" && s != "declined" {
            return Err("Status must be paid or declined".into());
        }
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.0.lock().map_err(|e| e.to_string())?;
        let tx = tx_hash.map(|h| h.trim()).filter(|h| !h.is_empty());
        let reason = decline_reason.map(|r| r.trim()).filter(|r| !r.is_empty());
        conn.execute(
            "UPDATE invoices SET status = ?1, tx_hash = ?2, decline_reason = ?3, updated_at = ?4 WHERE id = ?5",
            params![s, tx, reason, now, invoice_id.trim()],
        )
        .map_err(|e| e.to_string())?;
        if conn.changes() == 0 {
            return Err("Invoice not found".into());
        }
        let id = invoice_id.trim();
        let mut stmt = conn
            .prepare("SELECT id, conversation_id, sender_address, recipient_address, amount_wei, currency, description, status, tx_hash, created_at, updated_at, decline_reason FROM invoices WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let row = stmt
            .query_row(params![id], |row| {
                Ok(InvoiceRow {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    sender_address: row.get(2)?,
                    recipient_address: row.get(3)?,
                    amount_wei: row.get(4)?,
                    currency: row.get(5)?,
                    description: row.get(6)?,
                    status: row.get(7)?,
                    tx_hash: row.get(8).ok().flatten(),
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    decline_reason: row.get::<_, Option<String>>(11).ok().flatten(),
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(row)
    }
}
