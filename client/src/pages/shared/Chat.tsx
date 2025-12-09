import { useState, useRef, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Plus, 
  Search, 
  MoreVertical,
  Paperclip,
  Image,
  File,
  Users,
  MessageCircle,
  X,
  Check,
  Loader2,
  Download,
  Trash2,
  Settings,
  Pencil,
  Type,
  Bell
} from "lucide-react";
import { useCurrentUser, useUsers } from "@/lib/api";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type ChatProps = {
  role: 'CEO' | 'Employee';
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  attachments?: { id: string; filename: string; url: string; size: number; type: string }[];
};

type ConversationMember = {
  id: string;
  name: string;
  avatar?: string;
};

type Conversation = {
  id: string;
  name: string | null;
  isGroup: boolean | null;
  createdBy: string | null;
  members: ConversationMember[];
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
};

export default function Chat({ role }: ChatProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useUsers();
  const { clearUnreadMessages } = useDashboardContext();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newConversationName, setNewConversationName] = useState("");
  const [newChatSearch, setNewChatSearch] = useState("");
  const [chatSettings, setChatSettings] = useState({
    fontSize: "medium",
    notifications: true,
    soundEnabled: true,
    showTimestamps: true,
    chatTheme: "default" as "default" | "dark" | "light" | "gradient" | "ocean" | "forest",
  });
  
  // @ Mention functionality
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations from database
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: [`/api/chat/conversations/${selectedConversationId}/messages`],
    enabled: !!selectedConversationId,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (data: { participantId?: string; isGroup?: boolean; name?: string; participantIds?: string[] }) => {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setSelectedConversationId(conversation.id);
      setShowNewChatModal(false);
      setShowNewGroupModal(false);
      setGroupName("");
      setSelectedUsers([]);
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content, attachments, mentionedUserIds }: { conversationId: string; content: string; attachments?: any[]; mentionedUserIds?: string[] }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments, mentionedUserIds }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${selectedConversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setMessageInput("");
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setSelectedConversationId(null);
      toast.success("Conversation deleted");
    },
  });

  // Update conversation mutation
  const updateConversationMutation = useMutation({
    mutationFn: async ({ conversationId, name }: { conversationId: string; name: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update conversation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setEditingName(false);
      toast.success("Conversation updated");
    },
  });

  // Delete message mutation (unsend)
  const deleteMessageMutation = useMutation({
    mutationFn: async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}`, { 
        method: "DELETE" 
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to unsend message");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${selectedConversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      toast.success("Message unsent");
    },
  });

  const handleUnsendMessage = async (messageId: string) => {
    if (!selectedConversationId) return;
    try {
      await deleteMessageMutation.mutateAsync({ 
        conversationId: selectedConversationId, 
        messageId 
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to unsend message");
    }
  };

  const handleUpdateConversationName = async () => {
    if (!selectedConversationId || !newConversationName.trim()) return;
    try {
      await updateConversationMutation.mutateAsync({
        conversationId: selectedConversationId,
        name: newConversationName.trim(),
      });
    } catch (error) {
      toast.error("Failed to update name");
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await deleteConversationMutation.mutateAsync(conversationId);
    } catch (error) {
      toast.error("Failed to delete conversation");
    }
  };

  // Filter users excluding current user
  const availableUsers = allUsers.filter(u => u.id !== currentUser?.id);

  // Filtered users for @ mention dropdown
  const mentionableUsers = useMemo(() => {
    if (!mentionQuery) return availableUsers;
    return availableUsers.filter(u => 
      u.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [availableUsers, mentionQuery]);

  // Handle message input change with @ mention detection
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    setMessageInput(value);
    
    // Find the @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      // Check if there's a space before @ or it's at the start
      const charBeforeAt = atIndex > 0 ? value[atIndex - 1] : ' ';
      if (charBeforeAt === ' ' || atIndex === 0) {
        const query = textBeforeCursor.substring(atIndex + 1);
        // Only show dropdown if query doesn't contain spaces (not complete mention)
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setMentionStartIndex(atIndex);
          setShowMentionDropdown(true);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartIndex(null);
  };

  // Insert mention into message
  const insertMention = (user: typeof availableUsers[0]) => {
    if (mentionStartIndex === null) return;
    
    const beforeMention = messageInput.substring(0, mentionStartIndex);
    const afterMention = messageInput.substring(mentionStartIndex + mentionQuery.length + 1);
    const newMessage = `${beforeMention}@${user.name} ${afterMention}`;
    
    setMessageInput(newMessage);
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionStartIndex(null);
    
    // Focus back on input
    inputRef.current?.focus();
  };

  // Handle keyboard navigation in mention dropdown
  const handleMentionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentionDropdown) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
      return;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev < mentionableUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (mentionableUsers[selectedMentionIndex]) {
        insertMention(mentionableUsers[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowMentionDropdown(false);
    }
  };

  // Extract mentioned user IDs from message
  const extractMentions = (content: string): string[] => {
    const mentionedIds: string[] = [];
    allUsers.forEach(user => {
      if (content.includes(`@${user.name}`)) {
        mentionedIds.push(user.id);
      }
    });
    return mentionedIds;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    clearUnreadMessages();
  }, [clearUnreadMessages]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversationId) return;

    try {
      // Extract mentioned users before sending
      const mentionedUserIds = extractMentions(messageInput);
      
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        content: messageInput.trim(),
        mentionedUserIds,
      });
      
      // Show notification if users were mentioned
      if (mentionedUserIds.length > 0) {
        const mentionedNames = mentionedUserIds
          .map(id => allUsers.find(u => u.id === id)?.name)
          .filter(Boolean);
        toast.success(`Notified ${mentionedNames.join(', ')}`);
      }
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleCreateChat = async (userId: string) => {
    const user = availableUsers.find(u => u.id === userId);
    if (!user) return;

    try {
      await createConversationMutation.mutateAsync({ participantId: userId });
      toast.success(`Started conversation with ${user.name}`);
    } catch (error) {
      toast.error("Failed to create conversation");
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length < 2) {
      toast.error("Please enter a group name and select at least 2 members");
      return;
    }

    try {
      await createConversationMutation.mutateAsync({
        isGroup: true,
        name: groupName.trim(),
        participantIds: selectedUsers,
      });
      toast.success(`Created group: ${groupName}`);
    } catch (error) {
      toast.error("Failed to create group");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedConversationId) return;

    for (const file of Array.from(files)) {
      try {
        // Upload file to server first
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadRes.ok) {
          const error = await uploadRes.json();
          throw new Error(error.error || 'Upload failed');
        }
        
        const uploadedFile = await uploadRes.json();
        
        await sendMessageMutation.mutateAsync({
          conversationId: selectedConversationId,
          content: `Shared a file: ${file.name}`,
          attachments: [{ 
            id: uploadedFile.id,
            filename: uploadedFile.filename, 
            type: uploadedFile.type, 
            size: uploadedFile.size,
            url: uploadedFile.url // Server URL for download
          }],
        });
        toast.success("File shared successfully");
      } catch (error: any) {
        toast.error(error.message || "Failed to share file");
      }
    }
  };

  const filteredConversations = conversations.filter(conv =>
    (conv.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.members.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.isGroup) return conv.name || "Group Chat";
    const otherMember = conv.members.find(m => m.id !== currentUser?.id);
    return otherMember?.name || conv.name || "Direct Message";
  };

  return (
    <Layout role={role} pageTitle="Messages" userName={currentUser?.name || ""}>
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Conversations List */}
        <Card className="w-80 bg-card border-border flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Chats
              </CardTitle>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowNewChatModal(true)}
                  data-testid="button-new-chat"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowNewGroupModal(true)}
                  data-testid="button-new-group"
                >
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary/50"
                data-testid="input-search-conversations"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="px-2 pb-2">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredConversations.length > 0 ? (
                  filteredConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={cn(
                        "w-full p-3 rounded-lg flex items-start gap-3 transition-colors text-left",
                        selectedConversationId === conv.id 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-secondary/50"
                      )}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className={cn(
                          "text-xs",
                          conv.isGroup ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-500"
                        )}>
                          {getConversationDisplayName(conv).split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">{getConversationDisplayName(conv)}</p>
                          {conv.lastMessage?.createdAt && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(conv.lastMessage.createdAt), 'HH:mm')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.lastMessage?.content || "No messages yet"}
                        </p>
                        {conv.isGroup && (
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {conv.members.length} members
                            </span>
                          </div>
                        )}
                      </div>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 text-xs px-1.5">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No conversations yet</p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setShowNewChatModal(true)}
                    >
                      Start a new chat
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="flex-1 bg-card border-border flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={cn(
                        "text-xs",
                        selectedConversation.isGroup 
                          ? "bg-primary/20 text-primary" 
                          : "bg-blue-500/20 text-blue-500"
                      )}>
                        {getConversationDisplayName(selectedConversation).split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{getConversationDisplayName(selectedConversation)}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.isGroup 
                          ? `${selectedConversation.members.length} members`
                          : "Direct message"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedConversation && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setNewConversationName(getConversationDisplayName(selectedConversation));
                          setShowSettingsSheet(true);
                        }}
                        className="text-muted-foreground hover:text-primary"
                        data-testid="button-chat-settings"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteConversation(selectedConversation.id)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid="button-delete-conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className={cn(
                "flex-1 overflow-hidden p-0 transition-colors",
                chatSettings.chatTheme === "default" && "bg-card",
                chatSettings.chatTheme === "dark" && "bg-zinc-900",
                chatSettings.chatTheme === "light" && "bg-slate-50",
                chatSettings.chatTheme === "gradient" && "bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10",
                chatSettings.chatTheme === "ocean" && "bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-teal-500/10",
                chatSettings.chatTheme === "forest" && "bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-lime-500/10"
              )}>
                <ScrollArea className="h-full p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map(message => {
                        const isOwnMessage = message.senderId === currentUser?.id;
                        return (
                          <div 
                            key={message.id} 
                            className={cn("flex gap-3", isOwnMessage && "flex-row-reverse")}
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs bg-secondary">
                                {message.senderName?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn("max-w-[70%] group", isOwnMessage && "text-right")}>
                              <div className="relative">
                                <div className={cn(
                                  "rounded-lg p-3",
                                  isOwnMessage 
                                    ? "bg-primary text-primary-foreground" 
                                    : "bg-secondary"
                                )}>
                                  {!isOwnMessage && (
                                    <p className="text-xs font-medium mb-1 opacity-70">{message.senderName}</p>
                                  )}
                                  <p className={cn(
                                    chatSettings.fontSize === "small" && "text-xs",
                                    chatSettings.fontSize === "medium" && "text-sm",
                                    chatSettings.fontSize === "large" && "text-base"
                                  )}>{message.content}</p>
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {message.attachments.map((att, idx) => (
                                      <div 
                                        key={idx} 
                                        className={cn(
                                          "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                                          isOwnMessage 
                                            ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" 
                                            : "bg-background/50 hover:bg-background/80"
                                        )}
                                        onClick={() => {
                                          if (att.url) {
                                            // Create download link for base64 data URLs
                                            const link = document.createElement('a');
                                            link.href = att.url;
                                            link.download = att.filename || 'download';
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          } else {
                                            toast.info("File not available for download");
                                          }
                                        }}
                                        data-testid={`attachment-${att.id || idx}`}
                                      >
                                        <File className="w-4 h-4 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-xs font-medium truncate block">{att.filename}</span>
                                          <span className="text-[10px] opacity-70">
                                            {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''} 
                                            {att.type ? ` • ${att.type.split('/')[1]?.toUpperCase() || att.type}` : ''}
                                          </span>
                                        </div>
                                        <Download className="w-3 h-3 opacity-60" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                </div>
                                {isOwnMessage && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -left-8 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    onClick={() => handleUnsendMessage(message.id)}
                                    disabled={deleteMessageMutation.isPending}
                                    data-testid={`button-unsend-${message.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              {chatSettings.showTimestamps && (
                                <p className={cn(
                                  "text-xs text-muted-foreground mt-1",
                                  isOwnMessage && "text-right"
                                )}>
                                  {format(new Date(message.createdAt), 'HH:mm')}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Send a message to start the conversation</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    multiple
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      placeholder="Type a message... Use @ to mention someone"
                      value={messageInput}
                      onChange={handleMessageInputChange}
                      onKeyDown={handleMentionKeyDown}
                      className="w-full"
                      data-testid="input-message"
                    />
                    
                    {/* @ Mention Dropdown */}
                    {showMentionDropdown && mentionableUsers.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        <div className="p-1">
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            Mention a team member
                          </div>
                          {mentionableUsers.map((user, index) => (
                            <button
                              key={user.id}
                              className={cn(
                                "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                                index === selectedMentionIndex ? "bg-primary/10" : "hover:bg-secondary"
                              )}
                              onClick={() => insertMention(user)}
                              data-testid={`mention-user-${user.id}`}
                            >
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="bg-blue-500/20 text-blue-500 text-xs">
                                  {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.role}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose from your existing chats or start a new one</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowNewChatModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* New Chat Modal */}
      <Dialog open={showNewChatModal} onOpenChange={(open) => { 
        setShowNewChatModal(open); 
        if (!open) setNewChatSearch(""); 
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search for a team member..."
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                className="pl-9 bg-secondary/50"
                data-testid="input-search-new-chat"
              />
            </div>
            <ScrollArea className="h-60">
              <div className="space-y-2">
                {availableUsers
                  .filter(user => 
                    user.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                    user.email?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                    user.role?.toLowerCase().includes(newChatSearch.toLowerCase())
                  )
                  .map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleCreateChat(user.id)}
                    className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-secondary transition-colors"
                    data-testid={`select-user-${user.id}`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-blue-500/20 text-blue-500 text-sm">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                  </button>
                ))}
                {availableUsers.filter(user => 
                  user.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                  user.email?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                  user.role?.toLowerCase().includes(newChatSearch.toLowerCase())
                ).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Group Modal */}
      <Dialog open={showNewGroupModal} onOpenChange={setShowNewGroupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                data-testid="input-group-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Select Members ({selectedUsers.length} selected, need at least 2)</Label>
              <ScrollArea className="h-48 border rounded-lg p-2">
                {availableUsers.map(user => {
                  const isSelected = selectedUsers.includes(user.id);
                  return (
                    <label 
                      key={user.id} 
                      className={cn(
                        "flex items-center gap-3 p-2 rounded cursor-pointer",
                        isSelected ? "bg-primary/10" : "hover:bg-secondary"
                      )}
                      data-testid={`select-group-user-${user.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers([...selectedUsers, user.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }
                        }}
                        data-testid={`checkbox-group-user-${user.id}`}
                      />
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-blue-500/20 text-blue-500 text-xs">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.name}</span>
                    </label>
                  );
                })}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroupModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length < 2 || createConversationMutation.isPending}
              data-testid="button-create-group"
            >
              {createConversationMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Settings Sheet */}
      <Sheet open={showSettingsSheet} onOpenChange={setShowSettingsSheet}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Chat Settings
            </SheetTitle>
            <SheetDescription>
              Customize your conversation preferences
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Conversation Name */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Conversation Name</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  value={newConversationName}
                  onChange={(e) => setNewConversationName(e.target.value)}
                  placeholder="Enter conversation name..."
                  data-testid="input-conversation-name"
                />
                <Button 
                  onClick={handleUpdateConversationName}
                  disabled={updateConversationMutation.isPending || !newConversationName.trim()}
                  data-testid="button-save-name"
                >
                  {updateConversationMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Display Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Display Settings</Label>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fontSize" className="text-sm text-muted-foreground">
                    Font Size
                  </Label>
                  <Select 
                    value={chatSettings.fontSize} 
                    onValueChange={(value) => setChatSettings({ ...chatSettings, fontSize: value })}
                  >
                    <SelectTrigger className="w-32" data-testid="select-font-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Show Timestamps
                  </Label>
                  <Switch
                    checked={chatSettings.showTimestamps}
                    onCheckedChange={(checked) => setChatSettings({ ...chatSettings, showTimestamps: checked })}
                    data-testid="switch-timestamps"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="chatTheme" className="text-sm text-muted-foreground">
                    Chat Background
                  </Label>
                  <Select 
                    value={chatSettings.chatTheme} 
                    onValueChange={(value: "default" | "dark" | "light" | "gradient" | "ocean" | "forest") => 
                      setChatSettings({ ...chatSettings, chatTheme: value })
                    }
                  >
                    <SelectTrigger className="w-32" data-testid="select-chat-theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                      <SelectItem value="ocean">Ocean</SelectItem>
                      <SelectItem value="forest">Forest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Notification Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Notifications</Label>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Enable Notifications
                  </Label>
                  <Switch
                    checked={chatSettings.notifications}
                    onCheckedChange={(checked) => setChatSettings({ ...chatSettings, notifications: checked })}
                    data-testid="switch-notifications"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Sound Effects
                  </Label>
                  <Switch
                    checked={chatSettings.soundEnabled}
                    onCheckedChange={(checked) => setChatSettings({ ...chatSettings, soundEnabled: checked })}
                    data-testid="switch-sound"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Conversation Info */}
            {selectedConversation && (
              <div className="space-y-3">
                <Label className="font-medium">Conversation Info</Label>
                <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span>{selectedConversation.isGroup ? "Group Chat" : "Direct Message"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Members</span>
                    <span>{selectedConversation.members.length}</span>
                  </div>
                  {selectedConversation.isGroup && (
                    <div className="pt-2">
                      <span className="text-sm text-muted-foreground">Participants:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedConversation.members.map(member => (
                          <Badge key={member.id} variant="secondary" className="text-xs">
                            {member.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
