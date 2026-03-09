import { useRef, useEffect, useState, useMemo } from "react";
import { MessageBubble } from "./MessageBubble";
import { InvoiceCard } from "./InvoiceCard";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Message, Invoice } from "@/types/chat";

type TimelineItem =
  | { type: "message"; time: number; message: Message }
  | { type: "invoice"; time: number; invoice: Invoice };

interface MessageListProps {
  messages: Message[];
  invoices?: Invoice[];
  currentUserId: string;
  otherParticipantName: string;
  typing?: boolean;
  onReply?: (message: Message) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  unreadFromId?: string | null;
  onPayInvoice?: (invoice: Invoice) => void;
  onDeclineInvoice?: (invoice: Invoice) => void;
  payingInvoiceId?: string | null;
  decliningInvoiceId?: string | null;
}

export function MessageList({
  messages,
  invoices = [],
  currentUserId,
  otherParticipantName,
  typing,
  onReply,
  onReaction,
  onEditMessage,
  unreadFromId,
  onPayInvoice,
  onDeclineInvoice,
  payingInvoiceId,
  decliningInvoiceId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const prevTimelineLengthRef = useRef(0);

  const timeline = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [
      ...messages.map((m) => ({ type: "message" as const, time: m.timestamp.getTime(), message: m })),
      ...invoices.map((inv) => ({ type: "invoice" as const, time: inv.createdAt, invoice: inv })),
    ];
    items.sort((a, b) => a.time - b.time);
    return items;
  }, [messages, invoices]);

  // Only scroll to bottom when a new message/invoice is added or typing appears, not when reactions/edit update
  useEffect(() => {
    const prevLen = prevTimelineLengthRef.current;
    const newLen = timeline.length;
    const hasNewItem = newLen > prevLen;
    prevTimelineLengthRef.current = newLen;
    if (hasNewItem || typing) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [timeline.length, typing]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 120);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const senderNames: Record<string, string> = {
    [currentUserId]: "You",
  };
  messages.forEach((m) => {
    if (!senderNames[m.senderId]) senderNames[m.senderId] = otherParticipantName;
  });

  let prevSenderId: string | null = null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl space-y-0.5">
        {timeline.map((item) => {
          if (item.type === "message") {
            const msg = item.message;
            const showAvatar = prevSenderId !== msg.senderId;
            prevSenderId = msg.senderId;
            const showUnreadDivider = unreadFromId === msg.id;

            return (
              <div key={msg.id}>
                {showUnreadDivider && (
                  <div className="flex items-center gap-4 py-4">
                    <Separator className="flex-1" />
                    <span className="text-xs font-medium text-muted-foreground">New Messages</span>
                    <Separator className="flex-1" />
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  showAvatar={showAvatar}
                  senderName={senderNames[msg.senderId] ?? "Unknown"}
                  onReply={onReply}
                  onReaction={onReaction}
                  onEditMessage={onEditMessage}
                  currentUserId={currentUserId}
                />
              </div>
            );
          }
          const inv = item.invoice;
          const isOutgoing = inv.senderAddress.toLowerCase() === currentUserId.toLowerCase();
          return (
            <div key={inv.id} className="py-2">
              <InvoiceCard
                invoice={inv}
                currentUserAddress={currentUserId}
                isOutgoing={isOutgoing}
                onPay={onPayInvoice}
                onDecline={onDeclineInvoice}
                paying={payingInvoiceId === inv.id}
                declining={decliningInvoiceId === inv.id}
              />
            </div>
          );
        })}
        {typing && (
          <div className="flex items-center gap-2 py-2 text-sm italic text-muted-foreground">
            <span className="inline-flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            </span>
            typing...
          </div>
        )}
        </div>
        <div ref={bottomRef} />
      </div>
      {showScrollToBottom && (
        <Button
          type="button"
          size="icon"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-6 right-10 z-10 rounded-full shadow-lg"
          aria-label="Scroll to latest messages"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
