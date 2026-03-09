import { FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatWeiToQuai } from "@/lib/quai";
import { shortAddress } from "@/lib/chatApi";
import type { Invoice } from "@/types/chat";
import { cn } from "@/lib/utils";

interface InvoiceCardProps {
  invoice: Invoice;
  /** Current user's address - if this is the recipient and status is pending, show Pay/Decline */
  currentUserAddress: string;
  isOutgoing: boolean;
  onPay?: (invoice: Invoice) => void;
  onDecline?: (invoice: Invoice) => void;
  paying?: boolean;
  declining?: boolean;
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  if (status === "paid")
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Paid
      </Badge>
    );
  if (status === "declined")
    return (
      <Badge variant="secondary">
        <XCircle className="mr-1 h-3 w-3" />
        Declined
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-amber-500/60 text-amber-600 dark:text-amber-400">
      Pending
    </Badge>
  );
}

export function InvoiceCard({
  invoice,
  currentUserAddress,
  isOutgoing,
  onPay,
  onDecline,
  paying,
  declining,
}: InvoiceCardProps) {
  const isRecipient =
    invoice.recipientAddress.toLowerCase() === currentUserAddress.toLowerCase();
  const canRespond = isRecipient && invoice.status === "pending" && (onPay || onDecline);
  const amountDisplay = formatWeiToQuai(invoice.amountWei);

  return (
    <Card
      className={cn(
        "w-full max-w-md overflow-hidden",
        isOutgoing && "ml-auto"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Invoice</p>
            <p className="text-xs text-muted-foreground">
              {isOutgoing
                ? `To ${shortAddress(invoice.recipientAddress)}`
                : `From ${shortAddress(invoice.senderAddress)}`}
            </p>
          </div>
        </div>
        <StatusBadge status={invoice.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">
            {amountDisplay} {invoice.currency}
          </span>
        </div>
        {invoice.description ? (
          <p className="text-sm text-muted-foreground">{invoice.description}</p>
        ) : null}
        {invoice.status === "paid" && invoice.txHash && (
          <p className="truncate font-mono text-xs text-muted-foreground" title={invoice.txHash}>
            Tx: {invoice.txHash.slice(0, 10)}...{invoice.txHash.slice(-8)}
          </p>
        )}
        {invoice.status === "declined" && invoice.declineReason && (
          <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Reason declined</p>
            <p className="text-sm text-foreground">{invoice.declineReason}</p>
          </div>
        )}
        {canRespond && (
          <div className="flex gap-2 pt-2">
            {onPay && (
              <Button
                size="sm"
                onClick={() => onPay(invoice)}
                disabled={paying || declining}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Pay"
                )}
              </Button>
            )}
            {onDecline && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecline(invoice)}
                disabled={paying || declining}
              >
                {declining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Declining...
                  </>
                ) : (
                  "Decline"
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
