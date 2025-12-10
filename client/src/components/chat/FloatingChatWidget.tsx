import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  X, 
  ChevronUp, 
  ChevronDown,
  Search,
  Maximize2,
  Send
} from "lucide-react";
import { useCurrentUser, useUsers } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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

export function FloatingChatWidget() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useUsers();
  const queryClient = useQueryClient();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessagesRef = useRef<Message[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQYAJ5rk/+WxOgAAU+b/+9BQAABU7f/61VcAAFLr//bQVAAAT+f/9MxQAABM4//xyEsAAEne/+7ERAD/Rdn/7MBAAP9C1f/qvDsA/z/R/+i4NgD/PNT/57Q0AP8x0P/krS8A/yjM/+KnKgD/H8j/4KElAP8Vw//enhsA/wzA/92VFgD/A73/25ERAP/6uv/ajw0A//a4/9mMCAD/8rb/2IoDAP/vsf/YhP//+6uu/9eA+//+q6z/1n73//+oqv/Ueu7/');
    audioRef.current.volume = 0.5;
  }, []);
  
  // Fetch conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 5000, // Poll every 5 seconds
  });
  
  // Fetch messages for active chat
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/chat/conversations/${activeChat}/messages`],
    enabled: !!activeChat,
    refetchInterval: 3000, // Poll every 3 seconds when active
  });
  
  // Play sound on new messages
  useEffect(() => {
    if (messages.length > 0 && previousMessagesRef.current.length > 0) {
      const newMessages = messages.filter(
        m => !previousMessagesRef.current.some(pm => pm.id === m.id) && 
        m.senderId !== currentUser?.id
      );
      if (newMessages.length > 0 && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
    previousMessagesRef.current = messages;
  }, [messages, currentUser?.id]);
  
  // Listen for new messages in any conversation
  useEffect(() => {
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    // Could trigger sound here for global unread count changes
  }, [conversations]);
  
  // Send message mutation
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
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${activeChat}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setMessageInput("");
    },
  });
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  
  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.isGroup) return "Group Chat";
    const otherMember = conv.members.find(m => m.id !== currentUser?.id);
    return otherMember?.name || "Chat";
  };
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = getConversationName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });
  
  const handleSendMessage = () => {
    if (!activeChat || !messageInput.trim()) return;
    sendMessageMutation.mutate({ conversationId: activeChat, content: messageInput.trim() });
  };
  
  const openFullChat = () => {
    setLocation('/ceo/chat');
    setIsExpanded(false);
  };
  
  if (!currentUser) return null;
  
  // Get active conversation details
  const activeChatData = activeChat ? conversations.find(c => c.id === activeChat) : null;
  
  return (
    <div className="fixed bottom-4 right-4 z-40" data-testid="floating-chat-widget">
      {/* Main chat widget */}
      {isExpanded && (
        <Card className="w-80 mb-2 bg-card border-border shadow-xl animate-in slide-in-from-bottom-2 duration-200">
          {activeChat ? (
            // Active chat view
            <>
              <CardHeader className="p-3 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => setActiveChat(null)}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/20">
                      {activeChatData ? getInitials(getConversationName(activeChatData)) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm truncate max-w-[150px]">
                    {activeChatData ? getConversationName(activeChatData) : "Chat"}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openFullChat}>
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-64 p-3">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={cn(
                        "mb-2 max-w-[85%]",
                        msg.senderId === currentUser?.id ? "ml-auto" : ""
                      )}
                    >
                      <div className={cn(
                        "rounded-lg p-2 text-sm",
                        msg.senderId === currentUser?.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-secondary"
                      )}>
                        {msg.senderId !== currentUser?.id && (
                          <div className="text-xs font-medium mb-1 opacity-70">{msg.senderName}</div>
                        )}
                        {msg.content}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 px-1">
                        {format(new Date(msg.createdAt), 'h:mm a')}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </ScrollArea>
                <div className="p-2 border-t border-border flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    data-testid="input-floating-chat-message"
                  />
                  <Button 
                    size="icon" 
                    className="h-8 w-8 shrink-0"
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending}
                    data-testid="button-send-floating-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            // Conversation list view
            <>
              <CardHeader className="p-3 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Messages</span>
                  {totalUnread > 0 && (
                    <Badge className="h-5 px-1.5 text-[10px]">{totalUnread}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openFullChat}>
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(false)}>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages"
                    className="h-8 pl-8 text-sm"
                    data-testid="input-search-floating-chat"
                  />
                </div>
                <ScrollArea className="h-72">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No conversations yet
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors",
                          conv.unreadCount > 0 && "bg-primary/5"
                        )}
                        onClick={() => setActiveChat(conv.id)}
                        data-testid={`chat-conversation-${conv.id}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-xs bg-primary/20">
                            {getInitials(getConversationName(conv))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-sm truncate",
                              conv.unreadCount > 0 && "font-semibold"
                            )}>
                              {getConversationName(conv)}
                            </span>
                            {conv.lastMessage && (
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(conv.lastMessage.createdAt), 'MMM d')}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </>
          )}
        </Card>
      )}
      
      {/* Floating button */}
      <Button
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg",
          isExpanded ? "bg-secondary hover:bg-secondary/80" : "bg-primary hover:bg-primary/90"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid="button-toggle-floating-chat"
      >
        {isExpanded ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {totalUnread > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]">
                {totalUnread > 9 ? '9+' : totalUnread}
              </Badge>
            )}
          </div>
        )}
      </Button>
    </div>
  );
}
