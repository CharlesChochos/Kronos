import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Check
} from "lucide-react";
import { useCurrentUser, useUsers } from "@/lib/api";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

type ChatProps = {
  role: 'CEO' | 'Employee';
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  attachments?: { name: string; type: string; size: number }[];
};

type Conversation = {
  id: string;
  name: string;
  isGroup: boolean;
  participants: { id: string; name: string }[];
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  messages: Message[];
};

export default function Chat({ role }: ChatProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useUsers();
  const { clearUnreadMessages } = useDashboardContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Demo conversations (in production, these would come from the database)
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "1",
      name: "Deal Team Alpha",
      isGroup: true,
      participants: [
        { id: "1", name: "John Smith" },
        { id: "2", name: "Sarah Johnson" },
      ],
      lastMessage: "Let's review the Q4 projections",
      lastMessageTime: new Date(Date.now() - 3600000),
      unreadCount: 2,
      messages: [
        {
          id: "m1",
          senderId: "1",
          senderName: "John Smith",
          content: "Hi team, have you reviewed the latest deal terms?",
          timestamp: new Date(Date.now() - 7200000),
        },
        {
          id: "m2",
          senderId: "2",
          senderName: "Sarah Johnson",
          content: "Yes, I've gone through them. The valuation looks reasonable.",
          timestamp: new Date(Date.now() - 5400000),
        },
        {
          id: "m3",
          senderId: "1",
          senderName: "John Smith",
          content: "Let's review the Q4 projections",
          timestamp: new Date(Date.now() - 3600000),
        },
      ],
    },
  ]);

  // Filter users excluding current user
  const availableUsers = allUsers.filter(u => u.id !== currentUser?.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation?.messages]);

  useEffect(() => {
    clearUnreadMessages();
  }, [clearUnreadMessages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser?.id || "",
      senderName: currentUser?.name || "You",
      content: messageInput,
      timestamp: new Date(),
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id === selectedConversation.id) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: messageInput,
          lastMessageTime: new Date(),
        };
      }
      return conv;
    }));

    setSelectedConversation(prev => prev ? {
      ...prev,
      messages: [...prev.messages, newMessage],
      lastMessage: messageInput,
      lastMessageTime: new Date(),
    } : null);

    setMessageInput("");
  };

  const handleCreateChat = (userId: string) => {
    const user = availableUsers.find(u => u.id === userId);
    if (!user) return;

    // Check if conversation already exists
    const existingConv = conversations.find(c => 
      !c.isGroup && c.participants.some(p => p.id === userId)
    );

    if (existingConv) {
      setSelectedConversation(existingConv);
      setShowNewChatModal(false);
      return;
    }

    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      name: user.name,
      isGroup: false,
      participants: [{ id: user.id, name: user.name }],
      unreadCount: 0,
      messages: [],
    };

    setConversations(prev => [newConversation, ...prev]);
    setSelectedConversation(newConversation);
    setShowNewChatModal(false);
    toast.success(`Started conversation with ${user.name}`);
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length < 2) {
      toast.error("Please enter a group name and select at least 2 members");
      return;
    }

    const participants = selectedUsers.map(id => {
      const user = availableUsers.find(u => u.id === id);
      return { id, name: user?.name || "Unknown" };
    });

    const newGroup: Conversation = {
      id: crypto.randomUUID(),
      name: groupName,
      isGroup: true,
      participants,
      unreadCount: 0,
      messages: [],
    };

    setConversations(prev => [newGroup, ...prev]);
    setSelectedConversation(newGroup);
    setShowNewGroupModal(false);
    setGroupName("");
    setSelectedUsers([]);
    toast.success(`Created group: ${groupName}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedConversation) return;

    Array.from(files).forEach(file => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        senderId: currentUser?.id || "",
        senderName: currentUser?.name || "You",
        content: `Shared a file: ${file.name}`,
        timestamp: new Date(),
        attachments: [{ name: file.name, type: file.type, size: file.size }],
      };

      setConversations(prev => prev.map(conv => {
        if (conv.id === selectedConversation.id) {
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            lastMessage: `Shared a file: ${file.name}`,
            lastMessageTime: new Date(),
          };
        }
        return conv;
      }));

      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, newMessage],
      } : null);
    });

    toast.success("File uploaded successfully");
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowNewGroupModal(true)}
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
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="px-2 pb-2">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        "w-full p-3 rounded-lg flex items-start gap-3 transition-colors text-left",
                        selectedConversation?.id === conv.id 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-secondary/50"
                      )}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className={cn(
                          "text-xs",
                          conv.isGroup ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-500"
                        )}>
                          {conv.isGroup 
                            ? conv.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                            : conv.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">{conv.name}</p>
                          {conv.lastMessageTime && (
                            <span className="text-xs text-muted-foreground">
                              {format(conv.lastMessageTime, 'HH:mm')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage || "No messages yet"}
                          </p>
                          {conv.unreadCount > 0 && (
                            <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        {conv.isGroup && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {conv.participants.length} members
                          </p>
                        )}
                      </div>
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
                        {selectedConversation.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedConversation.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.isGroup 
                          ? `${selectedConversation.participants.length} members`
                          : "Direct message"
                        }
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    {selectedConversation.messages.map(message => {
                      const isOwnMessage = message.senderId === currentUser?.id;
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-3",
                            isOwnMessage && "flex-row-reverse"
                          )}
                        >
                          {!isOwnMessage && (
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-secondary text-xs">
                                {message.senderName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={cn(
                            "max-w-[70%]",
                            isOwnMessage && "text-right"
                          )}>
                            {!isOwnMessage && selectedConversation.isGroup && (
                              <p className="text-xs text-muted-foreground mb-1">
                                {message.senderName}
                              </p>
                            )}
                            <div className={cn(
                              "rounded-lg p-3",
                              isOwnMessage 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-secondary"
                            )}>
                              <p className="text-sm">{message.content}</p>
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {message.attachments.map((att, i) => (
                                    <div 
                                      key={i}
                                      className={cn(
                                        "flex items-center gap-2 text-xs p-2 rounded",
                                        isOwnMessage 
                                          ? "bg-primary-foreground/10" 
                                          : "bg-background/50"
                                      )}
                                    >
                                      <File className="w-3 h-3" />
                                      <span className="truncate">{att.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className={cn(
                              "text-xs text-muted-foreground mt-1",
                              isOwnMessage && "text-right"
                            )}>
                              {format(message.timestamp, 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    className="hidden"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
                <p className="text-sm">Select a conversation or start a new chat</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* New Chat Modal */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">Select a team member to start chatting</p>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {availableUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleCreateChat(user.id)}
                    className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Group Modal */}
      <Dialog open={showNewGroupModal} onOpenChange={setShowNewGroupModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Select Members (minimum 2)</Label>
              <ScrollArea className="h-48 border border-border rounded-lg p-2">
                <div className="space-y-2">
                  {availableUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers(prev => [...prev, user.id]);
                          } else {
                            setSelectedUsers(prev => prev.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroupModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedUsers.length < 2}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
