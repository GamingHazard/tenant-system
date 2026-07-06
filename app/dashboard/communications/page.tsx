"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import SendAnnouncementForm, {
  AnnouncementFormData,
} from "@/components/forms/send-announcement-form";
import {
  getConversationsByOwner,
  getConversationByProperty,
  createConversationMessage,
  createConversationReply,
  markConversationMessageSeen,
  deleteConversationMessage,
  Conversation,
  ConversationMessage,
  PropertyConversation,
  PropertyReference,
  UserReference,
} from "@/lib/services/messages";
import { markMessageNotificationRead } from "@/lib/services/notifications";
import {
  createAnnouncementApi,
  getAnnouncementsByProperty,
  deleteAnnouncementApi,
  AnnouncementRecord,
} from "@/lib/services/announcements";
import { useAppData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Plus,
  Send,
  Bell,
  Paperclip,
  Search,
  Check,
  Eye,
  User,
  Trash2,
  MessageCirclePlus,
  X,
} from "lucide-react";

interface AnnouncementTemplate {
  id: string;
  title: string;
  description: string;
  data: Partial<AnnouncementFormData>;
}

type PropertyConversationWithParent = PropertyConversation & {
  parentConversation: Conversation;
};

export default function CommunicationsPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState("conversations");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [messageText, setMessageText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [announcementTemplate, setAnnouncementTemplate] =
    useState<Partial<AnnouncementFormData> | null>(null);
  const { properties, tenants } = useAppData();

  const getPropertyRefId = (propertyId?: string | PropertyReference | null) => {
    if (!propertyId) return "";
    return typeof propertyId === "string"
      ? propertyId
      : propertyId.id || propertyId._id || "";
  };

  const getUserRefId = (userRef?: string | UserReference | null) => {
    if (!userRef) return "";

    return typeof userRef === "string"
      ? userRef
      : userRef.id || userRef._id || "";
  };

  const getUserName = (userRef?: string | UserReference | null) => {
    if (!userRef) return "";

    const id = getUserRefId(userRef);
    console.log("[getUserName] called with:", {
      userRef,
      id,
      tenantsCount: tenants.length,
    });
    if (id) {
      const found = tenants.find((t) => t._id === id || t.id === id);
      console.log("[getUserName] search result:", {
        id,
        found,
        foundName: found?.name,
      });
      if (found?.name) return found.name;
    }

    // Return empty string for non-tenant users (admin/manager)
    console.log("[getUserName] returning empty string for id:", id);
    return "";
  };

  const getFromUserName = (fromUserId?: string | UserReference | null) => {
    return getUserName(fromUserId);
  };

  const getToUserName = (toUserId?: string | UserReference | null) => {
    return getUserName(toUserId);
  };

  const [messageFilter, setMessageFilter] = useState<"all" | "sent" | "inbox">(
    "all",
  );

  const getPropertyName = (propertyId?: string | PropertyReference) => {
    const id = getPropertyRefId(propertyId);
    if (!id) return "Unknown Property";
    return properties.find((p) => p.id === id)?.name || id;
  };

  // New message dialog state
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendPropertyId, setSendPropertyId] = useState("");
  const [sendTenantIds, setSendTenantIds] = useState<string[]>([]);
  const [sendMessageText, setSendMessageText] = useState("");
  const [isSendingNew, setIsSendingNew] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Data state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [announcementsData, setAnnouncementsData] = useState<
    AnnouncementRecord[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowInitialSkeleton(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, []);

  const showConversationSkeleton = loading && showInitialSkeleton;

  // Load announcements on mount
  useEffect(() => {
    async function loadAnnouncements() {
      const all: AnnouncementRecord[] = [];
      for (const p of properties) {
        try {
          const anns = await getAnnouncementsByProperty(p.id);
          all.push(...anns);
        } catch (e) {
          // ignore
        }
      }
      setAnnouncementsData(
        all.sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || ""),
        ),
      );
    }
    loadAnnouncements();
  }, [properties]);

  // Load conversations on mount or when user changes
  useEffect(() => {
    async function loadConversations() {
      if (!user?.id || !token) return;
      setLoading(true);
      try {
        const convs = await getConversationsByOwner(user.id, token);

        setConversations(convs);

        if (convs.length > 0 && !selectedPropertyId) {
          const nested = convs.flatMap((conv) => conv.conversations || []);
          if (nested.length > 0) {
            setSelectedPropertyId(getPropertyRefId(nested[0].propertyId));
          }
        }
      } catch (e) {
        console.error("Failed to load conversations:", e);
      }
      setLoading(false);
    }
    loadConversations();
  }, [user?.id, token]);

  // Get current selected conversation
  const propertyConversations = useMemo(() => {
    return conversations.flatMap(
      (conv) =>
        (conv.conversations || []).map((propertyConversation) => ({
          ...propertyConversation,
          parentConversation: conv,
        })) as PropertyConversationWithParent[],
    );
  }, [conversations]);

  const currentPropertyConversation = useMemo(() => {
    if (!selectedPropertyId) return null;

    return (
      propertyConversations.find(
        (conversation) =>
          getPropertyRefId(conversation.propertyId) === selectedPropertyId,
      ) ?? null
    );
  }, [propertyConversations, selectedPropertyId]);

  const currentConversation =
    currentPropertyConversation?.parentConversation ?? null;

  useEffect(() => {
    setSelectedMessageId(null);
  }, [selectedPropertyId]);

  const getProperty = (propertyId?: string | PropertyReference) => {
    if (!propertyId) return 0;
    if (typeof propertyId === "string") return 0;
    return propertyId.tenants?.length || 0;
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentConversation || !user?.id) return;

    const propertyId = getPropertyRefId(
      currentPropertyConversation?.propertyId,
    );
    if (!propertyId || !currentConversation) return;

    setIsSendingMessage(true);
    try {
      const recipientIds = currentConversation.participants.filter(
        (p) => p !== user.id,
      );

      await Promise.all(
        recipientIds.map((recipientId) =>
          createConversationMessage(
            user.id,
            propertyId,
            {
              category: "message",
              fromUserId: user.id,
              toUserId: recipientId,
              message: messageText,
            },
            token ?? undefined,
          ),
        ),
      );

      setMessageText("");
      // Reload conversation
      const updated = await getConversationByProperty(
        user.id,
        propertyId,
        token,
      );
      setConversations((prev) => {
        const updatedPropertyId = propertyId;
        const exists = prev.some((conv) =>
          conv.conversations?.some(
            (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
          ),
        );
        return exists
          ? prev.map((conv) =>
              conv.conversations?.some(
                (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
              )
                ? updated
                : conv,
            )
          : [...prev, updated];
      });
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle sending a reply
  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim() || !currentConversation || !user?.id) return;

    try {
      const message = currentPropertyConversation?.messages.find(
        (m) => m._id === messageId || m.id === messageId,
      );
      if (!message) return;

      const propertyId = getPropertyRefId(
        currentPropertyConversation?.propertyId,
      );
      if (!propertyId) return;

      const replyToUserId = getUserRefId(message.fromUserId);
      if (!replyToUserId) return;

      await createConversationReply(
        user.id,
        propertyId,
        messageId,
        {
          fromUserId: user.id,
          toUserId: replyToUserId,
          message: replyText,
        },
        token,
      );
      setReplyText("");
      setSelectedMessageId(null);
      // Reload conversation
      const updated = await getConversationByProperty(
        user.id,
        propertyId,
        token,
      );
      setConversations((prev) => {
        const updatedPropertyId = propertyId;
        const exists = prev.some((conv) =>
          conv.conversations?.some(
            (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
          ),
        );
        return exists
          ? prev.map((conv) =>
              conv.conversations?.some(
                (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
              )
                ? updated
                : conv,
            )
          : [...prev, updated];
      });
    } catch (e) {
      console.error("Failed to send reply:", e);
    }
  };

  // Handle mark message as seen
  const handleMarkSeen = async (messageId: string) => {
    if (!currentPropertyConversation || !user?.id) return;
    try {
      const propertyId = getPropertyRefId(
        currentPropertyConversation.propertyId,
      );
      if (!propertyId) return;

      await markConversationMessageSeen(
        user.id,
        propertyId,
        messageId,
        user.id,
        token,
      );
      // Reload conversation
      const updated = await getConversationByProperty(
        user.id,
        propertyId,
        token,
      );
      setConversations((prev) => {
        const updatedPropertyId = propertyId;
        const exists = prev.some((conv) =>
          conv.conversations?.some(
            (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
          ),
        );
        return exists
          ? prev.map((conv) =>
              conv.conversations?.some(
                (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
              )
                ? updated
                : conv,
            )
          : [...prev, updated];
      });

      await markMessageNotificationRead(messageId, token);
      if (
        typeof window !== "undefined" &&
        (window as any).refreshNotifications
      ) {
        await (window as any).refreshNotifications();
      }
    } catch (e) {
      console.error("Failed to mark as seen:", e);
    }
  };

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!currentPropertyConversation || !user?.id) return;
    try {
      const propertyId = getPropertyRefId(
        currentPropertyConversation.propertyId,
      );
      if (!propertyId) return;

      await deleteConversationMessage(user.id, propertyId, messageId, token);
      // Reload conversation
      const updated = await getConversationByProperty(
        user.id,
        propertyId,
        token,
      );
      setConversations((prev) => {
        const updatedPropertyId = propertyId;
        const exists = prev.some((conv) =>
          conv.conversations?.some(
            (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
          ),
        );
        return exists
          ? prev.map((conv) =>
              conv.conversations?.some(
                (pc) => getPropertyRefId(pc.propertyId) === updatedPropertyId,
              )
                ? updated
                : conv,
            )
          : [...prev, updated];
      });
    } catch (e) {
      console.error("Failed to delete message:", e);
    }
  };

  // Handle send new announcement
  const handleSendAnnouncement = async (data: any) => {
    setIsSendingAnnouncement(true);
    try {
      await createAnnouncementApi(data);
      // Reload announcements
      const all: AnnouncementRecord[] = [];
      for (const p of properties) {
        try {
          const anns = await getAnnouncementsByProperty(p.id);
          all.push(...anns);
        } catch (e) {}
      }
      setAnnouncementsData(
        all.sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || ""),
        ),
      );
      setShowAnnouncementForm(false);
      setAnnouncementTemplate(null);
    } catch (e) {
      console.error("Failed to send announcement:", e);
    }
    setIsSendingAnnouncement(false);
  };

  // Handle send new message via dialog
  const handleSendNewMessage = async () => {
    if (
      !sendPropertyId ||
      sendTenantIds.length === 0 ||
      !sendMessageText.trim() ||
      !user?.id
    ) {
      return;
    }
    setIsSendingNew(true);
    try {
      await Promise.all(
        sendTenantIds.map((recipientId) =>
          createConversationMessage(
            user.id,
            sendPropertyId,
            {
              category: "message",
              fromUserId: user.id,
              toUserId: recipientId,
              message: sendMessageText,
            },
            token ?? undefined,
          ),
        ),
      );
      // Reload conversations
      const convs = await getConversationsByOwner(user.id, token);
      setConversations(convs);
      setIsSendDialogOpen(false);
      setSendPropertyId("");
      setSendTenantIds([]);
      setSendMessageText("");
    } catch (e) {
      console.error("Failed to send message:", e);
    }
    setIsSendingNew(false);
  };

  const tenantsForSelectedProperty = useMemo(() => {
    if (!sendPropertyId) return [];
    return tenants.filter((t) => t.propertyId === sendPropertyId);
  }, [sendPropertyId, tenants]);

  const allMessages = useMemo(() => {
    if (!currentPropertyConversation) return [];

    return currentPropertyConversation.messages || [];
  }, [currentPropertyConversation]);

  const filteredMessages = useMemo(() => {
    if (!allMessages) return [];

    return allMessages.filter((msg) => {
      const fromUserId = getUserRefId(msg.fromUserId);
      const recipientId = getUserRefId(msg.toUserId);
      const isFromCurrentUser = fromUserId === user?.id;

      if (messageFilter === "sent") {
        return isFromCurrentUser;
      }
      if (messageFilter === "inbox") {
        return recipientId === user?.id;
      }
      return true;
    });
  }, [allMessages, messageFilter, user?.id]);

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null;
    return (
      allMessages.find(
        (msg) => msg._id === selectedMessageId || msg.id === selectedMessageId,
      ) ?? null
    );
  }, [allMessages, selectedMessageId]);

  const messageDetailsPanel = selectedMessage ? (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/50 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          From
        </p>
        <p className="font-semibold text-sm">
          {getUserRefId(selectedMessage.fromUserId) === user?.id
            ? "You"
            : getFromUserName(selectedMessage.fromUserId)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDateTime(selectedMessage.sentAt)}
        </p>
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Recipients
        </p>
        <p className="text-sm">
          {selectedMessage.toUserId
            ? getUserRefId(selectedMessage.toUserId) === user?.id
              ? "You"
              : getToUserName(selectedMessage.toUserId)
            : "No recipient"}
        </p>
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Message
        </p>
        <p className="text-sm whitespace-pre-wrap">{selectedMessage.message}</p>
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Seen by
        </p>
        <p className="text-sm">
          {selectedMessage.seenBy.length > 0
            ? selectedMessage.seenBy
                .map((seenRef) =>
                  getUserRefId(seenRef) === user?.id
                    ? "You"
                    : getToUserName(seenRef),
                )
                .join(", ")
            : "No one yet"}
        </p>
      </div>
      {selectedMessage.replies && selectedMessage.replies.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Replies
          </p>
          <div className="space-y-3">
            {selectedMessage.replies.map((reply) => (
              <div key={reply._id || reply.id} className="space-y-1">
                <div className="font-semibold text-sm">
                  {getFromUserName(reply.fromUserId)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(reply.sentAt)}
                </p>
                <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-border h-full p-6 flex flex-col items-center justify-center text-center text-muted-foreground">
      <p className="font-semibold mb-2">Select a message</p>
      <p className="text-sm">
        Details about the selected message will appear here.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <SendAnnouncementForm
        isOpen={showAnnouncementForm}
        onClose={() => {
          setShowAnnouncementForm(false);
          setAnnouncementTemplate(null);
        }}
        onSubmit={handleSendAnnouncement}
        isLoading={isSendingAnnouncement}
        initialData={announcementTemplate || undefined}
      />

      {/* New message dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              Send a message to tenants at a property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Property
              </label>
              <select
                value={sendPropertyId}
                onChange={(e) => {
                  setSendPropertyId(e.target.value);
                  setSendTenantIds([]);
                }}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Tenants (select one or more)
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-input rounded-md p-2">
                {tenantsForSelectedProperty.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tenants for this property
                  </p>
                ) : (
                  tenantsForSelectedProperty.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={sendTenantIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSendTenantIds([...sendTenantIds, t.id]);
                          } else {
                            setSendTenantIds(
                              sendTenantIds.filter((id) => id !== t.id),
                            );
                          }
                        }}
                        className="rounded"
                      />
                      {t.name}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Message
              </label>
              <Textarea
                value={sendMessageText}
                onChange={(e) => setSendMessageText(e.target.value)}
                placeholder="Write your message..."
                rows={4}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsSendDialogOpen(false)}
              disabled={isSendingNew}
            >
              Cancel
            </Button>
            <Button onClick={handleSendNewMessage} disabled={isSendingNew}>
              {isSendingNew ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">
            Communications
          </h1>
          <p className="text-muted-foreground">
            Message tenants and manage announcements
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white"
          onClick={() => setShowAnnouncementForm(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Main Content */}
      <Card className="border border-border h-screen overflow-hidden">
        {showConversationSkeleton ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_520px_360px] h-full p-4">
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4 rounded-xl" />
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-3xl" />
              ))}
            </div>

            <div className="space-y-4">
              <Skeleton className="h-10 w-2/3 rounded-xl" />
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-3xl" />
              ))}
            </div>

            <div className="space-y-4">
              <Skeleton className="h-10 w-1/2 rounded-xl" />
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-3xl" />
              ))}
            </div>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="border-b border-border rounded-none p-0 h-auto bg-transparent">
              <TabsTrigger
                value="conversations"
                className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Conversations (
                {conversations
                  ?.map((c) => c.conversations?.length || 0)
                  .reduce((a, b) => a + b, 0)}
                )
              </TabsTrigger>
              <TabsTrigger
                value="announcements"
                className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-6 py-3 text-foreground data-[state=active]:bg-transparent"
              >
                <Bell className="w-4 h-4 mr-2" />
                Announcements ({announcementsData.length})
              </TabsTrigger>
            </TabsList>

            {/* Conversations Tab */}
            <TabsContent value="conversations" className="p-0">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(520px,1fr)_320px] h-full">
                {/* Property List */}
                <div className="border border-border rounded-xl overflow-hidden bg-background h-full">
                  <div className="p-4 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search properties..."
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="overflow-y-auto space-y-2 p-2 h-[420px] xl:h-[calc(100%-72px)]">
                    {loading ? (
                      <p className="text-xs text-muted-foreground text-center p-4">
                        Loading...
                      </p>
                    ) : propertyConversations.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center p-4">
                        No conversations yet
                      </p>
                    ) : (
                      propertyConversations.map((conv) => {
                        const propId = getPropertyRefId(conv.propertyId);
                        return (
                          <button
                            key={propId}
                            onClick={() => setSelectedPropertyId(propId)}
                            className={`w-full text-left h-24 flex flex-col justify-center p-3 rounded-md transition-colors ${
                              selectedPropertyId === propId
                                ? "bg-primary text-white"
                                : "hover:bg-secondary"
                            }`}
                          >
                            <div className="font-medium text-sm truncate">
                              {getPropertyName(conv?.propertyId)}
                            </div>
                            <div className="text-xs opacity-75 truncate">
                              {getProperty(conv?.propertyId)} Tenants
                            </div>
                            <div className="text-xs opacity-75 truncate">
                              {conv.messages?.length || 0} Messages
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Message Area */}
                {currentPropertyConversation ? (
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between gap-4">
                      <div>
                        <h2 className="font-bold text-lg text-foreground">
                          {getPropertyName(
                            currentPropertyConversation.propertyId,
                          )}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          All messages of the conversation for this property.
                          Select a message to view details and replies.
                        </p>
                      </div>
                      <div>
                        <Button
                          size="sm"
                          onClick={() => {
                            const pid = getPropertyRefId(
                              currentPropertyConversation.propertyId,
                            );
                            setSendPropertyId(pid);
                            setIsSendDialogOpen(true);
                          }}
                          className="rounded-full"
                        >
                          <MessageCirclePlus /> Create Message
                        </Button>
                      </div>
                    </div>

                    {/* Message List */}
                    <div className="space-y-3 p-4 border-b border-border bg-background rounded-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          Messages ({filteredMessages.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(["all", "inbox", "sent"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setMessageFilter(mode)}
                              className={`rounded-full px-3 py-1.5 text-sm transition ${
                                messageFilter === mode
                                  ? "bg-primary text-white"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {mode === "all"
                                ? "All"
                                : mode === "inbox"
                                  ? "Inbox"
                                  : "Sent"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {filteredMessages.length === 0 ? (
                        <div className="flex h-full min-h-[240px] items-center justify-center text-muted-foreground">
                          No messages yet. Send the first message!
                        </div>
                      ) : (
                        filteredMessages?.map((msg, idx) => {
                          const fromUserId = getUserRefId(msg.fromUserId);
                          const recipientId = getUserRefId(msg.toUserId);

                          const isFromCurrentUser = fromUserId === user?.id;
                          const isMessageRead = Array.isArray(msg.seenBy)
                            ? msg.seenBy
                                .map((entry: any) => getUserRefId(entry))
                                .filter(Boolean)
                                .includes(user?.id || "")
                            : false;

                          return (
                            <div
                              key={msg._id || idx}
                              className={`p-4 border-b border-border rounded-md my-3 relative cursor-pointer ${
                                selectedMessageId === (msg._id || msg.id)
                                  ? "bg-primary/10 text-white"
                                  : "hover:bg-muted/20"
                              }`}
                              onClick={() => {
                                const messageId = msg._id || msg.id || "";
                                setSelectedMessageId(messageId || null);
                                setIsDetailsDialogOpen(true);

                                if (
                                  recipientId === user?.id &&
                                  !isMessageRead &&
                                  messageId
                                ) {
                                  void handleMarkSeen(messageId);
                                }
                              }}
                            >
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                from:{" "}
                                <b>
                                  {isFromCurrentUser
                                    ? "You"
                                    : getFromUserName(msg.fromUserId)}
                                </b>{" "}
                                to:
                                <b>
                                  {recipientId === user?.id
                                    ? "You"
                                    : getToUserName(msg.toUserId)}{" "}
                                </b>
                              </p>

                              <p className="text-sm mb-3 flex-wrap line-clamp-2 text-muted-foreground whitespace-pre-wrap">
                                {msg.message}
                              </p>
                              <p className="text-xs absolute right-1 bottom-1 text-muted-foreground">
                                {formatDateTime(msg.sentAt)}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center p-8 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 opacity-50" />
                  </div>
                )}
              </div>
            </TabsContent>

            <Dialog
              open={isDetailsDialogOpen && !!selectedMessage}
              onOpenChange={setIsDetailsDialogOpen}
            >
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Message details</DialogTitle>
                  <DialogDescription>
                    Review the selected message details and reply history.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {selectedMessage && messageDetailsPanel}
                </div>
                <DialogFooter>
                  <Button
                    variant="secondary"
                    onClick={() => setIsDetailsDialogOpen(false)}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Announcements Tab */}
            <TabsContent value="announcements" className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-4">
                    Recent Announcements
                  </h3>
                  <div className="space-y-3">
                    {announcementsData.length === 0 ? (
                      <Card className="border border-border p-4">
                        <p className="text-sm text-muted-foreground text-center">
                          No announcements yet
                        </p>
                      </Card>
                    ) : (
                      announcementsData.map((announcement) => {
                        const readTenants = tenants.filter((t) =>
                          (announcement.readBy || []).includes(t.id),
                        );
                        return (
                          <Card
                            key={announcement.id}
                            className="border border-border p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-semibold text-foreground">
                                {announcement.title}
                              </p>
                              <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {readTenants.length} / {tenants.length}
                                </span>
                                <button
                                  onClick={() =>
                                    deleteAnnouncement(announcement.id)
                                  }
                                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                              {announcement.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-3">
                              {formatDateTime(announcement.createdAt || "")}
                            </p>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );

  async function deleteAnnouncement(id: string) {
    try {
      await deleteAnnouncementApi(id);
      // Reload announcements
      const all: AnnouncementRecord[] = [];
      for (const p of properties) {
        try {
          const anns = await getAnnouncementsByProperty(p.id);
          all.push(...anns);
        } catch (e) {}
      }
      setAnnouncementsData(
        all.sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || ""),
        ),
      );
    } catch (e) {
      console.error("Failed to delete announcement:", e);
    }
  }
}
