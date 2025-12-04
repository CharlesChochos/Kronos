import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Plus, Trash2, ChevronLeft, Loader2, Bot, User, Sparkles, Paperclip, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type AssistantConversation = {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssistantAttachment = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

type AssistantMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AssistantAttachment[];
  context?: any;
  createdAt: string;
};

export function ReaperAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<AssistantAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<AssistantConversation[]>({
    queryKey: ["/api/assistant/conversations"],
    enabled: isOpen,
  });

  // Auto-select most recent conversation or create new one when opening
  useEffect(() => {
    if (isOpen && !conversationsLoading && !activeConversationId) {
      if (conversations.length > 0) {
        setActiveConversationId(conversations[0].id);
        setShowConversations(false);
      }
    }
  }, [isOpen, conversationsLoading, conversations, activeConversationId]);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<AssistantMessage[]>({
    queryKey: [`/api/assistant/conversations/${activeConversationId}/messages`],
    enabled: !!activeConversationId,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "New Conversation" }),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setActiveConversationId(data.id);
      setShowConversations(false);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: AssistantAttachment[] }) => {
      if (!activeConversationId) throw new Error("No active conversation");
      const response = await fetch(`/api/assistant/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, attachments }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assistant/conversations/${activeConversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setInputValue("");
      setPendingFiles([]);
    },
    onSettled: () => {
      setIsTyping(false);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: AssistantAttachment[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const data = await response.json();
        newAttachments.push({
          id: data.id,
          filename: data.filename,
          url: data.url,
          mimeType: data.type,
          size: data.size,
          uploadedAt: data.uploadedAt,
        });
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    if (newAttachments.length > 0) {
      setPendingFiles(prev => [...prev, ...newAttachments]);
      toast.success(`${newAttachments.length} file(s) attached`);
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingFile = (fileId: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/assistant/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete conversation");
      return { deletedId: id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      if (activeConversationId === data.deletedId) {
        setActiveConversationId(null);
        setShowConversations(true);
      }
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && !showConversations && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, showConversations]);

  const handleSend = () => {
    if ((!inputValue.trim() && pendingFiles.length === 0) || sendMessage.isPending) return;
    
    // Build message content with file references for AI context
    let messageContent = inputValue.trim();
    if (pendingFiles.length > 0) {
      const fileInfo = pendingFiles.map(f => `[Attached file: ${f.filename} (${f.url})]`).join('\n');
      messageContent = messageContent ? `${messageContent}\n\n${fileInfo}` : fileInfo;
    }
    
    sendMessage.mutate({ 
      content: messageContent,
      attachments: pendingFiles.length > 0 ? pendingFiles : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    createConversation.mutate();
  };

  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    setShowConversations(false);
  };

  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('# ')) {
        return <h3 key={i} className="text-base font-semibold mt-2 mb-1">{line.slice(2)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={i} className="text-sm font-semibold mt-2 mb-1">{line.slice(3)}</h4>;
      }
      if (line.startsWith('### ')) {
        return <h5 key={i} className="text-sm font-medium mt-1 mb-0.5">{line.slice(4)}</h5>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
      }
      if (line.match(/^\d+\. /)) {
        return <li key={i} className="ml-4 text-sm list-decimal">{line.replace(/^\d+\. /, '')}</li>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="text-sm font-semibold">{line.slice(2, -2)}</p>;
      }
      if (line.trim() === '') {
        return <br key={i} />;
      }
      return <p key={i} className="text-sm">{line}</p>;
    });
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-6 w-[400px] h-[600px] bg-card border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
            data-testid="reaper-assistant-panel"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
              <div className="flex items-center gap-2">
                {!showConversations && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -ml-1"
                    onClick={() => setShowConversations(true)}
                    data-testid="button-back-conversations"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Kronos</h3>
                  <p className="text-[10px] text-muted-foreground">AI Assistant</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-assistant"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {showConversations ? (
                <div className="h-full flex flex-col">
                  <div className="p-3 border-b border-border">
                    <Button
                      onClick={startNewChat}
                      disabled={createConversation.isPending}
                      className="w-full gap-2"
                      data-testid="button-new-conversation"
                    >
                      {createConversation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      New Conversation
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    {conversationsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                          <MessageCircle className="w-6 h-6 text-primary/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">No conversations yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Start a new chat to get help with deals, tasks, and more</p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className="group flex items-center gap-2 p-2.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                            onClick={() => selectConversation(conv.id)}
                            data-testid={`conversation-${conv.id}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                              <MessageCircle className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{conv.title || 'New Conversation'}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(conv.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation.mutate(conv.id);
                              }}
                              data-testid={`delete-conversation-${conv.id}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <ScrollArea className="flex-1 p-3">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
                          <Bot className="w-8 h-8 text-primary" />
                        </div>
                        <h4 className="font-semibold mb-1">How can I help you?</h4>
                        <p className="text-xs text-muted-foreground">Ask me about deals, tasks, team activities, or platform features.</p>
                        <div className="mt-4 grid gap-2">
                          {[
                            "What deals are in progress?",
                            "Show my pending tasks",
                            "Team workload summary"
                          ].map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => {
                                setInputValue(suggestion);
                                inputRef.current?.focus();
                              }}
                              className="text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors"
                              data-testid={`suggestion-${suggestion.slice(0, 10)}`}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2",
                              msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                              msg.role === 'user' ? "bg-primary" : "bg-primary/20"
                            )}>
                              {msg.role === 'user' ? (
                                <User className="w-3.5 h-3.5 text-primary-foreground" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                              )}
                            </div>
                            <div className={cn(
                              "max-w-[80%] rounded-lg px-3 py-2",
                              msg.role === 'user' 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-secondary/50"
                            )}>
                              {msg.role === 'user' ? (
                                <div>
                                  <p className="text-sm">{msg.content.replace(/\[Attached file: [^\]]+\]/g, '').trim()}</p>
                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {msg.attachments.map((att) => (
                                        <a
                                          key={att.id}
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 text-xs bg-primary-foreground/10 px-2 py-1 rounded hover:bg-primary-foreground/20 transition-colors"
                                          data-testid={`attachment-${att.id}`}
                                        >
                                          <FileText className="w-3 h-3" />
                                          <span className="truncate max-w-[150px]">{att.filename}</span>
                                          <Download className="w-3 h-3 ml-auto" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  {formatMessageContent(msg.content)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {isTyping && (
                          <div className="flex gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="bg-secondary/50 rounded-lg px-3 py-2">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                  
                  <div className="p-3 border-t border-border">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      multiple
                      data-testid="input-file-upload"
                    />
                    
                    {pendingFiles.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {pendingFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-1 bg-secondary/50 text-xs px-2 py-1 rounded-md group"
                          >
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            <span className="truncate max-w-[120px]">{file.filename}</span>
                            <button
                              onClick={() => removePendingFile(file.id)}
                              className="ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`remove-file-${file.id}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 flex-shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendMessage.isPending || isUploading}
                        data-testid="button-attach-file"
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Paperclip className="w-4 h-4" />
                        )}
                      </Button>
                      <Textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Kronos anything..."
                        className="resize-none min-h-[44px] max-h-[120px]"
                        disabled={sendMessage.isPending}
                        data-testid="input-assistant-message"
                      />
                      <Button
                        onClick={handleSend}
                        disabled={(!inputValue.trim() && pendingFiles.length === 0) || sendMessage.isPending}
                        size="icon"
                        className="h-11 w-11 flex-shrink-0"
                        data-testid="button-send-message"
                      >
                        {sendMessage.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-50 flex items-center justify-center transition-colors",
          isOpen 
            ? "bg-secondary text-secondary-foreground" 
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        data-testid="button-open-reaper"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Sparkles className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        )}
      </motion.button>
    </>
  );
}
