import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  X,
  Maximize2,
  Send,
  ChevronDown,
  ChevronUp,
  Smile
} from "lucide-react";
import { useCurrentUser } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLocation } from "wouter";

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

type MessageReaction = {
  emoji: string;
  userId: string;
  userName: string;
  createdAt: string;
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  reactions?: MessageReaction[];
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '💯', '✅'];

type OpenChat = {
  conversationId: string;
  isMinimized: boolean;
};

const MAX_OPEN_CHATS = 3;
const STORAGE_KEY = 'kronos_open_chats';

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💋', '💌', '💐', '🌹', '🌷', '🌸'],
  'Reactions': ['🎉', '🎊', '🎁', '🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '💫', '🔥', '💥', '💢', '💯', '✅', '❌', '⚠️', '🚨', '💡', '📌', '📍', '🎯', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '👁️‍🗨️'],
  'Work': ['📊', '📈', '📉', '📋', '📁', '📂', '🗂️', '📅', '📆', '🗓️', '📇', '🗃️', '🗄️', '📑', '📄', '📃', '📝', '✏️', '✒️', '🖊️', '🖋️', '📧', '📨', '📩', '📤', '📥', '📦', '💼', '🗑️', '🔍', '🔎', '💻', '🖥️', '⌨️', '🖱️', '📱', '☎️', '📞'],
  'Time': ['⏰', '⏱️', '⏲️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '📅', '📆', '🗓️', '⌛', '⏳', '🌅', '🌄', '🌃', '🌆', '🌇', '🌉', '🌙', '🌛', '🌜', '☀️', '🌤️', '⛅', '🌥️', '☁️'],
  'Symbols': ['✓', '✔️', '☑️', '✅', '❎', '❌', '⭕', '❗', '❓', '❕', '❔', '‼️', '⁉️', '💲', '💱', '©️', '®️', '™️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '⬛', '⬜'],
  'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊'],
  'Food': ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🥨', '🧀', '🥗', '🥙', '🥪', '🌮', '🌯', '🫔', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾']
};

let audioUnlocked = false;
let notificationAudio: HTMLAudioElement | null = null;

const initAudio = () => {
  if (!notificationAudio) {
    notificationAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
    notificationAudio.volume = 0.5;
  }
};

const playNotificationSound = () => {
  if (notificationAudio && audioUnlocked) {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {});
  }
};

if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    initAudio();
    if (notificationAudio && !audioUnlocked) {
      notificationAudio.play().then(() => {
        notificationAudio!.pause();
        notificationAudio!.currentTime = 0;
        audioUnlocked = true;
      }).catch(() => {});
    }
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
}

