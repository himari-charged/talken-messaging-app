import { useState } from "react";
import { Copy, Reply, Check, CheckCheck, Pencil, Check as CheckIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Message } from "@/types/chat";
import { MAX_MESSAGE_LENGTH } from "@/lib/chatApi";

const QUICK_REACTIONS = ["👍", "❤️", "😂"];

interface MessageBubbleProps {
  message: Message;
  showAvatar: boolean;
  senderName: string;
  onReply?: (message: Message) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  currentUserId?: string;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
  if (status === "delivered" || status === "sent") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Check className="h-3.5 w-3.5 animate-pulse text-muted-foreground" />;
}

export function MessageBubble({ message, showAvatar, senderName, onReply, onReaction, onEditMessage, currentUserId }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isOwn = message.senderId.toLowerCase() === currentUserId?.toLowerCase();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setShowActions(false);
  };

  const handleReactionClick = (emoji: string) => {
    onReaction?.(message.id, emoji);
    setShowReactions(false);
  };

  const handleSaveEdit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content && onEditMessage && trimmed.length <= MAX_MESSAGE_LENGTH) {
      onEditMessage(message.id, trimmed);
      setIsEditing(false);
    } else {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  return (
    <div
      className={cn("group flex gap-2 py-1", message.isOutgoing && "flex-row-reverse")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactions(false);
      }}
    >
      <div className={cn("w-8 shrink-0", message.isOutgoing && "hidden")}>
        {showAvatar ? (
          <Avatar className="h-8 w-8 rounded-full">
            <AvatarFallback className="rounded-full bg-muted text-xs font-medium text-foreground">
              {senderName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-8 w-8" />
        )}
      </div>

      <div className={cn("flex max-w-[60%] flex-col items-start", message.isOutgoing && "items-end")}>
        {showAvatar && !message.isOutgoing && (
          <span className="mb-0.5 text-xs font-medium text-muted-foreground">{senderName}</span>
        )}
        <div className="relative">
          {message.replyTo && (
            <div className="mb-1 border-l-2 border-primary pl-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{message.replyTo.senderName}</span>
              <p className="truncate">{message.replyTo.content}</p>
            </div>
          )}
          {isEditing ? (
            <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                className="min-h-[60px] resize-none border-0 bg-transparent text-sm text-foreground focus-visible:ring-0"
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" onClick={handleSaveEdit} disabled={!editContent.trim() || editContent.trim() === message.content}>
                  <CheckIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 shadow-sm",
                message.isOutgoing ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}
            >
              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
            </div>
          )}
          {showActions && !isEditing && (
            <div
              className={cn(
                "absolute top-1/2 z-10 flex -translate-y-1/2 gap-0.5 rounded-lg border border-border bg-card p-1 shadow-md",
                message.isOutgoing ? "left-0 -translate-x-full -ml-2" : "right-0 translate-x-full ml-2"
              )}
            >
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={copyToClipboard} title="Copy">
                <Copy className="h-4 w-4" />
              </Button>
              {onReply && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onReply(message)} title="Reply">
                  <Reply className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowReactions((v) => !v)} title="React">
                <span className="text-sm">😀</span>
              </Button>
              {isOwn && onEditMessage && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsEditing(true); setEditContent(message.content); }} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {showReactions && (
            <div
              className={cn(
                "absolute top-full z-10 mt-1 flex gap-1 rounded-lg border border-border bg-card p-1.5 shadow-md",
                message.isOutgoing ? "left-0" : "right-0"
              )}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <Button
                  key={emoji}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-lg"
                  onClick={() => handleReactionClick(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {message.editedAt && (
            <span className="text-[10px] text-muted-foreground italic">edited</span>
          )}
          {message.isOutgoing && <StatusIcon status={message.status} />}
        </div>
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r, i) => (
              <button
                key={i}
                type="button"
                className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground hover:bg-muted/80"
                onClick={() => onReaction?.(message.id, r.emoji)}
                title="Toggle reaction"
              >
                {r.emoji} {r.userIds.length > 0 && r.userIds.length}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
