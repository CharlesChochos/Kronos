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
  CheckCheck,
  Loader2,
  Download,
  Trash2,
  Settings,
  Pencil,
  Type,
  Bell,
  Smile,
  AtSign,
  Mic,
  Square,
  Play,
  Pause,
  Pin,
  PinOff,
  ImageIcon,
  Link,
  FileText,
  Sticker,
  ChevronDown,
  Volume2,
  ArrowLeft,
  ChevronRight,
  Archive,
  ArchiveX,
  Forward,
  Reply,
  Circle,
  Clock
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser, useUsers } from "@/lib/api";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type ChatProps = {
  role: 'CEO' | 'Employee';
};

type MessageReaction = {
  emoji: string;
  userId: string;
  userName: string;
  createdAt: string;
};

type MessageReadReceipt = {
  userId: string;
  userName: string;
  readAt: string;
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  attachments?: { id: string; filename: string; url: string; size: number; type: string }[];
  reactions?: MessageReaction[];
  readBy?: MessageReadReceipt[];
  replyToMessageId?: string | null;
  messageType?: string;
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  forwardedFrom?: string | null;
};

type ConversationMember = {
  id: string;
  name: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
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
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
};

type TypingUser = {
  id: string;
  name: string;
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
  
  // Reply functionality
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  
  // Emoji picker for reactions
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏", "🎉", "💯"];
  
  // Voice message recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Stickers
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const STICKERS = [
    { id: 'thumbsup', emoji: '👍', label: 'Thumbs Up' },
    { id: 'heart', emoji: '❤️', label: 'Heart' },
    { id: 'celebrate', emoji: '🎉', label: 'Celebrate' },
    { id: 'fire', emoji: '🔥', label: 'Fire' },
    { id: 'clap', emoji: '👏', label: 'Clap' },
    { id: 'rocket', emoji: '🚀', label: 'Rocket' },
    { id: 'star', emoji: '⭐', label: 'Star' },
    { id: 'check', emoji: '✅', label: 'Check' },
    { id: 'thinking', emoji: '🤔', label: 'Thinking' },
    { id: 'laugh', emoji: '😂', label: 'Laugh' },
    { id: 'cool', emoji: '😎', label: 'Cool' },
    { id: 'love', emoji: '🥰', label: 'Love' },
  ];
  
  // Search in conversation
  const [showConversationSearch, setShowConversationSearch] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  
  // Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  
  // Media gallery
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [mediaGalleryTab, setMediaGalleryTab] = useState<'media' | 'files' | 'links'>('media');
  
  // Reaction details popover
  const [showReactionDetails, setShowReactionDetails] = useState<string | null>(null);
  
  // Enhanced messaging features
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);
  
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
    mutationFn: async ({ conversationId, content, attachments, mentionedUserIds, replyToMessageId }: { conversationId: string; content: string; attachments?: any[]; mentionedUserIds?: string[]; replyToMessageId?: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments, mentionedUserIds, replyToMessageId }),
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

  // Reaction mutation
  const reactionMutation = useMutation({
    mutationFn: async ({ conversationId, messageId, emoji }: { conversationId: string; messageId: string; emoji: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}/reactions`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add reaction");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${selectedConversationId}/messages`] });
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ conversationId, messageId, content }: { conversationId: string; messageId: string; content: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to edit message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${selectedConversationId}/messages`] });
      setEditingMessage(null);
      setEditContent("");
      toast.success("Message edited");
    },
  });

  // Pin conversation mutation
  const pinConversationMutation = useMutation({
    mutationFn: async ({ conversationId, isPinned }: { conversationId: string; isPinned: boolean }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/pin`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned }),
      });
      if (!res.ok) throw new Error("Failed to pin conversation");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      toast.success(variables.isPinned ? "Conversation pinned" : "Conversation unpinned");
    },
  });

  // Archive conversation mutation
  const archiveConversationMutation = useMutation({
    mutationFn: async ({ conversationId, isArchived }: { conversationId: string; isArchived: boolean }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/archive`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      });
      if (!res.ok) throw new Error("Failed to archive conversation");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      toast.success(variables.isArchived ? "Conversation archived" : "Conversation unarchived");
    },
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async ({ conversationId, messageId }: { conversationId: string; messageId?: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/read`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${selectedConversationId}/messages`] });
    },
  });

  // Send typing indicator
  const sendTypingIndicator = async (isTyping: boolean) => {
    if (!selectedConversationId) return;
    try {
      await fetch(`/api/chat/conversations/${selectedConversationId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping }),
      });
    } catch (error) {
      console.error('Failed to send typing indicator');
    }
  };

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

  // Handle adding/removing reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!selectedConversationId) return;
    try {
      await reactionMutation.mutateAsync({
        conversationId: selectedConversationId,
        messageId,
        emoji,
      });
      setShowEmojiPicker(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to add reaction");
    }
  };

  // Group reactions by emoji for display
  const groupReactions = (reactions: MessageReaction[] | undefined) => {
    if (!reactions || reactions.length === 0) return [];
    const grouped: Record<string, { emoji: string; users: string[]; count: number; hasCurrentUser: boolean }> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, users: [], count: 0, hasCurrentUser: false };
      }
      grouped[r.emoji].users.push(r.userName);
      grouped[r.emoji].count++;
      if (r.userId === currentUser?.id) {
        grouped[r.emoji].hasCurrentUser = true;
      }
    }
    return Object.values(grouped);
  };

  // Get replied message content
  const getReplyMessage = (replyToMessageId: string | null | undefined) => {
    if (!replyToMessageId) return null;
    return messages.find(m => m.id === replyToMessageId);
  };

  // Date grouping helper
  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return format(date, 'EEEE');
    }
    return format(date, 'MMMM d, yyyy');
  };

  // Group messages by date
  const messagesWithDateHeaders = useMemo(() => {
    if (!messages.length) return [];
    
    const result: { type: 'date' | 'message'; date?: string; message?: Message }[] = [];
    let lastDate = '';
    
    for (const msg of messages) {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== lastDate) {
        result.push({ type: 'date', date: getDateLabel(msg.createdAt) });
        lastDate = msgDate;
      }
      result.push({ type: 'message', message: msg });
    }
    
    return result;
  }, [messages]);

  // Handle edit message
  const handleEditMessage = async () => {
    if (!editingMessage || !selectedConversationId || !editContent.trim()) return;
    try {
      await editMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        messageId: editingMessage.id,
        content: editContent.trim(),
      });
    } catch (error) {
      toast.error("Failed to edit message");
    }
  };

  // Handle pin/unpin conversation
  const handlePinConversation = async (conversationId: string, isPinned: boolean) => {
    try {
      await pinConversationMutation.mutateAsync({ conversationId, isPinned });
    } catch (error) {
      toast.error("Failed to update pin status");
    }
  };

  // Handle archive/unarchive conversation  
  const handleArchiveConversation = async (conversationId: string, isArchived: boolean) => {
    try {
      await archiveConversationMutation.mutateAsync({ conversationId, isArchived });
    } catch (error) {
      toast.error("Failed to archive conversation");
    }
  };

  // Handle typing on message input
  const handleTypingInput = (value: string) => {
    setMessageInput(value);
    
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      sendTypingIndicator(true);
      lastTypingRef.current = now;
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 3000);
  };

  // Get delivery status icon
  const getDeliveryStatusIcon = (status: string | undefined, readBy: MessageReadReceipt[] | undefined) => {
    if (readBy && readBy.length > 0) {
      return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
    }
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-muted-foreground animate-pulse" />;
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'failed':
        return <X className="w-3 h-3 text-red-500" />;
      default:
        return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  // Filter conversations by pinned/archived
  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    if (!showArchived) {
      filtered = filtered.filter(c => !c.isArchived);
    } else {
      filtered = filtered.filter(c => c.isArchived);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(query) ||
        c.members.some(m => m.name.toLowerCase().includes(query))
      );
    }
    
    // Sort: pinned first, then by last message
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, searchQuery, showArchived]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (selectedConversationId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.senderId !== currentUser?.id) {
        markAsReadMutation.mutate({
          conversationId: selectedConversationId,
          messageId: lastMessage.id,
        });
      }
    }
  }, [selectedConversationId, messages.length]);

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error("Could not access microphone");
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };
  
  const sendVoiceMessage = async () => {
    if (!audioBlob || !selectedConversationId) return;
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      try {
        await sendMessageMutation.mutateAsync({
          conversationId: selectedConversationId,
          content: "🎤 Voice message",
          attachments: [{
            id: crypto.randomUUID(),
            filename: `voice_${Date.now()}.webm`,
            url: base64Audio,
            size: audioBlob.size,
            type: 'audio/webm'
          }]
        });
        setAudioBlob(null);
        setRecordingTime(0);
      } catch (error) {
        toast.error("Failed to send voice message");
      }
    };
    reader.readAsDataURL(audioBlob);
  };
  
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Send sticker
  const handleSendSticker = async (sticker: typeof STICKERS[0]) => {
    if (!selectedConversationId) return;
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        content: sticker.emoji,
        attachments: [{
          id: crypto.randomUUID(),
          filename: `sticker_${sticker.id}`,
          url: '',
          size: 0,
          type: 'sticker'
        }]
      });
      setShowStickerPicker(false);
    } catch (error) {
      toast.error("Failed to send sticker");
    }
  };
  
  // Search in conversation
  const handleConversationSearch = (query: string) => {
    setConversationSearchQuery(query);
    if (query.trim()) {
      const results = messages.filter(m => 
        m.content.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };
  
  // Pin/unpin message (local state for now)
  const handlePinMessage = (message: Message) => {
    const isPinned = pinnedMessages.some(m => m.id === message.id);
    if (isPinned) {
      setPinnedMessages(prev => prev.filter(m => m.id !== message.id));
      toast.success("Message unpinned");
    } else {
      setPinnedMessages(prev => [...prev, message]);
      toast.success("Message pinned");
    }
  };
  
  // Get media items from conversation
  const mediaItems = useMemo(() => {
    const items: { images: Message[]; files: Message[]; links: { message: Message; url: string }[] } = {
      images: [],
      files: [],
      links: []
    };
    
    messages.forEach(msg => {
      // Check for image attachments
      msg.attachments?.forEach(att => {
        if (att.type?.startsWith('image/')) {
          items.images.push(msg);
        } else if (att.type && att.type !== 'sticker' && att.type !== 'audio/webm') {
          items.files.push(msg);
        }
      });
      
      // Check for links in content
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = msg.content.match(urlRegex);
      if (matches) {
        matches.forEach(url => {
          items.links.push({ message: msg, url });
        });
      }
    });
    
    return items;
  }, [messages]);

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
        replyToMessageId: replyToMessage?.id || undefined,
      });
      
      // Clear reply state after sending
      setReplyToMessage(null);
      
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
          credentials: 'include',
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

  // Mobile view state - controls which panel is shown on mobile
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  
  // When selecting a conversation on mobile, switch to chat view
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setMobileView('chat');
  };

  return (
    <Layout role={role} pageTitle="Messages" userName={currentUser?.name || ""}>
      <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)] relative overflow-hidden">
        
        {/* Conversations List - Full screen on mobile, sidebar on desktop */}
        <div className={cn(
          "w-full md:w-80 bg-card md:border-r border-border flex flex-col transition-transform duration-300 ease-out",
          "absolute md:relative inset-0 z-10",
          mobileView === 'chat' && "translate-x-[-100%] md:translate-x-0"
        )}>
          {/* Mobile Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-semibold">Messages</h1>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 md:h-8 md:w-8"
                  onClick={() => setShowNewChatModal(true)}
                  data-testid="button-new-chat"
                >
                  <Plus className="w-5 h-5 md:w-4 md:h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 md:h-8 md:w-8"
                  onClick={() => setShowNewGroupModal(true)}
                  data-testid="button-new-group"
                >
                  <Users className="w-5 h-5 md:w-4 md:h-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary/50 h-11 md:h-10"
                data-testid="input-search-conversations"
              />
            </div>
          </div>
          
          {/* Conversation List */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredConversations.length > 0 ? (
                  filteredConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={cn(
                        "w-full p-4 md:p-3 rounded-xl md:rounded-lg flex items-center gap-3 transition-all text-left active:scale-[0.98] mb-1",
                        selectedConversationId === conv.id 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-secondary/50 active:bg-secondary"
                      )}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <div className="relative">
                        <Avatar className="w-12 h-12 md:w-10 md:h-10 flex-shrink-0">
                          <AvatarFallback className={cn(
                            "text-sm md:text-xs font-medium",
                            conv.isGroup ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-500"
                          )}>
                            {getConversationDisplayName(conv).split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        {!conv.isGroup && conv.members.some(m => m.id !== currentUser?.id && m.isOnline) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {conv.isPinned && (
                              <Pin className="w-3 h-3 text-primary flex-shrink-0" />
                            )}
                            <p className="font-medium text-base md:text-sm truncate">{getConversationDisplayName(conv)}</p>
                          </div>
                          {conv.lastMessage?.createdAt && (
                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {format(new Date(conv.lastMessage.createdAt), 'HH:mm')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm md:text-xs text-muted-foreground truncate pr-2">
                            {conv.lastMessage?.content || "No messages yet"}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {conv.isGroup && (
                              <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {conv.members.length}
                              </span>
                            )}
                            {conv.unreadCount > 0 && (
                              <Badge variant="default" className="h-5 min-w-5 text-xs px-1.5 rounded-full">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground md:hidden flex-shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-base font-medium">No conversations yet</p>
                    <p className="text-sm mt-1">Start chatting with your team</p>
                    <Button 
                      variant="default" 
                      size="default" 
                      className="mt-4"
                      onClick={() => setShowNewChatModal(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start a new chat
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Chat Window - Full screen on mobile, main area on desktop */}
        <div className={cn(
          "flex-1 bg-card flex flex-col transition-transform duration-300 ease-out",
          "absolute md:relative inset-0 z-20",
          mobileView === 'list' && "translate-x-full md:translate-x-0"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-2 py-3 md:px-4 md:py-3 border-b border-border bg-card/95 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Back button - mobile only */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setMobileView('list')}
                      className="md:hidden h-10 w-10 -ml-1"
                      data-testid="button-back-to-list"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={cn(
                        "text-xs font-medium",
                        selectedConversation.isGroup 
                          ? "bg-primary/20 text-primary" 
                          : "bg-blue-500/20 text-blue-500"
                      )}>
                        {getConversationDisplayName(selectedConversation).split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-base md:text-sm">{getConversationDisplayName(selectedConversation)}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.isGroup 
                          ? `${selectedConversation.members.length} members`
                          : "Direct message"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 md:gap-1">
                    {/* Search in conversation - hidden on mobile */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setShowConversationSearch(!showConversationSearch)}
                      className={cn(
                        "hidden md:flex h-9 w-9 text-muted-foreground",
                        showConversationSearch && "text-primary bg-primary/10"
                      )}
                      data-testid="button-conversation-search"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                    
                    {/* Pinned messages - hidden on mobile */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setShowPinnedMessages(!showPinnedMessages)}
                      className={cn(
                        "hidden md:flex h-9 w-9 text-muted-foreground relative",
                        showPinnedMessages && "text-yellow-500 bg-yellow-500/10"
                      )}
                      data-testid="button-pinned-messages"
                    >
                      <Pin className="w-4 h-4" />
                      {pinnedMessages.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-[10px] text-white rounded-full flex items-center justify-center">
                          {pinnedMessages.length}
                        </span>
                      )}
                    </Button>
                    
                    {/* Media gallery - hidden on mobile */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setShowMediaGallery(true)}
                      className="hidden md:flex h-9 w-9 text-muted-foreground hover:text-primary"
                      data-testid="button-media-gallery"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                    
                    {/* Settings */}
                    {selectedConversation && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setNewConversationName(getConversationDisplayName(selectedConversation));
                          setShowSettingsSheet(true);
                        }}
                        className="h-10 w-10 md:h-9 md:w-9 text-muted-foreground hover:text-primary"
                        data-testid="button-chat-settings"
                      >
                        <Settings className="w-5 h-5 md:w-4 md:h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteConversation(selectedConversation.id)}
                      className="hidden md:flex h-9 w-9 text-muted-foreground hover:text-destructive"
                      data-testid="button-delete-conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Search panel */}
                {showConversationSearch && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search in conversation..."
                        value={conversationSearchQuery}
                        onChange={(e) => handleConversationSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-conversation-search"
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        <p className="text-xs text-muted-foreground mb-1">{searchResults.length} results found</p>
                        {searchResults.slice(0, 5).map(msg => (
                          <div 
                            key={msg.id} 
                            className="text-xs p-2 hover:bg-secondary rounded cursor-pointer"
                            onClick={() => {
                              const el = document.querySelector(`[data-message-id="${msg.id}"]`);
                              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            <span className="font-medium">{msg.senderName}: </span>
                            <span className="text-muted-foreground">{msg.content.slice(0, 50)}...</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Pinned messages panel */}
                {showPinnedMessages && pinnedMessages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-yellow-500 mb-2 flex items-center gap-1">
                      <Pin className="w-3 h-3" />
                      Pinned Messages ({pinnedMessages.length})
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {pinnedMessages.map(msg => (
                        <div 
                          key={msg.id} 
                          className="text-xs p-2 bg-yellow-500/10 rounded flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{msg.senderName}: </span>
                            <span className="text-muted-foreground truncate">{msg.content.slice(0, 40)}...</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 flex-shrink-0"
                            onClick={() => handlePinMessage(msg)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className={cn(
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
                  ) : messagesWithDateHeaders.length > 0 ? (
                    <div className="space-y-4">
                      {messagesWithDateHeaders.map((item, idx) => {
                        if (item.type === 'date') {
                          return (
                            <div key={`date-${idx}`} className="flex justify-center my-4">
                              <span className="px-3 py-1 text-xs font-medium text-muted-foreground bg-secondary/50 rounded-full">
                                {item.date}
                              </span>
                            </div>
                          );
                        }
                        
                        const message = item.message!;
                        const isOwnMessage = message.senderId === currentUser?.id;
                        const replyMessage = getReplyMessage(message.replyToMessageId);
                        const groupedReactions = groupReactions(message.reactions);
                        
                        if (message.isDeleted) {
                          return (
                            <div 
                              key={message.id}
                              className={cn("flex gap-2 md:gap-3 px-2 md:px-0", isOwnMessage && "flex-row-reverse")}
                            >
                              <div className={cn(
                                "px-4 py-2.5 rounded-[20px] italic text-muted-foreground bg-secondary/30",
                                isOwnMessage ? "rounded-br-md" : "rounded-bl-md"
                              )}>
                                This message was deleted
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div 
                            key={message.id} 
                            data-message-id={message.id}
                            className={cn("flex gap-2 md:gap-3 px-2 md:px-0", isOwnMessage && "flex-row-reverse")}
                          >
                            <Avatar className="w-8 h-8 flex-shrink-0 hidden md:flex">
                              <AvatarFallback className="text-xs bg-secondary">
                                {message.senderName?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn("max-w-[85%] md:max-w-[70%] group", isOwnMessage && "text-right")}>
                              <div className="relative">
                                <div className={cn(
                                  "px-4 py-2.5 md:p-3",
                                  isOwnMessage 
                                    ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-md" 
                                    : "bg-secondary rounded-[20px] rounded-bl-md"
                                )}>
                                  {/* Reply indicator */}
                                  {replyMessage && (
                                    <div className={cn(
                                      "text-xs mb-2 pb-2 border-b border-border/50 opacity-70",
                                      isOwnMessage ? "border-primary-foreground/30" : "border-border"
                                    )}>
                                      <span className="font-medium">↩ Reply to {replyMessage.senderName}:</span>
                                      <p className="truncate">{replyMessage.content.slice(0, 50)}{replyMessage.content.length > 50 ? '...' : ''}</p>
                                    </div>
                                  )}
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
                                
                                {/* Message actions (reply, react, unsend) */}
                                <div className={cn(
                                  "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                  isOwnMessage ? "-left-20" : "-right-20"
                                )}>
                                  {/* Reply button */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                    onClick={() => setReplyToMessage(message)}
                                    data-testid={`button-reply-${message.id}`}
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                  </Button>
                                  
                                  {/* Reaction button */}
                                  <Popover open={showEmojiPicker === message.id} onOpenChange={(open) => setShowEmojiPicker(open ? message.id : null)}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                        data-testid={`button-react-${message.id}`}
                                      >
                                        <Smile className="w-3 h-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-2" side="top">
                                      <div className="flex gap-1">
                                        {QUICK_EMOJIS.map(emoji => (
                                          <Button
                                            key={emoji}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-lg hover:bg-secondary"
                                            onClick={() => handleReaction(message.id, emoji)}
                                            data-testid={`button-emoji-${emoji}`}
                                          >
                                            {emoji}
                                          </Button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  
                                  {/* Pin button */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-6 w-6",
                                      pinnedMessages.some(m => m.id === message.id) 
                                        ? "text-yellow-500 hover:text-yellow-600" 
                                        : "text-muted-foreground hover:text-yellow-500"
                                    )}
                                    onClick={() => handlePinMessage(message)}
                                    data-testid={`button-pin-${message.id}`}
                                  >
                                    <Pin className="w-3 h-3" />
                                  </Button>
                                  
                                  {/* Edit button (own messages only) */}
                                  {isOwnMessage && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                                      onClick={() => {
                                        setEditingMessage(message);
                                        setEditContent(message.content);
                                      }}
                                      data-testid={`button-edit-${message.id}`}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  )}
                                  
                                  {/* Unsend button (own messages only) */}
                                  {isOwnMessage && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleUnsendMessage(message.id)}
                                      disabled={deleteMessageMutation.isPending}
                                      data-testid={`button-unsend-${message.id}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Reactions display with user details */}
                              {groupedReactions.length > 0 && (
                                <div className={cn("flex flex-wrap gap-1 mt-1", isOwnMessage && "justify-end")}>
                                  {groupedReactions.map(({ emoji, count, hasCurrentUser, users }) => (
                                    <Popover key={emoji}>
                                      <PopoverTrigger asChild>
                                        <button
                                          className={cn(
                                            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors",
                                            hasCurrentUser 
                                              ? "bg-primary/20 text-primary border border-primary/30" 
                                              : "bg-secondary hover:bg-secondary/80"
                                          )}
                                          data-testid={`reaction-${emoji}-${message.id}`}
                                        >
                                          <span>{emoji}</span>
                                          {count > 1 && <span className="text-[10px]">{count}</span>}
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-48 p-2" side="top">
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground mb-2">Reacted with {emoji}</p>
                                          {users.map((userName, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                              <Avatar className="w-5 h-5">
                                                <AvatarFallback className="text-[8px] bg-secondary">
                                                  {userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </AvatarFallback>
                                              </Avatar>
                                              <span>{userName}</span>
                                            </div>
                                          ))}
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full mt-2 text-xs"
                                            onClick={() => handleReaction(message.id, emoji)}
                                          >
                                            {hasCurrentUser ? 'Remove reaction' : 'Add reaction'}
                                          </Button>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  ))}
                                </div>
                              )}
                              
                              {chatSettings.showTimestamps && (
                                <div className={cn(
                                  "flex items-center gap-1.5 text-xs text-muted-foreground mt-1",
                                  isOwnMessage && "justify-end"
                                )}>
                                  {message.isEdited && (
                                    <span className="italic text-[10px]">edited</span>
                                  )}
                                  {message.forwardedFrom && (
                                    <span className="flex items-center gap-0.5 text-[10px]">
                                      <Forward className="w-2.5 h-2.5" />
                                      forwarded
                                    </span>
                                  )}
                                  <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                                  {isOwnMessage && getDeliveryStatusIcon(message.deliveryStatus, message.readBy)}
                                </div>
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
              </div>

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="px-4 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs">
                    {typingUsers.length === 1 
                      ? `${typingUsers[0].name} is typing...`
                      : `${typingUsers.length} people are typing...`
                    }
                  </span>
                </div>
              )}

              {/* Message Input - Mobile optimized with safe area */}
              <div className="p-3 md:p-4 border-t border-border bg-card pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4">
                {/* Edit message indicator */}
                {editingMessage && (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Pencil className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-primary font-medium">Editing message</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEditingMessage(null);
                          setEditContent("");
                        }}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleEditMessage}
                        disabled={!editContent.trim() || editMessageMutation.isPending}
                        data-testid="button-save-edit"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Reply indicator */}
                {replyToMessage && !editingMessage && (
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Reply className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground hidden sm:inline">Replying to</span>
                      <span className="font-medium truncate">{replyToMessage.senderName}</span>
                      <span className="text-muted-foreground truncate hidden md:inline max-w-[200px]">
                        {replyToMessage.content.slice(0, 40)}{replyToMessage.content.length > 40 ? '...' : ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => setReplyToMessage(null)}
                      data-testid="button-cancel-reply"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-1 md:gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,image/*"
                  />
                  {/* Attachment button - always visible */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-10 w-10 flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  
                  {/* Emoji Picker - hidden on mobile, shown via popover on desktop */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="hidden md:flex h-10 w-10"
                        data-testid="button-emoji-picker"
                      >
                        <Smile className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-2" align="start">
                      <div className="grid grid-cols-8 gap-1">
                        {['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', 
                          '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗',
                          '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
                          '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
                          '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤',
                          '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
                          '👍', '👎', '👏', '🙌', '🤝', '👊', '✊', '🤞',
                          '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
                          '🔥', '⭐', '✨', '💯', '✅', '❌', '⚠️', '💡'].map((emoji) => (
                          <button
                            key={emoji}
                            className="p-1.5 hover:bg-secondary rounded text-xl transition-colors"
                            onClick={() => {
                              setMessageInput(prev => prev + emoji);
                              inputRef.current?.focus();
                            }}
                            data-testid={`emoji-${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  {/* @ Mention Button - hidden on mobile */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="hidden md:flex h-10 w-10"
                    onClick={() => {
                      setMessageInput(prev => prev + '@');
                      setShowMentionDropdown(true);
                      setMentionQuery("");
                      setMentionStartIndex(messageInput.length);
                      inputRef.current?.focus();
                    }}
                    data-testid="button-mention"
                  >
                    <AtSign className="w-5 h-5" />
                  </Button>
                  
                  {/* Sticker Picker - hidden on mobile */}
                  <Popover open={showStickerPicker} onOpenChange={setShowStickerPicker}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="hidden md:flex h-10 w-10"
                        data-testid="button-sticker-picker"
                      >
                        <Sticker className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="start">
                      <p className="text-sm font-medium mb-2">Stickers</p>
                      <div className="grid grid-cols-4 gap-2">
                        {STICKERS.map((sticker) => (
                          <button
                            key={sticker.id}
                            className="p-3 hover:bg-secondary rounded-lg text-3xl transition-all hover:scale-110"
                            onClick={() => handleSendSticker(sticker)}
                            title={sticker.label}
                            data-testid={`sticker-${sticker.id}`}
                          >
                            {sticker.emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Message Input */}
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      placeholder="Message..."
                      value={messageInput}
                      onChange={handleMessageInputChange}
                      onKeyDown={handleMentionKeyDown}
                      className="w-full h-11 rounded-full px-4 text-base"
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
                                  {(user.name || "?").split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.jobTitle || user.role}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Voice Message */}
                  {!isRecording && !audioBlob ? (
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={startRecording}
                      data-testid="button-start-recording"
                    >
                      <Mic className="w-4 h-4" />
                    </Button>
                  ) : isRecording ? (
                    <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 rounded-lg">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm text-red-500 font-mono">{formatRecordingTime(recordingTime)}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-red-500"
                        onClick={stopRecording}
                        data-testid="button-stop-recording"
                      >
                        <Square className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={cancelRecording}
                        data-testid="button-cancel-recording"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : audioBlob ? (
                    <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-lg">
                      <Volume2 className="w-4 h-4 text-primary" />
                      <span className="text-sm text-primary">{formatRecordingTime(recordingTime)}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-primary"
                        onClick={sendVoiceMessage}
                        disabled={sendMessageMutation.isPending}
                        data-testid="button-send-voice"
                      >
                        <Send className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={cancelRecording}
                        data-testid="button-discard-voice"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : null}
                  
                  {/* Send Button - circular on mobile */}
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    className="h-10 w-10 md:h-10 md:w-auto md:px-4 rounded-full md:rounded-md flex-shrink-0"
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
              <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium text-center">Select a conversation</p>
              <p className="text-sm text-center mt-1">Choose from your existing chats or start a new one</p>
              <Button 
                variant="default" 
                className="mt-6 h-12 px-6"
                onClick={() => {
                  setMobileView('list');
                  setShowNewChatModal(true);
                }}
              >
                <Plus className="w-5 h-5 mr-2" />
                New Chat
              </Button>
            </div>
          )}
        </div>
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
                        {(user.name || "?").split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.jobTitle || user.role}</p>
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
                          {(user.name || "?").split(' ').map(n => n[0]).join('').slice(0, 2)}
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
      
      {/* Media Gallery Sheet */}
      <Sheet open={showMediaGallery} onOpenChange={setShowMediaGallery}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Media Gallery
            </SheetTitle>
            <SheetDescription>
              View all shared media, files, and links
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-4">
            {/* Tabs for Media/Files/Links */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={mediaGalleryTab === 'media' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaGalleryTab('media')}
                className="flex-1"
              >
                <ImageIcon className="w-4 h-4 mr-1" />
                Media ({mediaItems.images.length})
              </Button>
              <Button
                variant={mediaGalleryTab === 'files' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaGalleryTab('files')}
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-1" />
                Files ({mediaItems.files.length})
              </Button>
              <Button
                variant={mediaGalleryTab === 'links' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaGalleryTab('links')}
                className="flex-1"
              >
                <Link className="w-4 h-4 mr-1" />
                Links ({mediaItems.links.length})
              </Button>
            </div>
            
            <ScrollArea className="h-[calc(100vh-200px)]">
              {mediaGalleryTab === 'media' && (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.images.length > 0 ? (
                    mediaItems.images.map(msg => 
                      msg.attachments?.filter(a => a.type?.startsWith('image/')).map((att, idx) => (
                        <div 
                          key={`${msg.id}-${idx}`}
                          className="aspect-square rounded-lg overflow-hidden bg-secondary cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            if (att.url) import('@/lib/utils').then(m => m.openUrlInNewTab(att.url!));
                          }}
                        >
                          <img 
                            src={att.url || ''} 
                            alt={att.filename || 'Image'} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))
                    )
                  ) : (
                    <div className="col-span-3 text-center py-8 text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No images shared yet</p>
                    </div>
                  )}
                </div>
              )}
              
              {mediaGalleryTab === 'files' && (
                <div className="space-y-2">
                  {mediaItems.files.length > 0 ? (
                    mediaItems.files.map(msg =>
                      msg.attachments?.filter(a => a.type && !a.type.startsWith('image/') && a.type !== 'sticker' && a.type !== 'audio/webm').map((att, idx) => (
                        <div 
                          key={`${msg.id}-${idx}`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                          onClick={() => {
                            if (att.url) {
                              const link = document.createElement('a');
                              link.href = att.url;
                              link.download = att.filename || 'download';
                              link.click();
                            }
                          }}
                        >
                          <File className="w-8 h-8 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{att.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                            </p>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No files shared yet</p>
                    </div>
                  )}
                </div>
              )}
              
              {mediaGalleryTab === 'links' && (
                <div className="space-y-2">
                  {mediaItems.links.length > 0 ? (
                    mediaItems.links.map(({ message, url }, idx) => (
                      <a 
                        key={`${message.id}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <Link className="w-8 h-8 text-blue-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-blue-500 truncate">{url}</p>
                          <p className="text-xs text-muted-foreground">
                            Shared by {message.senderName}
                          </p>
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Link className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No links shared yet</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