const saveOpenChats = (chats: OpenChat[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {}
};

const loadOpenChats = (): OpenChat[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [];
};

export function DockedChatBoxes() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const [openChats, setOpenChats] = useState<OpenChat[]>(() => loadOpenChats());
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [showMessagingMenu, setShowMessagingMenu] = useState(false);
  const lastSeenMessagesRef = useRef<Record<string, string>>({});
  const mountTimeRef = useRef(Date.now());
  
  useEffect(() => {
    initAudio();
  }, []);

  useEffect(() => {
    saveOpenChats(openChats);
  }, [openChats]);
  
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 3000,
  });

  const openChatForConversation = useCallback((conversationId: string, minimized = false) => {
    setOpenChats(prev => {
      const existing = prev.find(c => c.conversationId === conversationId);
      if (existing) {
        return prev.map(c => 
          c.conversationId === conversationId 
            ? { ...c, isMinimized: minimized } 
            : c
        );
      }
      const newChats = [...prev, { conversationId, isMinimized: minimized }];
      if (newChats.length > MAX_OPEN_CHATS) {
        return newChats.slice(-MAX_OPEN_CHATS);
      }
      return newChats;
    });
    setShowMessagingMenu(false);
  }, []);

  useEffect(() => {
    if (!currentUser || conversations.length === 0) return;
    
    conversations.forEach(conv => {
      if (!conv.lastMessage) return;
      
      const currentTimestamp = conv.lastMessage.createdAt;
      const lastSeenTimestamp = lastSeenMessagesRef.current[conv.id];
      const messageTime = new Date(currentTimestamp).getTime();
      const isFromOtherUser = conv.lastMessage.senderId !== currentUser.id;
      
      if (lastSeenTimestamp === undefined) {
        if (messageTime > mountTimeRef.current - 5000 && isFromOtherUser) {
          lastSeenMessagesRef.current[conv.id] = currentTimestamp;
          openChatForConversation(conv.id, false);
          playNotificationSound();
        } else {
          lastSeenMessagesRef.current[conv.id] = currentTimestamp;
        }
        return;
      }
      
      if (lastSeenTimestamp !== currentTimestamp && isFromOtherUser) {
        lastSeenMessagesRef.current[conv.id] = currentTimestamp;
        openChatForConversation(conv.id, false);
        playNotificationSound();
      }
    });
  }, [conversations, currentUser, openChatForConversation]);

  const closeChat = (conversationId: string) => {
    setOpenChats(prev => prev.filter(c => c.conversationId !== conversationId));
  };

  const toggleMinimize = (conversationId: string) => {
    setOpenChats(prev => prev.map(c => 
      c.conversationId === conversationId 
        ? { ...c, isMinimized: !c.isMinimized } 
        : c
    ));
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.isGroup) return "Group Chat";
    const otherMember = conv.members.find(m => m.id !== currentUser?.id);
    return otherMember?.name || "Chat";
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const openFullChat = () => {
    const basePath = currentUser?.accessLevel === 'admin' ? '/ceo' : '/employee';
    setLocation(`${basePath}/chat`);
  };

  if (!currentUser) return null;

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const closedConversations = conversations.filter(
    c => !openChats.some(oc => oc.conversationId === c.id)
  );

  return (
    <div className="fixed bottom-0 right-0 flex items-end z-50" data-testid="docked-chat-boxes">
      <div className="flex items-end gap-1 mr-1">
        {openChats.map((chat) => (
          <ChatBox
            key={chat.conversationId}
            conversationId={chat.conversationId}
            isMinimized={chat.isMinimized}
            conversations={conversations}
            currentUser={currentUser}
            messageInput={messageInputs[chat.conversationId] || ""}
            setMessageInput={(value) => setMessageInputs(prev => ({ ...prev, [chat.conversationId]: value }))}
            onClose={() => closeChat(chat.conversationId)}
            onToggleMinimize={() => toggleMinimize(chat.conversationId)}
            onOpenFullChat={openFullChat}
            getConversationName={getConversationName}
            getInitials={getInitials}
            queryClient={queryClient}
          />
        ))}
      </div>
      
      <div className="relative mr-4 mb-0">
        {showMessagingMenu && (
          <Card className="absolute bottom-12 right-0 w-80 shadow-2xl border border-gray-300 dark:border-border overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-border bg-white dark:bg-card flex items-center justify-between">
              <span className="font-semibold text-gray-900 dark:text-foreground">Messaging</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={openFullChat}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="h-72 bg-white dark:bg-card">
              {closedConversations.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No conversations
                </div>
              ) : (
                closedConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-secondary/50 transition-colors border-b border-gray-100 dark:border-border/50",
                      conv.unreadCount > 0 && "bg-blue-50/50 dark:bg-primary/5"
                    )}
                    onClick={() => openChatForConversation(conv.id, false)}
                    data-testid={`list-conversation-${conv.id}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="text-sm bg-gray-300 dark:bg-secondary text-gray-700 dark:text-foreground">
                          {getInitials(getConversationName(conv))}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-card rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm truncate",
                          conv.unreadCount > 0 ? "font-semibold text-gray-900 dark:text-foreground" : "text-gray-700 dark:text-foreground"
                        )}>
                          {getConversationName(conv)}
                        </span>
                        {conv.unreadCount > 0 && (
                          <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-red-500 hover:bg-red-500">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className="text-xs text-gray-500 dark:text-muted-foreground truncate mt-0.5">
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </Card>
        )}
        
        <div 
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-t-lg shadow-lg cursor-pointer transition-all border border-b-0 border-gray-300 dark:border-border",
            "bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-secondary"
          )}
          onClick={() => setShowMessagingMenu(!showMessagingMenu)}
          data-testid="button-messaging-dock"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-gray-200 dark:bg-secondary">
              {currentUser ? getInitials(currentUser.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm text-gray-900 dark:text-foreground">Messaging</span>
          {totalUnread > 0 && (
            <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-red-500 hover:bg-red-500">
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
          {showMessagingMenu ? (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          )}
        </div>
      </div>
    </div>
  );
}

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const categories = Object.keys(EMOJI_CATEGORIES);
  
  return (
    <div className="w-72">
      <div className="flex gap-1 p-2 border-b overflow-x-auto">
        {categories.map(cat => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "ghost"}
            size="sm"
            className="text-xs px-2 py-1 h-7 shrink-0"
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>
      <ScrollArea className="h-48 p-2">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, i) => (
            <button
              key={i}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-secondary rounded text-lg transition-colors"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChatBox({
  conversationId,
  isMinimized,
  conversations,
  currentUser,
  messageInput,
  setMessageInput,
  onClose,
  onToggleMinimize,
  onOpenFullChat,
  getConversationName,
  getInitials,
  queryClient,
}: {
  conversationId: string;
  isMinimized: boolean;
  conversations: Conversation[];
  currentUser: any;
  messageInput: string;
  setMessageInput: (value: string) => void;
  onClose: () => void;
  onToggleMinimize: () => void;
  onOpenFullChat: () => void;
  getConversationName: (conv: Conversation) => string;
  getInitials: (name: string) => string;
  queryClient: any;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const conversation = conversations.find(c => c.id === conversationId);
  
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/chat/conversations/${conversationId}/messages`],
    enabled: !isMinimized,
    refetchInterval: 3000,
  });
  
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${conversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setMessageInput("");
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error("Failed to add reaction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${conversationId}/messages`] });
    },
  });

  useEffect(() => {
    if (!isMinimized && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate({ conversationId, content: messageInput.trim() });
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(messageInput + emoji);
    setShowEmojiPicker(false);
  };

  if (!conversation) return null;

  const convName = getConversationName(conversation);

  return (
    <div 
      className={cn(
        "flex flex-col shadow-2xl border border-gray-300 dark:border-border overflow-hidden transition-all duration-200 rounded-t-lg",
        isMinimized ? "w-56" : "w-80"
      )}
      data-testid={`docked-chat-${conversationId}`}
    >
      {!isMinimized && (
        <div className="bg-white dark:bg-card">
          <ScrollArea className="h-80 p-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No messages yet. Say hello! 👋
              </div>
            ) : (
              messages.map((msg) => {
                const groupedReactions = (msg.reactions || []).reduce((acc, r) => {
                  if (!acc[r.emoji]) acc[r.emoji] = [];
                  acc[r.emoji].push(r);
                  return acc;
                }, {} as Record<string, MessageReaction[]>);

                return (
                  <div 
                    key={msg.id}
                    className={cn(
                      "mb-3 max-w-[85%] group",
                      msg.senderId === currentUser?.id ? "ml-auto" : ""
                    )}
                  >
                    <div className="relative">
                      <div className={cn(
                        "rounded-2xl px-3 py-2 text-sm",
                        msg.senderId === currentUser?.id 
                          ? "bg-blue-600 text-white rounded-br-sm" 
                          : "bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground rounded-bl-sm"
                      )}>
                        {msg.senderId !== currentUser?.id && (
                          <div className="text-xs font-medium mb-1 text-gray-500 dark:text-muted-foreground">{msg.senderName}</div>
                        )}
                        {msg.content}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button 
                            className={cn(
                              "absolute -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-1 shadow-sm hover:bg-gray-50 dark:hover:bg-secondary",
                              msg.senderId === currentUser?.id ? "right-0" : "left-0"
                            )}
                          >
                            <Smile className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1" align={msg.senderId === currentUser?.id ? "end" : "start"} side="top">
                          <div className="flex gap-1">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-secondary rounded text-base transition-colors"
                                onClick={() => addReactionMutation.mutate({ messageId: msg.id, emoji })}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {Object.keys(groupedReactions).length > 0 && (
                      <div className={cn(
                        "flex flex-wrap gap-1 mt-1",
                        msg.senderId === currentUser?.id ? "justify-end" : ""
                      )}>
                        {Object.entries(groupedReactions).map(([emoji, reactions]) => {
                          const hasUserReacted = reactions.some(r => r.userId === currentUser?.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => addReactionMutation.mutate({ messageId: msg.id, emoji })}
                              className={cn(
                                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                                hasUserReacted 
                                  ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" 
                                  : "bg-gray-100 dark:bg-secondary border-gray-200 dark:border-border hover:bg-gray-200 dark:hover:bg-secondary/80"
                              )}
                              title={reactions.map(r => r.userName).join(', ')}
                            >
                              <span>{emoji}</span>
                              <span className="text-gray-600 dark:text-muted-foreground">{reactions.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className={cn(
                      "text-[10px] text-gray-400 mt-0.5 px-1",
                      msg.senderId === currentUser?.id ? "text-right" : ""
                    )}>
                      {format(new Date(msg.createdAt), 'h:mm a')}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </ScrollArea>
          <div className="p-2 border-t border-gray-200 dark:border-border flex gap-1 bg-white dark:bg-card">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 shrink-0"
                  data-testid={`button-emoji-${conversationId}`}
                >
                  <Smile className="w-5 h-5 text-gray-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" side="top">
                <EmojiPicker onSelect={handleEmojiSelect} />
              </PopoverContent>
            </Popover>
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Write a message..."
              className="h-9 text-sm border-gray-300 dark:border-border rounded-full px-4"
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              data-testid={`input-message-${conversationId}`}
            />
            <Button 
              size="icon" 
              className="h-9 w-9 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700"
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending || !messageInput.trim()}
              data-testid={`button-send-${conversationId}`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      
      <div 
        className="px-3 py-2 bg-white dark:bg-card border-t border-gray-200 dark:border-border flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary"
        onClick={onToggleMinimize}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative shrink-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-gray-200 dark:bg-secondary text-gray-700 dark:text-foreground">
                {getInitials(convName)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-card rounded-full" />
          </div>
          <span className="font-medium text-sm text-gray-900 dark:text-foreground truncate">{convName}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isMinimized ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 hover:bg-gray-200 dark:hover:bg-secondary"
            onClick={(e) => { e.stopPropagation(); onOpenFullChat(); }}
            data-testid={`button-fullscreen-chat-${conversationId}`}
          >
            <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 hover:bg-gray-200 dark:hover:bg-secondary"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            data-testid={`button-close-chat-${conversationId}`}
          >
            <X className="w-4 h-4 text-gray-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}
