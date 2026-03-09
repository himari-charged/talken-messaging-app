import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Chat } from "@/types/chat";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  loading?: boolean;
  currentUserId?: string;
}

function formatTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 172800000) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  searchQuery,
  onSearchChange,
  loading = false,
  currentUserId = "",
}: ChatListProps) {
  return (
    <div className="flex w-[320px] shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : (
            chats.map((chat) => {
              const isSelected = selectedChatId === chat.id;
              const lastMsg = chat.lastMessage;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12 rounded-full">
                      <AvatarFallback className="rounded-full bg-muted text-base font-semibold">
                        {chat.participant.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {chat.participant.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{chat.participant.name}</span>
                      {lastMsg && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatTime(lastMsg.timestamp)}
                        </span>
                      )}
                    </div>
                    {lastMsg && (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {currentUserId && lastMsg.senderId?.toLowerCase() === currentUserId.toLowerCase()
                          ? "You: "
                          : ""}
                        {lastMsg.content}
                      </p>
                    )}
                  </div>
                  {chat.unreadCount > 0 && (
                    <Badge variant="default" className="shrink-0">
                      {chat.unreadCount}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
