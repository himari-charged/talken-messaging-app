/**
 * Chat API - Tauri invoke commands for conversations and messages.
 * All inputs are validated before invoke for security.
 */
import { invoke } from "@tauri-apps/api/core";
import { isValidAddress } from "@/lib/quai";

/** Max message length (chars) to prevent abuse and storage bloat */
export const MAX_MESSAGE_LENGTH = 10_000;

/** Max conversation id length (two addresses + separator) */
const MAX_CONVERSATION_ID_LENGTH = 200;

/** Max invoice description length (must match backend) */
const MAX_INVOICE_DESC_LENGTH = 2_000;

export interface ConversationRow {
  id: string;
  other_address: string;
  last_content: string | null;
  last_at: number | null;
  last_sender_address: string | null;
  unread_count: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_address: string;
  content: string;
  created_at: number;
  reply_to_id?: string | null;
  reply_content?: string | null;
  reply_sender?: string | null;
  reactions?: string | null;
  edited_at?: number | null;
  updated_content?: string | null;
}

export interface InvoiceRow {
  id: string;
  conversation_id: string;
  sender_address: string;
  recipient_address: string;
  amount_wei: string;
  currency: string;
  description: string;
  status: string;
  tx_hash: string | null;
  decline_reason: string | null;
  created_at: number;
  updated_at: number;
}

export async function getOrCreateConversation(
  myAddress: string,
  otherAddress: string
): Promise<string> {
  const my = myAddress?.trim();
  const other = otherAddress?.trim();
  if (!my || !other) throw new Error("Addresses required");
  if (!isValidAddress(my)) throw new Error("Invalid sender address");
  if (!isValidAddress(other)) throw new Error("Invalid recipient address");
  if (my.toLowerCase() === other.toLowerCase()) throw new Error("Cannot create conversation with self");
  return invoke<string>("get_or_create_conversation", {
    myAddress: my,
    otherAddress: other,
  });
}

export async function getConversations(myAddress: string): Promise<ConversationRow[]> {
  const my = myAddress?.trim();
  if (!my || !isValidAddress(my)) throw new Error("Invalid address");
  return invoke<ConversationRow[]>("get_conversations", { myAddress: my });
}

export async function getMessages(
  conversationId: string,
  myAddress: string
): Promise<MessageRow[]> {
  const id = conversationId?.trim();
  const my = myAddress?.trim();
  if (!id || id.length > MAX_CONVERSATION_ID_LENGTH) throw new Error("Invalid conversation");
  if (!my || !isValidAddress(my)) throw new Error("Invalid address");
  return invoke<MessageRow[]>("get_messages", {
    conversationId: id,
    myAddress: my,
  });
}

export async function sendMessage(
  conversationId: string,
  senderAddress: string,
  content: string,
  replyTo?: { id: string; content: string; senderName: string } | null
): Promise<MessageRow> {
  const id = conversationId?.trim();
  const sender = senderAddress?.trim();
  const text = typeof content === "string" ? content.trim() : "";
  if (!id || id.length > MAX_CONVERSATION_ID_LENGTH) throw new Error("Invalid conversation");
  if (!sender || !isValidAddress(sender)) throw new Error("Invalid sender address");
  if (text.length === 0) throw new Error("Message cannot be empty");
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
  return invoke<MessageRow>("send_message", {
    conversationId: id,
    senderAddress: sender,
    content: text,
    replyToId: replyTo?.id ?? null,
    replyContent: replyTo?.content ?? null,
    replySender: replyTo?.senderName ?? null,
  });
}

export async function updateMessage(
  messageId: string,
  senderAddress: string,
  newContent: string
): Promise<MessageRow> {
  const id = messageId?.trim();
  const sender = senderAddress?.trim();
  const text = typeof newContent === "string" ? newContent.trim() : "";
  if (!id) throw new Error("Invalid message id");
  if (!sender || !isValidAddress(sender)) throw new Error("Invalid sender address");
  if (text.length === 0) throw new Error("Message cannot be empty");
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
  return invoke<MessageRow>("update_message", {
    messageId: id,
    senderAddress: sender,
    newContent: text,
  });
}

export async function addReaction(
  messageId: string,
  userAddress: string,
  emoji: string
): Promise<MessageRow> {
  const id = messageId?.trim();
  const user = userAddress?.trim();
  const e = emoji?.trim();
  if (!id) throw new Error("Invalid message id");
  if (!user || !isValidAddress(user)) throw new Error("Invalid user address");
  if (!e) throw new Error("Emoji required");
  return invoke<MessageRow>("add_reaction", {
    messageId: id,
    userAddress: user,
    emoji: e,
  });
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function createInvoice(
  conversationId: string,
  senderAddress: string,
  recipientAddress: string,
  amountWei: string,
  currency: string,
  description: string
): Promise<InvoiceRow> {
  const id = conversationId?.trim();
  const sender = senderAddress?.trim();
  const recipient = recipientAddress?.trim();
  const amount = amountWei?.trim();
  const curr = currency?.trim();
  const desc = description?.trim() ?? "";
  if (!id || id.length > MAX_CONVERSATION_ID_LENGTH) throw new Error("Invalid conversation");
  if (!sender || !isValidAddress(sender)) throw new Error("Invalid sender address");
  if (!recipient || !isValidAddress(recipient)) throw new Error("Invalid recipient address");
  if (!amount || BigInt(amount) <= 0n) throw new Error("Amount must be positive");
  if (!curr) throw new Error("Currency required");
  if (desc.length > MAX_INVOICE_DESC_LENGTH) throw new Error(`Description too long (max ${MAX_INVOICE_DESC_LENGTH})`);
  return invoke<InvoiceRow>("create_invoice", {
    conversationId: id,
    senderAddress: sender,
    recipientAddress: recipient,
    amountWei: amount,
    currency: curr,
    description: desc,
  });
}

export async function getInvoices(
  conversationId: string,
  myAddress: string
): Promise<InvoiceRow[]> {
  const id = conversationId?.trim();
  const my = myAddress?.trim();
  if (!id || id.length > MAX_CONVERSATION_ID_LENGTH) throw new Error("Invalid conversation");
  if (!my || !isValidAddress(my)) throw new Error("Invalid address");
  return invoke<InvoiceRow[]>("get_invoices", {
    conversationId: id,
    myAddress: my,
  });
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: "paid" | "declined",
  txHash?: string | null,
  declineReason?: string | null
): Promise<InvoiceRow> {
  const id = invoiceId?.trim();
  if (!id) throw new Error("Invalid invoice id");
  return invoke<InvoiceRow>("update_invoice_status", {
    invoiceId: id,
    status,
    txHash: txHash ?? null,
    declineReason: declineReason ?? null,
  });
}

export { shortAddress };
