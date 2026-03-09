import { Phone, Video, MoreHorizontal, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/chat";

interface ChatHeaderProps {
  user: User;
  isTyping?: boolean;
  onRequestInvoice?: () => void;
}

export function ChatHeader({ user, isTyping, onRequestInvoice }: ChatHeaderProps) {
  const statusText = isTyping ? "typing..." : user.isOnline ? "Online" : user.lastSeen ? `Last seen ${formatLastSeen(user.lastSeen)}` : "Offline";

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-12 w-12 rounded-full">
            <AvatarFallback className="rounded-full bg-muted text-lg font-semibold">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {user.isOnline && !isTyping && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </div>
        <div>
          <h1 className="font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {user.wallet && `@${user.wallet}`}
            {user.username && ` · ${user.username}`}
          </p>
          <p className={cn("text-xs", isTyping ? "text-primary italic" : "text-muted-foreground")}>
            {statusText}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onRequestInvoice && (
          <Button variant="ghost" size="icon" onClick={onRequestInvoice} title="Request payment">
            <FileText className="h-5 w-5" />
          </Button>
        )}
        <Button variant="ghost" size="icon">
          <Phone className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <Video className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

function formatLastSeen(date: Date) {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}
