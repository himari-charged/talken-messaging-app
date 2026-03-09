export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  isOutgoing: boolean;
  reactions?: { emoji: string; userIds: string[] }[];
  replyTo?: { id: string; content: string; senderName: string };
  editedAt?: number;
}

export interface Chat {
  id: string;
  participant: User;
  lastMessage?: Pick<Message, "content" | "timestamp" | "senderId">;
  unreadCount: number;
  isOnline?: boolean;
  lastSeen?: Date;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  wallet?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

export type SidebarTab = "chats" | "requests" | "settings";

export type InvoiceStatus = "pending" | "paid" | "declined";

export interface Invoice {
  id: string;
  conversationId: string;
  senderAddress: string;
  recipientAddress: string;
  amountWei: string;
  currency: string;
  description: string;
  status: InvoiceStatus;
  txHash: string | null;
  declineReason: string | null;
  createdAt: number;
  updatedAt: number;
}
