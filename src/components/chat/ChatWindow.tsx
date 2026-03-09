import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { Chat, Message, Invoice } from "@/types/chat";

interface ChatWindowProps {
  chat: Chat | null;
  messages: Message[];
  invoices?: Invoice[];
  isTyping?: boolean;
  unreadFromId?: string | null;
  currentUserId: string;
  onSendMessage: (content: string) => void;
  replyToMessage?: Message | null;
  onClearReply?: () => void;
  onReply?: (message: Message) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRequestInvoice?: () => void;
  onPayInvoice?: (invoice: Invoice) => void;
  onDeclineInvoice?: (invoice: Invoice) => void;
  payingInvoiceId?: string | null;
  decliningInvoiceId?: string | null;
  loadingMessages?: boolean;
}

export function ChatWindow({
  chat,
  messages,
  invoices = [],
  isTyping,
  unreadFromId,
  currentUserId,
  onSendMessage,
  replyToMessage,
  onClearReply,
  onReply,
  onReaction,
  onEditMessage,
  onRequestInvoice,
  onPayInvoice,
  onDeclineInvoice,
  payingInvoiceId,
  decliningInvoiceId,
  loadingMessages = false,
}: ChatWindowProps) {
  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background text-muted-foreground">
        <p className="text-lg">Select a chat or start a new conversation</p>
      </div>
    );
  }
  if (loadingMessages) {
    return (
      <div className="flex flex-1 flex-col bg-background">
        <ChatHeader user={chat.participant} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ChatHeader user={chat.participant} isTyping={isTyping} onRequestInvoice={onRequestInvoice} />
      <MessageList
        messages={messages}
        invoices={invoices}
        currentUserId={currentUserId}
        otherParticipantName={chat.participant.name}
        typing={isTyping}
        onReply={onReply}
        onReaction={onReaction}
        onEditMessage={onEditMessage}
        unreadFromId={unreadFromId}
        onPayInvoice={onPayInvoice}
        onDeclineInvoice={onDeclineInvoice}
        payingInvoiceId={payingInvoiceId}
        decliningInvoiceId={decliningInvoiceId}
      />
      <MessageInput
        onSend={onSendMessage}
        replyTo={replyToMessage}
        onClearReply={onClearReply}
        otherParticipantName={chat.participant.name}
      />
    </div>
  );
}
