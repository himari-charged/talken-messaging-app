import { useState, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { ChatList } from "./ChatList";
import { ChatWindow } from "./ChatWindow";
import { RequestsPanel, type ChatRequest } from "./RequestsPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { SidebarTab, Message, Chat, User, Invoice } from "@/types/chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  updateMessage as apiUpdateMessage,
  addReaction as apiAddReaction,
  getOrCreateConversation,
  getInvoices,
  createInvoice as apiCreateInvoice,
  updateInvoiceStatus,
  shortAddress,
  type ConversationRow,
  type MessageRow,
  type InvoiceRow,
} from "@/lib/chatApi";
import { isValidAddress, sendTransaction, parseQuaiToWei } from "@/lib/quai";
import {
  requestNotificationPermission,
  showNewMessageNotification,
} from "@/lib/notifications";

function rowToChat(row: ConversationRow): Chat {
  const participant: User = {
    id: row.other_address,
    name: shortAddress(row.other_address),
    wallet: row.other_address,
  };
  return {
    id: row.id,
    participant,
    lastMessage: row.last_content
      ? {
          content: row.last_content,
          timestamp: new Date(row.last_at ?? 0),
          senderId: row.last_sender_address ?? row.other_address,
        }
      : undefined,
    unreadCount: row.unread_count,
  };
}

