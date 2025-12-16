import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  X,
  Maximize2,
  Send,
  MessageSquare,
  ChevronDown,
  ChevronUp
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

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
};

type OpenChat = {
  conversationId: string;
  isMinimized: boolean;
};

const MAX_OPEN_CHATS = 3;

// Global audio context to handle browser autoplay restrictions
let audioUnlocked = false;
let notificationAudio: HTMLAudioElement | null = null;

const initAudio = () => {
  if (!notificationAudio) {
    notificationAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQYAJ5rk/+WxOgAAU+b/+9BQAABU7f/61VcAAFLr//bQVAAAT+f/9MxQAABM4//xyEsAAEne/+7ERAD/Rdn/7MBAAP9C1f/qvDsA/z/R/+i4NgD/PNT/57Q0AP8x0P/krS8A/yjM/+KnKgD/H8j/4KElAP8Vw//enhsA/wzA/92VFgD/A73/25ERAP/6uv/ajw0A//a4/9mMCAD/8rb/2IoDAP/vsf/YhP//+6uu/9eA+//+q6z/1n73//+oqv/Ueu7/');
    notificationAudio.volume = 0.7;
  }
};

const playNotificationSound = () => {
  if (notificationAudio && audioUnlocked) {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {});
  }
};

// Unlock audio on first user interaction
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

export function DockedChatBoxes() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [showMessagingMenu, setShowMessagingMenu] = useState(false);
  const lastSeenMessagesRef = useRef<Record<string, string>>({});
  const mountTimeRef = useRef(Date.now());
  
  useEffect(() => {
    initAudio();
  }, []);
  
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

  // Auto-open chat for new messages
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

  const getInitials = (name: string) => {
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
      {/* Open chat boxes - positioned to the left of the messaging button */}
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
      
      {/* Messaging button - always on the far right */}
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

  useEffect(() => {
    if (!isMinimized && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate({ conversationId, content: messageInput.trim() });
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
      {/* Chat content - above the header bar */}
      {!isMinimized && (
        <div className="bg-white dark:bg-card">
          <ScrollArea className="h-80 p-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "mb-3 max-w-[85%]",
                    msg.senderId === currentUser?.id ? "ml-auto" : ""
                  )}
                >
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
                  <div className={cn(
                    "text-[10px] text-gray-400 mt-0.5 px-1",
                    msg.senderId === currentUser?.id ? "text-right" : ""
                  )}>
                    {format(new Date(msg.createdAt), 'h:mm a')}
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </ScrollArea>
          <div className="p-2 border-t border-gray-200 dark:border-border flex gap-2 bg-white dark:bg-card">
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
      
      {/* Header bar - at the bottom, LinkedIn style */}
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
