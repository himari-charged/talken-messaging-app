import { UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { shortAddress } from "@/lib/chatApi";
import { cn } from "@/lib/utils";

export interface ChatRequest {
  id: string;
  fromAddress: string;
  message?: string;
  requestedAt: Date;
}

interface RequestsPanelProps {
  requests: ChatRequest[];
  onAccept: (request: ChatRequest) => void;
  onDecline: (request: ChatRequest) => void;
  loading?: boolean;
  onAddSampleRequest?: () => void;
}

export function RequestsPanel({ requests, onAccept, onDecline, loading, onAddSampleRequest }: RequestsPanelProps) {
  return (
    <div className="flex flex-1 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">Requests</h2>
        <p className="text-sm text-muted-foreground">Incoming chat requests from other users</p>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : requests.length === 0 ? (
          <Card className="m-4 border-dashed">
            <CardHeader>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <UserPlus className="h-7 w-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-center">No pending requests</CardTitle>
              <CardDescription className="text-center">
                When someone wants to start a chat with you, they&apos;ll appear here. You can accept or decline.
              </CardDescription>
              {onAddSampleRequest && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm" onClick={onAddSampleRequest}>
                    Add sample request
                  </Button>
                </div>
              )}
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col p-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className={cn(
                  "flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-accent/50"
                )}
              >
                <Avatar className="h-12 w-12 shrink-0 rounded-full">
                  <AvatarFallback className="rounded-full bg-muted text-sm font-semibold">
                    {req.fromAddress.slice(2, 4).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{shortAddress(req.fromAddress)}</p>
                  {req.message && (
                    <p className="truncate text-sm text-muted-foreground">{req.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {req.requestedAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => onDecline(req)}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => onAccept(req)}>
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