function rowToMessage(row: MessageRow, myAddress: string): Message {
  const content = row.updated_content ?? row.content;
  let reactions: { emoji: string; userIds: string[] }[] = [];
  if (row.reactions) {
    try {
      reactions = JSON.parse(row.reactions) as { emoji: string; userIds: string[] }[];
    } catch {
      // ignore invalid json
    }
  }
  return {
    id: row.id,
    chatId: row.conversation_id,
    senderId: row.sender_address,
    content,
    timestamp: new Date(row.created_at),
    status: "read",
    isOutgoing: row.sender_address.toLowerCase() === myAddress.toLowerCase(),
    replyTo:
      row.reply_to_id && row.reply_content != null && row.reply_sender != null
        ? { id: row.reply_to_id, content: row.reply_content, senderName: row.reply_sender }
        : undefined,
    reactions: reactions.length > 0 ? reactions : undefined,
    editedAt: row.edited_at ?? undefined,
  };
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderAddress: row.sender_address,
    recipientAddress: row.recipient_address,
    amountWei: row.amount_wei,
    currency: row.currency,
    description: row.description,
    status: row.status as Invoice["status"],
    txHash: row.tx_hash ?? null,
    declineReason: row.decline_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function ChatApp() {
  const { session, profile, wallet } = useAuth();
  const myAddress = session?.address ?? "";

  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [invoicesByChat, setInvoicesByChat] = useState<Record<string, Invoice[]>>({});
  const [unreadFromId, setUnreadFromId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newChatAddress, setNewChatAddress] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [decliningInvoiceId, setDecliningInvoiceId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [declineModalInvoice, setDeclineModalInvoice] = useState<Invoice | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const lastNotifiedMessageIdRef = useRef<Record<string, string>>({});

  const displayName = profile.displayName?.trim() || session?.shortAddress || "You";
  const currentUser: User = {
    id: myAddress,
    name: displayName,
    wallet: myAddress,
    avatar: profile.profileImageUrl ?? undefined,
    isOnline: true,
  };

  const refreshConversations = useCallback(async () => {
    if (!myAddress) return;
    setLoadingChats(true);
    try {
      const rows = await getConversations(myAddress);
      setChats(rows.map(rowToChat));
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setLoadingChats(false);
    }
  }, [myAddress]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!selectedChatId || !myAddress) return;
    setLoadingMessages(true);
    getMessages(selectedChatId, myAddress)
      .then((rows) => {
        setMessagesByChat((prev) => ({
          ...prev,
          [selectedChatId]: rows.map((r) => rowToMessage(r, myAddress)),
        }));
      })
      .catch((e) => console.error("Failed to load messages", e))
      .finally(() => setLoadingMessages(false));
  }, [selectedChatId, myAddress]);

  useEffect(() => {
    if (!selectedChatId || !myAddress) return;
    getInvoices(selectedChatId, myAddress)
      .then((rows) => {
        setInvoicesByChat((prev) => ({
          ...prev,
          [selectedChatId]: rows.map(rowToInvoice),
        }));
      })
      .catch((e) => console.error("Failed to load invoices", e));
  }, [selectedChatId, myAddress]);

  useEffect(() => {
    if (!selectedChatId) return;
    const t = setTimeout(() => setIsTyping(true), 500);
    const t2 = setTimeout(() => setIsTyping(false), 3000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [selectedChatId]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // When tab is hidden, poll for new messages and show notifications
  useEffect(() => {
    if (!myAddress) return;
    const poll = async () => {
      if (!document.hidden) return;
      try {
        const rows = await getConversations(myAddress);
        for (const row of rows) {
          if (row.unread_count <= 0) continue;
          const convId = row.id;
          const otherName = shortAddress(row.other_address);
          const rowsMsgs = await getMessages(convId, myAddress);
          const msgs = rowsMsgs.map((r) => rowToMessage(r, myAddress));
          const lastMsg = msgs[msgs.length - 1];
          if (!lastMsg || lastMsg.isOutgoing) continue;
          const lastNotified = lastNotifiedMessageIdRef.current[convId];
          if (lastNotified === lastMsg.id) continue;
          lastNotifiedMessageIdRef.current[convId] = lastMsg.id;
          showNewMessageNotification(otherName, lastMsg.content);
        }
      } catch {
        // ignore
      }
    };
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [myAddress]);

  const selectedChat = selectedChatId ? chats.find((c) => c.id === selectedChatId) ?? null : null;
  const messages = selectedChatId ? messagesByChat[selectedChatId] ?? [] : [];
  const invoices = selectedChatId ? invoicesByChat[selectedChatId] ?? [] : [];

  const refreshInvoicesForChat = useCallback(
    async (conversationId: string) => {
      if (!myAddress) return;
      try {
        const rows = await getInvoices(conversationId, myAddress);
        setInvoicesByChat((prev) => ({
          ...prev,
          [conversationId]: rows.map(rowToInvoice),
        }));
      } catch (e) {
        console.error("Failed to refresh invoices", e);
      }
    },
    [myAddress]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedChatId || !myAddress) return;
      const replyTo = replyToMessage
        ? { id: replyToMessage.id, content: replyToMessage.content, senderName: replyToMessage.isOutgoing ? "You" : (selectedChat?.participant.name ?? "Unknown") }
        : undefined;
      setReplyToMessage(null);
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        chatId: selectedChatId,
        senderId: myAddress,
        content,
        timestamp: new Date(),
        status: "sending",
        isOutgoing: true,
        replyTo: replyToMessage ? { id: replyToMessage.id, content: replyToMessage.content.slice(0, 50), senderName: replyToMessage.isOutgoing ? "You" : (selectedChat?.participant.name ?? "Unknown") } : undefined,
      };
      setMessagesByChat((prev) => ({
        ...prev,
        [selectedChatId]: [...(prev[selectedChatId] ?? []), optimistic],
      }));
      try {
        const row = await apiSendMessage(selectedChatId, myAddress, content, replyTo ?? undefined);
        setMessagesByChat((prev) => ({
          ...prev,
          [selectedChatId]: [
            ...(prev[selectedChatId] ?? []).filter((m) => m.id !== optimistic.id),
            rowToMessage(row, myAddress),
          ],
        }));
        await refreshConversations();
      } catch (e) {
        console.error("Send failed", e);
        setMessagesByChat((prev) => ({
          ...prev,
          [selectedChatId]: (prev[selectedChatId] ?? []).map((m) =>
            m.id === optimistic.id ? { ...m, status: "sent" as const } : m
          ),
        }));
      }
    },
    [selectedChatId, myAddress, refreshConversations, replyToMessage, selectedChat]
  );

  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
  }, []);

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!selectedChatId || !myAddress) return;
      try {
        const row = await apiAddReaction(messageId, myAddress, emoji);
        setMessagesByChat((prev) => ({
          ...prev,
          [selectedChatId]: (prev[selectedChatId] ?? []).map((m) =>
            m.id === messageId ? rowToMessage(row, myAddress) : m
          ),
        }));
      } catch (e) {
        console.error("Reaction failed", e);
      }
    },
    [selectedChatId, myAddress]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!selectedChatId || !myAddress) return;
      try {
        const row = await apiUpdateMessage(messageId, myAddress, newContent);
        setMessagesByChat((prev) => ({
          ...prev,
          [selectedChatId]: (prev[selectedChatId] ?? []).map((m) =>
            m.id === messageId ? rowToMessage(row, myAddress) : m
          ),
        }));
        await refreshConversations();
      } catch (e) {
        console.error("Edit failed", e);
      }
    },
    [selectedChatId, myAddress, refreshConversations]
  );

  const handleCreateInvoice = useCallback(async () => {
    if (!selectedChatId || !selectedChat || !myAddress) return;
    const amountTrim = invoiceAmount.trim();
    if (!amountTrim) {
      setInvoiceError("Enter an amount");
      return;
    }
    const wei = parseQuaiToWei(amountTrim);
    if (BigInt(wei) <= 0n) {
      setInvoiceError("Amount must be positive");
      return;
    }
    setInvoiceError(null);
    try {
      await apiCreateInvoice(
        selectedChatId,
        myAddress,
        selectedChat.participant.id,
        wei,
        "QUAI",
        invoiceDescription.trim()
      );
      await refreshInvoicesForChat(selectedChatId);
      setShowCreateInvoice(false);
      setInvoiceAmount("");
      setInvoiceDescription("");
    } catch (e) {
      setInvoiceError(e instanceof Error ? e.message : "Failed to create invoice");
    }
  }, [selectedChatId, selectedChat, myAddress, invoiceAmount, invoiceDescription, refreshInvoicesForChat]);

  const handlePayInvoice = useCallback(
    async (invoice: Invoice) => {
      if (!wallet) {
        setPayError("Connect with a wallet (private key) to pay from this app.");
        return;
      }
      setPayError(null);
      setPayingInvoiceId(invoice.id);
      try {
        const txHash = await sendTransaction(
          wallet,
          invoice.senderAddress,
          invoice.amountWei
        );
        await updateInvoiceStatus(invoice.id, "paid", txHash);
        await refreshInvoicesForChat(invoice.conversationId);
      } catch (e) {
        setPayError(e instanceof Error ? e.message : "Payment failed");
      } finally {
        setPayingInvoiceId(null);
      }
    },
    [wallet, refreshInvoicesForChat]
  );

  const openDeclineModal = useCallback((invoice: Invoice) => {
    setDeclineModalInvoice(invoice);
    setDeclineReason("");
  }, []);

  const handleConfirmDecline = useCallback(
    async () => {
      if (!declineModalInvoice) return;
      setDecliningInvoiceId(declineModalInvoice.id);
      try {
        await updateInvoiceStatus(declineModalInvoice.id, "declined", null, declineReason.trim() || null);
        await refreshInvoicesForChat(declineModalInvoice.conversationId);
        setDeclineModalInvoice(null);
        setDeclineReason("");
      } catch (e) {
        console.error("Decline failed", e);
      } finally {
        setDecliningInvoiceId(null);
      }
    },
    [declineModalInvoice, declineReason, refreshInvoicesForChat]
  );

  const handleAcceptRequest = useCallback(
    async (req: ChatRequest) => {
      if (!myAddress) return;
      try {
        const id = await getOrCreateConversation(myAddress, req.fromAddress);
        setChats((prev) => {
          const existing = prev.find((c) => c.id === id);
          if (existing) return prev;
          return [
            {
              id,
              participant: { id: req.fromAddress, name: shortAddress(req.fromAddress), wallet: req.fromAddress },
              unreadCount: 0,
            },
            ...prev,
          ];
        });
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
        setSelectedChatId(id);
        setActiveTab("chats");
      } catch (e) {
        console.error("Failed to start chat from request", e);
      }
    },
    [myAddress]
  );

  const handleDeclineRequest = useCallback((req: ChatRequest) => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  }, []);

  const handleAddSampleRequest = useCallback(() => {
    const sampleAddress = "0x1234567890abcdef1234567890abcdef12345678";
    if (myAddress && sampleAddress.toLowerCase() === myAddress.toLowerCase()) return;
    setRequests((prev) => [
      ...prev,
      {
        id: `sample-${Date.now()}`,
        fromAddress: sampleAddress,
        message: "Hi, I'd like to chat!",
        requestedAt: new Date(),
      },
    ]);
  }, [myAddress]);

  const handleSelectChat = useCallback((id: string) => {
    setSelectedChatId(id);
    const chat = chats.find((c) => c.id === id);
    const msgs = messagesByChat[id] ?? [];
    if (chat && chat.unreadCount > 0 && msgs.length >= chat.unreadCount) {
      const firstUnreadIndex = msgs.length - chat.unreadCount;
      setUnreadFromId(msgs[firstUnreadIndex]?.id ?? null);
    } else {
      setUnreadFromId(null);
    }
  }, [chats, messagesByChat]);

  const handleStartNewChat = useCallback(async () => {
    const addr = newChatAddress.trim();
    if (!addr || !myAddress) return;
    if (!isValidAddress(addr)) {
      setNewChatError("Invalid Quai address");
      return;
    }
    if (addr.toLowerCase() === myAddress.toLowerCase()) {
      setNewChatError("Cannot chat with yourself");
      return;
    }
    setNewChatError(null);
    try {
      const id = await getOrCreateConversation(myAddress, addr);
      setChats((prev) => {
        const existing = prev.find((c) => c.id === id);
        if (existing) return prev;
        return [
          {
            id,
            participant: { id: addr, name: shortAddress(addr), wallet: addr },
            unreadCount: 0,
          },
          ...prev,
        ];
      });
      setSelectedChatId(id);
      setShowNewChat(false);
      setNewChatAddress("");
    } catch (e) {
      setNewChatError(e instanceof Error ? e.message : "Failed to create conversation");
    }
  }, [newChatAddress, myAddress]);

  const filteredChats = searchQuery
    ? chats.filter(
        (c) =>
          c.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.participant.wallet?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : chats;

  return (
    <div className="chat-app dark flex h-screen w-full bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={currentUser}
        onNewChat={() => setShowNewChat(true)}
      />
      {activeTab === "chats" && (
        <>
          <ChatList
            chats={filteredChats}
            selectedChatId={selectedChatId}
            onSelectChat={handleSelectChat}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            loading={loadingChats}
            currentUserId={myAddress}
          />
          <ChatWindow
            chat={selectedChat}
            messages={messages}
            invoices={invoices}
            isTyping={isTyping}
            unreadFromId={unreadFromId}
            currentUserId={myAddress}
            onSendMessage={handleSendMessage}
            replyToMessage={replyToMessage}
            onClearReply={() => setReplyToMessage(null)}
            onReply={handleReply}
            onReaction={handleReaction}
            onEditMessage={handleEditMessage}
            onRequestInvoice={() => setShowCreateInvoice(true)}
            onPayInvoice={handlePayInvoice}
            onDeclineInvoice={openDeclineModal}
            payingInvoiceId={payingInvoiceId}
            decliningInvoiceId={decliningInvoiceId}
            loadingMessages={loadingMessages}
          />
        </>
      )}
      {activeTab === "requests" && (
        <RequestsPanel
          requests={requests}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
          onAddSampleRequest={handleAddSampleRequest}
        />
      )}
      {activeTab === "settings" && <SettingsPanel />}

      <Dialog
        open={showNewChat}
        onOpenChange={(open) => {
          setShowNewChat(open);
          if (!open) {
            setNewChatAddress("");
            setNewChatError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New conversation</DialogTitle>
            <DialogDescription>
              Enter the other user&apos;s Quai wallet address to start a chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-chat-address">Wallet address</Label>
              <Input
                id="new-chat-address"
                type="text"
                value={newChatAddress}
                onChange={(e) => setNewChatAddress(e.target.value)}
                placeholder="0x..."
              />
            </div>
            {newChatError && (
              <p className="text-sm text-destructive">{newChatError}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowNewChat(false);
                setNewChatAddress("");
                setNewChatError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleStartNewChat}>
              Start chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreateInvoice}
        onOpenChange={(open) => {
          setShowCreateInvoice(open);
          if (!open) {
            setInvoiceAmount("");
            setInvoiceDescription("");
            setInvoiceError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request payment</DialogTitle>
            <DialogDescription>
              Send an invoice to {selectedChat?.participant.name ?? "this user"}. They can pay or decline from the chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-amount">Amount (QUAI)</Label>
              <Input
                id="invoice-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the amount in QUAI (e.g. 1.5)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-desc">Description (optional)</Label>
              <Input
                id="invoice-desc"
                type="text"
                placeholder="What is this payment for?"
                value={invoiceDescription}
                onChange={(e) => setInvoiceDescription(e.target.value)}
              />
            </div>
            {invoiceError && (
              <p className="text-sm text-destructive">{invoiceError}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateInvoice(false);
                setInvoiceAmount("");
                setInvoiceDescription("");
                setInvoiceError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateInvoice}>
              Send invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay error modal */}
      <Dialog open={!!payError} onOpenChange={(open) => !open && setPayError(null)}>
        <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Payment failed</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {payError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPayError(null)}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline invoice modal */}
      <Dialog
        open={!!declineModalInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineModalInvoice(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Decline invoice</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Optionally say why you&apos;re declining. The sender won&apos;t be notified of this reason in-app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="decline-reason" className="text-foreground">Reason (optional)</Label>
              <Textarea
                id="decline-reason"
                placeholder="e.g. Wrong amount, already paid elsewhere..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="min-h-[80px] resize-none bg-background text-foreground border-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDeclineModalInvoice(null); setDeclineReason(""); }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDecline} disabled={!declineModalInvoice}>
              Confirm decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
