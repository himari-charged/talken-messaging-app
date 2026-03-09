import { useState, useRef, useEffect } from "react";
import { Send, Plus, Paperclip, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH } from "@/lib/chatApi";
import type { Message } from "@/types/chat";

const EMOJI_LIST = ["😀", "😂", "❤️", "👍", "🔥", "👋", "🙏", "✨", "🎉", "💯"];

interface MessageInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
  replyTo?: Message | null;
  onClearReply?: () => void;
  otherParticipantName?: string;
}

export function MessageInput({ onSend, placeholder = "Type a message...", replyTo, onClearReply, otherParticipantName }: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const minRows = 1;
  const maxRows = 6;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const rows = Math.min(maxRows, Math.max(minRows, (ta.scrollHeight / 24) | 0));
    ta.rows = rows;
    ta.style.height = "";
  }, [text]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-card p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" title="Add">
            <Plus className="h-5 w-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" title="Attachment">
            <Paperclip className="h-5 w-5" />
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(showEmoji && "bg-accent text-accent-foreground")}
              title="Emoji"
              onClick={() => setShowEmoji((v) => !v)}
            >
              <Smile className="h-5 w-5" />
            </Button>
            {showEmoji && (
              <>
                <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-border bg-popover p-2 shadow-md">
                  <div className="grid grid-cols-5 gap-1">
                    {EMOJI_LIST.map((emoji) => (
                      <Button
                        key={emoji}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-lg"
                        onClick={() => {
                          setText((t) => t + emoji);
                          setShowEmoji(false);
                        }}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="fixed inset-0 z-0"
                  onClick={() => setShowEmoji(false)}
                  aria-hidden
                />
              </>
            )}
          </div>
        </div>
        <div className="flex min-h-[44px] flex-1 flex-col rounded-lg border border-input bg-background px-3 py-2">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded border-l-2 border-primary bg-muted/50 pl-2 pr-1 py-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">Replying to {replyTo.isOutgoing ? "yourself" : otherParticipantName ?? "Unknown"}</p>
                <p className="truncate text-xs text-muted-foreground">{replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}</p>
              </div>
              {onClearReply && (
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClearReply} aria-label="Cancel reply">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={minRows}
            className="min-h-[24px] max-h-[120px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {text.length > MAX_MESSAGE_LENGTH * 0.9 && (
            <span className="text-right text-xs text-muted-foreground">
              {text.length} / {MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || text.length > MAX_MESSAGE_LENGTH}
          className="shrink-0 rounded-full"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
