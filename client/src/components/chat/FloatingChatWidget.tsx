import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MoreHorizontal,
  PenSquare,
  ChevronUp,
  ChevronDown,
  Search,
  Maximize2,
  Send,
  ArrowLeft,
  SlidersHorizontal
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
  const [activeTab, setActiveTab] = useState<'focused' | 'other'>('focused');
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
    refetchInterval: 5000,
  });
  
  // Fetch messages for active chat
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/chat/conversations/${activeChat}/messages`],
    enabled: !!activeChat,
    refetchInterval: 3000,
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
  
  // Filter conversations based on search and tab
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = getConversationName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  }).filter(conv => {
    // Focused = has recent activity or unread, Other = older conversations
    if (activeTab === 'focused') {
      return conv.unreadCount > 0 || conv.lastMessage;
    }
    return true;
  });
  
  const handleSendMessage = () => {
    if (!activeChat || !messageInput.trim()) return;
    sendMessageMutation.mutate({ conversationId: activeChat, content: messageInput.trim() });
  };
  
  const openFullChat = () => {
    const basePath = currentUser?.accessLevel === 'admin' ? '/ceo' : '/employee';
    setLocation(`${basePath}/chat`);
    setIsExpanded(false);
  };
  
  if (!currentUser) return null;
  
  // Get active conversation details
  const activeChatData = activeChat ? conversations.find(c => c.id === activeChat) : null;
  
  // Format date for conversation list
  const formatConversationDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return format(date, 'h:mm a');
    if (diffDays < 7) return format(date, 'EEE');
    return format(date, 'MMM d');
  };
  
  return (
    <div className="fixed bottom-6 right-6 z-40" data-testid="floating-chat-widget">
      {/* Expanded chat panel */}
      {isExpanded && (
        <Card className="w-80 mb-2 bg-white dark:bg-card border border-gray-200 dark:border-border shadow-xl rounded-lg overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {activeChat ? (
            // Active chat view
            <>
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-border flex items-center justify-between bg-white dark:bg-card">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 hover:bg-gray-100 dark:hover:bg-secondary"
                    onClick={() => setActiveChat(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {activeChatData ? getInitials(getConversationName(activeChatData)) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-card rounded-full" />
                  </div>
                  <span className="font-semibold text-sm text-gray-900 dark:text-foreground truncate max-w-[140px]">
                    {activeChatData ? getConversationName(activeChatData) : "Chat"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-gray-100 dark:hover:bg-secondary" onClick={openFullChat}>
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-0">
                <ScrollArea className="h-72 p-3 bg-gray-50 dark:bg-secondary/20">
                  {messages.map((msg) => (
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
                          : "bg-white dark:bg-card border border-gray-200 dark:border-border rounded-bl-sm"
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
                  ))}
                  <div ref={messagesEndRef} />
                </ScrollArea>
                <div className="p-2 border-t border-gray-200 dark:border-border flex gap-2 bg-white dark:bg-card">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Write a message..."
                    className="h-9 text-sm border-gray-200 dark:border-border rounded-full px-4"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    data-testid="input-floating-chat-message"
                  />
                  <Button 
                    size="icon" 
                    className="h-9 w-9 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || !messageInput.trim()}
                    data-testid="button-send-floating-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            // Conversation list view (LinkedIn style)
            <>
              {/* Header */}
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-border flex items-center justify-between bg-white dark:bg-card">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {currentUser ? getInitials(currentUser.name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-card rounded-full" />
                  </div>
                  <span className="font-semibold text-base text-gray-900 dark:text-foreground">Messaging</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-secondary rounded-full">
                    <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-secondary rounded-full" onClick={openFullChat}>
                    <PenSquare className="w-5 h-5 text-gray-600 dark:text-muted-foreground" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-secondary rounded-full"
                    onClick={() => setIsExpanded(false)}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-600 dark:text-muted-foreground" />
                  </Button>
                </div>
              </div>
              
              {/* Search */}
              <div className="px-3 py-2 border-b border-gray-200 dark:border-border bg-white dark:bg-card">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages"
                    className="h-8 pl-9 pr-9 text-sm bg-gray-100 dark:bg-secondary border-0 rounded-md"
                    data-testid="input-search-floating-chat"
                  />
                  <Button variant="ghost" size="icon" className="absolute right-0 h-8 w-8 hover:bg-transparent">
                    <SlidersHorizontal className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="px-3 border-b border-gray-200 dark:border-border bg-white dark:bg-card">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'focused' | 'other')}>
                  <TabsList className="bg-transparent h-10 p-0 gap-4">
                    <TabsTrigger 
                      value="focused" 
                      className="px-0 pb-2 pt-1 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-500 text-gray-500 dark:text-muted-foreground font-medium"
                    >
                      Focused
                    </TabsTrigger>
                    <TabsTrigger 
                      value="other"
                      className="px-0 pb-2 pt-1 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-500 text-gray-500 dark:text-muted-foreground font-medium"
                    >
                      Other
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              {/* Conversation List */}
              <CardContent className="p-0 bg-white dark:bg-card">
                <ScrollArea className="h-80">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-muted-foreground text-sm">
                      No conversations yet
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary/50 transition-colors border-b border-gray-100 dark:border-border/50",
                          conv.unreadCount > 0 && "bg-blue-50/50 dark:bg-primary/5"
                        )}
                        onClick={() => setActiveChat(conv.id)}
                        data-testid={`chat-conversation-${conv.id}`}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="text-sm bg-gray-200 dark:bg-secondary text-gray-700 dark:text-foreground">
                              {getInitials(getConversationName(conv))}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-card rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={cn(
                              "text-sm text-gray-900 dark:text-foreground truncate",
                              conv.unreadCount > 0 && "font-semibold"
                            )}>
                              {getConversationName(conv)}
                            </span>
                            {conv.lastMessage && (
                              <span className="text-xs text-gray-500 dark:text-muted-foreground shrink-0 ml-2">
                                {formatConversationDate(conv.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className={cn(
                              "text-sm truncate",
                              conv.unreadCount > 0 
                                ? "text-gray-900 dark:text-foreground font-medium" 
                                : "text-gray-500 dark:text-muted-foreground"
                            )}>
                              {conv.lastMessage.senderId === currentUser?.id ? 'You: ' : ''}
                              {conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] bg-blue-600 hover:bg-blue-600 shrink-0 mt-1">
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
      
      {/* Collapsed bar (LinkedIn style rectangular) */}
      <div 
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 rounded-lg shadow-lg cursor-pointer transition-all",
          "bg-white dark:bg-card border border-gray-200 dark:border-border",
          "hover:shadow-xl",
          isExpanded && "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsExpanded(true)}
        data-testid="button-toggle-floating-chat"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {currentUser ? getInitials(currentUser.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-card rounded-full" />
          </div>
          <span className="font-semibold text-sm text-gray-900 dark:text-foreground">Messaging</span>
          {totalUnread > 0 && (
            <Badge className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] bg-blue-600 hover:bg-blue-600">
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-gray-100 dark:hover:bg-secondary rounded-full"
            onClick={(e) => { e.stopPropagation(); openFullChat(); }}
            title="Open full chat"
            data-testid="button-chat-fullscreen"
          >
            <Maximize2 className="w-4 h-4 text-gray-600 dark:text-muted-foreground" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-gray-100 dark:hover:bg-secondary rounded-full"
            onClick={(e) => { e.stopPropagation(); openFullChat(); }}
            title="New message"
            data-testid="button-chat-new-message"
          >
            <PenSquare className="w-4 h-4 text-gray-600 dark:text-muted-foreground" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-gray-100 dark:hover:bg-secondary rounded-full"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
            title="Expand"
            data-testid="button-chat-expand"
          >
            <ChevronUp className="w-4 h-4 text-gray-600 dark:text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
}
