import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Plus, Trash2, ChevronLeft, Loader2, Bot, User, Sparkles, Paperclip, FileText, Download, Settings, Mic, MicOff, Volume2, VolumeX, Maximize2, Minimize2, Share2, Copy, Check, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCurrentUser, useUserPreferences, useSaveUserPreferences } from "@/lib/api";
import type { UserPreferences } from "@shared/schema";

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

type WindowSize = 'compact' | 'normal' | 'expanded';

const WINDOW_SIZES: Record<WindowSize, { width: string; height: string }> = {
  compact: { width: '350px', height: '500px' },
  normal: { width: '400px', height: '600px' },
  expanded: { width: '550px', height: '80vh' },
};

export function ReaperAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<AssistantAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [textToSpeechEnabled, setTextToSpeechEnabled] = useState(false);
  const [windowSize, setWindowSize] = useState<WindowSize>('normal');
  const [responseStyle, setResponseStyle] = useState<'concise' | 'detailed' | 'technical'>('concise');
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  
  // Conversation editing state
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  
  // Get current user for role-based prompts
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.accessLevel === 'admin';
  const queryClient = useQueryClient();
  
  // User preferences for persistence
  const { data: userPrefs } = useUserPreferences();
  const saveUserPrefs = useSaveUserPreferences();
  const [prefsInitialized, setPrefsInitialized] = useState(false);
  
  // Load preferences on mount
  useEffect(() => {
    if (userPrefs && !prefsInitialized) {
      const assistantSettings = (userPrefs?.settings as any)?.assistantSettings;
      if (assistantSettings) {
        setVoiceEnabled(assistantSettings.voiceEnabled ?? false);
        setTextToSpeechEnabled(assistantSettings.textToSpeechEnabled ?? false);
        setWindowSize(assistantSettings.windowSize ?? 'normal');
        setResponseStyle(assistantSettings.responseStyle ?? 'concise');
        setAutoSuggest(assistantSettings.autoSuggest ?? true);
        setSoundNotifications(assistantSettings.soundNotifications ?? true);
      }
      setPrefsInitialized(true);
    }
  }, [userPrefs, prefsInitialized]);
  
  // Save preferences when they change
  const saveAssistantPreferences = useCallback(() => {
    if (!prefsInitialized) return;
    
    const freshPrefs = queryClient.getQueryData<UserPreferences>(['userPreferences']) || userPrefs;
    const { id, userId, updatedAt, ...mutablePrefs } = (freshPrefs || {}) as any;
    const existingSettings = (freshPrefs?.settings as any) || {};
    
    saveUserPrefs.mutate({
      ...mutablePrefs,
      settings: {
        ...existingSettings,
        assistantSettings: {
          voiceEnabled,
          textToSpeechEnabled,
          windowSize,
          responseStyle,
          autoSuggest,
          soundNotifications,
        },
      },
    });
  }, [prefsInitialized, userPrefs, queryClient, voiceEnabled, textToSpeechEnabled, windowSize, responseStyle, autoSuggest, soundNotifications, saveUserPrefs]);
  
  // Role-based quick prompts
  const quickPrompts = useMemo(() => ({
    actions: isAdmin ? [
      { text: "What deals need attention?", icon: "📊" },
      { text: "Recommend next steps for...", icon: "🎯" },
      { text: "Find investors for...", icon: "🤝" },
    ] : [
      { text: "Create a task for...", icon: "📋" },
      { text: "Schedule a meeting with...", icon: "📅" },
      { text: "What are my priorities today?", icon: "🎯" },
    ],
    insights: isAdmin ? [
      { text: "Pipeline overview", icon: "📈" },
      { text: "Team workload summary", icon: "👥" },
      { text: "Which deals are stalled?", icon: "⚠️" },
    ] : [
      { text: "What's overdue?", icon: "⏰" },
      { text: "My upcoming meetings", icon: "📅" },
      { text: "My task summary", icon: "📋" },
    ],
    documents: isAdmin ? [
      { text: "Generate a term sheet for...", icon: "📝" },
      { text: "Draft an investor update for...", icon: "✉️" },
      { text: "Create a deal memo for...", icon: "📄" },
    ] : [
      { text: "Draft an NDA for...", icon: "📄" },
      { text: "Create a due diligence checklist", icon: "✅" },
      { text: "Draft an email for...", icon: "✉️" },
    ],
  }), [isAdmin]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Listen for custom event to open the assistant from sidebar
  useEffect(() => {
    const handleOpenAssistant = () => {
      setIsOpen(true);
    };
    
    window.addEventListener('openKronosAssistant', handleOpenAssistant);
    return () => {
      window.removeEventListener('openKronosAssistant', handleOpenAssistant);
    };
  }, []);
  
  // Initialize speech recognition (supports both webkit and standard)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';
    
    recognitionRef.current.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setInputValue(transcript);
    };
    
    recognitionRef.current.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
      }
    };
  }, []);
  
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      toast.success('Listening... Speak now');
    }
  }, [isListening]);
  
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);
  
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    if (!textToSpeechEnabled || !('speechSynthesis' in window)) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, [textToSpeechEnabled]);
  
  // Cancel speech when TTS is disabled
  useEffect(() => {
    if (!textToSpeechEnabled && isSpeaking) {
      stopSpeaking();
    }
  }, [textToSpeechEnabled, isSpeaking, stopSpeaking]);
  
  const cycleWindowSize = useCallback(() => {
    setWindowSize(prev => {
      if (prev === 'compact') return 'normal';
      if (prev === 'normal') return 'expanded';
      return 'compact';
    });
  }, []);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<AssistantConversation[]>({
    queryKey: ["/api/assistant/conversations"],
    enabled: isOpen,
  });

  // Query team members for @ mentions
  const { data: teamMembers = [] } = useQuery<{ id: string; name: string; role: string }[]>({
    queryKey: ["/api/users"],
    enabled: isOpen,
    select: (data: any[]) => data.filter((u: any) => u.id !== currentUser?.id).map((u: any) => ({
      id: u.id,
      name: u.name,
      role: u.role || 'Team Member',
    })),
  });

  // Filter team members based on mention query
  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return teamMembers.slice(0, 5);
    return teamMembers
      .filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 5);
  }, [teamMembers, mentionQuery]);

  // Handle input change for @ mentions
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Check for @ mentions
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentions(true);
      setMentionQuery(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  }, []);

  // Track pending mentions with their user IDs - keyed by unique mention token
  const [pendingMentions, setPendingMentions] = useState<Map<string, { userId: string; userName: string }>>(new Map());

  // Insert mention into input
  const insertMention = useCallback((member: { id: string; name: string }) => {
    const cursorPos = inputRef.current?.selectionStart || inputValue.length;
    const textBeforeCursor = inputValue.slice(0, cursorPos);
    const textAfterCursor = inputValue.slice(cursorPos);
    
    // Replace the @query with @[name:id] (embed ID to ensure uniqueness)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const newTextBefore = textBeforeCursor.slice(0, -mentionMatch[0].length);
      const mentionToken = `@[${member.name}:${member.id}]`;
      const newValue = `${newTextBefore}${mentionToken} ${textAfterCursor}`;
      setInputValue(newValue);
      
      // Track this mention with its user ID - key by ID for uniqueness
      setPendingMentions(prev => {
        const updated = new Map(prev);
        updated.set(member.id, { userId: member.id, userName: member.name });
        return updated;
      });
    }
    
    setShowMentions(false);
    setMentionQuery("");
    inputRef.current?.focus();
  }, [inputValue]);

  // Handle keyboard navigation for mentions
  const handleMentionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showMentions || filteredMentions.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => (prev + 1) % filteredMentions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertMention(filteredMentions[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    }
  }, [showMentions, filteredMentions, mentionIndex, insertMention]);

  // State to track if we need to create a conversation (used by useEffect below)
  const [shouldCreateConversation, setShouldCreateConversation] = useState(false);
  // Track if we just deleted a conversation to prevent auto-create
  const [justDeleted, setJustDeleted] = useState(false);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<AssistantMessage[]>({
    queryKey: [`/api/assistant/conversations/${activeConversationId}/messages`],
    enabled: !!activeConversationId,
  });

  const generateConversationSummary = useCallback(() => {
    if (messages.length === 0) return '';
    
    const summary = messages.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'Kronos';
      return `**${role}:** ${msg.content}`;
    }).join('\n\n---\n\n');
    
    const activeConv = conversations.find(c => c.id === activeConversationId);
    const header = `# Kronos AI Assistant - Conversation Summary\n\n**Topic:** ${activeConv?.title || 'Conversation'}\n**Date:** ${new Date().toLocaleDateString()}\n\n---\n\n`;
    
    return header + summary;
  }, [messages, conversations, activeConversationId]);
  
  const copyConversationToClipboard = useCallback(async () => {
    const summary = generateConversationSummary();
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedToClipboard(true);
      toast.success('Conversation copied to clipboard');
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  }, [generateConversationSummary]);

  const exportToPDF = useCallback(async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      
      const activeConv = conversations.find(c => c.id === activeConversationId);
      const title = activeConv?.title || 'Kronos Conversation';
      
      // Set up document
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Kronos AI Assistant', 20, 20);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Topic: ${title}`, 20, 30);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 38);
      doc.text(`Exported by: ${currentUser?.name || 'User'}`, 20, 46);
      
      // Draw separator line
      doc.setDrawColor(200);
      doc.line(20, 52, 190, 52);
      
      let yPosition = 62;
      const pageHeight = 280;
      const lineHeight = 6;
      const maxWidth = 170;
      
      for (const msg of messages) {
        const role = msg.role === 'user' ? 'You' : 'Kronos';
        
        // Check if we need a new page
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Role header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(msg.role === 'user' ? 70 : 30, 100, 170);
        doc.text(`${role}:`, 20, yPosition);
        yPosition += lineHeight;
        
        // Message content
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        
        // Clean up markdown formatting for PDF
        const cleanContent = msg.content
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/#{1,6}\s/g, '')
          .replace(/```[\s\S]*?```/g, '[Code Block]');
        
        const lines = doc.splitTextToSize(cleanContent, maxWidth);
        for (const line of lines) {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += lineHeight;
        }
        
        yPosition += lineHeight; // Space between messages
      }
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text('Equiturn - Kronos Platform', 105, 295, { align: 'center' });
      }
      
      // Download the PDF
      doc.save(`kronos-conversation-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported successfully');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF');
    }
  }, [messages, conversations, activeConversationId, currentUser]);

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
      setShouldCreateConversation(false);
    },
  });

  // Auto-select most recent conversation or create new one when opening
  useEffect(() => {
    // Don't auto-create if we just deleted a conversation
    if (justDeleted) return;
    
    if (isOpen && !conversationsLoading && !activeConversationId && !createConversation.isPending) {
      if (conversations.length > 0) {
        setActiveConversationId(conversations[0].id);
        setShowConversations(false);
      } else {
        // No conversations exist, create one automatically
        setShouldCreateConversation(true);
      }
    }
  }, [isOpen, conversationsLoading, conversations, activeConversationId, createConversation.isPending, justDeleted]);

  // Handle the actual creation after state is set (to avoid hoisting issues)
  useEffect(() => {
    if (shouldCreateConversation && !createConversation.isPending) {
      createConversation.mutate();
    }
  }, [shouldCreateConversation, createConversation.isPending]);

  const sendMessage = useMutation({
    mutationFn: async ({ content, attachments, mentions }: { 
      content: string; 
      attachments?: AssistantAttachment[];
      mentions?: { userId: string; userName: string; notified: boolean }[];
    }) => {
      if (!activeConversationId) throw new Error("No active conversation");
      const response = await fetch(`/api/assistant/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, attachments, mentions }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/assistant/conversations/${activeConversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setInputValue("");
      setPendingFiles([]);
      // Speak the assistant's response if text-to-speech is enabled
      if (data?.assistantMessage?.content && textToSpeechEnabled) {
        speakText(data.assistantMessage.content);
      }
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
      setJustDeleted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      if (activeConversationId === data.deletedId) {
        setActiveConversationId(null);
        setShowConversations(true);
      }
      toast.success("Conversation deleted");
      // Reset justDeleted after a short delay
      setTimeout(() => setJustDeleted(false), 1000);
    },
  });
  
  const renameConversation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const response = await fetch(`/api/assistant/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Failed to rename conversation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setShowRenameDialog(false);
      setEditingConversationId(null);
      setEditingTitle("");
      toast.success("Conversation renamed");
    },
    onError: () => {
      toast.error("Failed to rename conversation");
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
    
    // Extract @ mentions from the message - pattern: @[Name:userId]
    const mentionMatches = messageContent.match(/@\[([^:\]]+):([^\]]+)\]/g) || [];
    const mentions = mentionMatches
      .map(match => {
        // Parse @[Name:userId] format
        const innerMatch = match.match(/@\[([^:\]]+):([^\]]+)\]/);
        if (innerMatch) {
          const [, name, userId] = innerMatch;
          return { userId, userName: name, notified: false };
        }
        return null;
      })
      .filter((m): m is { userId: string; userName: string; notified: boolean } => m !== null);
    
    // Clean up the message content: replace @[Name:id] with @Name for display
    const cleanedContent = messageContent.replace(/@\[([^:\]]+):[^\]]+\]/g, '@$1');
    
    sendMessage.mutate({ 
      content: cleanedContent,
      attachments: pendingFiles.length > 0 ? pendingFiles : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
    });
    
    // Clear pending mentions after sending
    setPendingMentions(new Map());
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

  const currentSize = WINDOW_SIZES[windowSize];
  
  return (
    <>
      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Share Conversation</DialogTitle>
            <DialogDescription>Copy or share this conversation summary with your team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-secondary/30 rounded-lg p-3 max-h-[300px] overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {generateConversationSummary()}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={copyConversationToClipboard}
                className="flex-1 gap-2"
                variant="outline"
                data-testid="button-copy-conversation"
              >
                {copiedToClipboard ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                onClick={exportToPDF}
                className="flex-1 gap-2"
                data-testid="button-export-pdf"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Copy to clipboard or download as a formatted PDF document.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Kronos Settings</DialogTitle>
            <DialogDescription>Configure your AI assistant preferences</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="voice">Voice</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Response Style</Label>
                <Select value={responseStyle} onValueChange={(v) => setResponseStyle(v as any)}>
                  <SelectTrigger data-testid="select-response-style">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise - Brief, to-the-point answers</SelectItem>
                    <SelectItem value="detailed">Detailed - Comprehensive explanations</SelectItem>
                    <SelectItem value="technical">Technical - Include technical details</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-suggest">Auto-Suggest</Label>
                  <p className="text-xs text-muted-foreground">Show suggested prompts on new conversations</p>
                </div>
                <Switch
                  id="auto-suggest"
                  checked={autoSuggest}
                  onCheckedChange={setAutoSuggest}
                  data-testid="switch-auto-suggest"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sound-notifications">Sound Notifications</Label>
                  <p className="text-xs text-muted-foreground">Play sound when receiving responses</p>
                </div>
                <Switch
                  id="sound-notifications"
                  checked={soundNotifications}
                  onCheckedChange={setSoundNotifications}
                  data-testid="switch-sound-notifications"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="voice" className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="voice-input">Voice Input</Label>
                  <p className="text-xs text-muted-foreground">Use microphone to speak to Kronos</p>
                </div>
                <Switch
                  id="voice-input"
                  checked={voiceEnabled}
                  onCheckedChange={setVoiceEnabled}
                  data-testid="switch-voice-input"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="text-to-speech">Text-to-Speech</Label>
                  <p className="text-xs text-muted-foreground">Have Kronos read responses aloud</p>
                </div>
                <Switch
                  id="text-to-speech"
                  checked={textToSpeechEnabled}
                  onCheckedChange={setTextToSpeechEnabled}
                  data-testid="switch-text-to-speech"
                />
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Voice features use your browser's built-in speech recognition and synthesis. 
                  Availability may vary by browser.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="display" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Window Size</Label>
                <div className="flex gap-2">
                  {(['compact', 'normal', 'expanded'] as WindowSize[]).map((size) => (
                    <Button
                      key={size}
                      variant={windowSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setWindowSize(size)}
                      className="flex-1 capitalize"
                      data-testid={`button-size-${size}`}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose how large the assistant window appears
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              saveAssistantPreferences();
              setShowSettings(false);
              toast.success("Settings saved");
            }}>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Rename Conversation Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>Give this conversation a descriptive name</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="conversation-name">Conversation Name</Label>
            <Input
              id="conversation-name"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Enter a name..."
              className="mt-2"
              data-testid="input-conversation-name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editingTitle.trim() && editingConversationId) {
                  renameConversation.mutate({ id: editingConversationId, title: editingTitle.trim() });
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRenameDialog(false);
              setEditingConversationId(null);
              setEditingTitle("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingConversationId && editingTitle.trim()) {
                  renameConversation.mutate({ id: editingConversationId, title: editingTitle.trim() });
                }
              }}
              disabled={!editingTitle.trim() || renameConversation.isPending}
            >
              {renameConversation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ width: currentSize.width, height: currentSize.height }}
            className="fixed bottom-24 left-4 right-4 md:left-20 md:right-auto md:bottom-20 bg-card border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-200"
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
              <div className="flex items-center gap-1">
                {isSpeaking && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={stopSpeaking}
                    data-testid="button-stop-speaking"
                  >
                    <VolumeX className="w-4 h-4 text-primary animate-pulse" />
                  </Button>
                )}
                {messages.length > 0 && !showConversations && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowShareDialog(true)}
                    title="Share conversation"
                    data-testid="button-share-conversation"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={cycleWindowSize}
                  title={`Current: ${windowSize}`}
                  data-testid="button-resize-window"
                >
                  {windowSize === 'expanded' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowSettings(true)}
                  data-testid="button-open-settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
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
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingConversationId(conv.id);
                                  setEditingTitle(conv.title || '');
                                  setShowRenameDialog(true);
                                }}
                                title="Rename"
                                data-testid={`rename-conversation-${conv.id}`}
                              >
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteConversation.mutate(conv.id);
                                }}
                                title="Delete"
                                data-testid={`delete-conversation-${conv.id}`}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
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
                      <div className="text-center py-4 px-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
                          <Bot className="w-8 h-8 text-primary" />
                        </div>
                        <h4 className="font-semibold mb-1">How can I help you?</h4>
                        <p className="text-xs text-muted-foreground mb-4">Ask about deals, tasks, or let me take actions for you.</p>
                        
                        <div className="text-left space-y-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                              {isAdmin ? 'Executive Actions' : 'Quick Actions'}
                            </p>
                            <div className="grid gap-1.5">
                              {quickPrompts.actions.map((suggestion) => (
                                <button
                                  key={suggestion.text}
                                  onClick={() => {
                                    setInputValue(suggestion.text);
                                    inputRef.current?.focus();
                                  }}
                                  className="text-xs px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-left transition-colors flex items-center gap-2 border border-primary/10"
                                  data-testid={`action-${suggestion.text.slice(0, 10)}`}
                                >
                                  <span>{suggestion.icon}</span>
                                  <span>{suggestion.text}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                              {isAdmin ? 'Portfolio Insights' : 'My Insights'}
                            </p>
                            <div className="grid gap-1.5">
                              {quickPrompts.insights.map((suggestion) => (
                                <button
                                  key={suggestion.text}
                                  onClick={() => {
                                    setInputValue(suggestion.text);
                                    inputRef.current?.focus();
                                  }}
                                  className="text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors flex items-center gap-2"
                                  data-testid={`insight-${suggestion.text.slice(0, 10)}`}
                                >
                                  <span>{suggestion.icon}</span>
                                  <span>{suggestion.text}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Documents</p>
                            <div className="grid gap-1.5">
                              {quickPrompts.documents.map((suggestion) => (
                                <button
                                  key={suggestion.text}
                                  onClick={() => {
                                    setInputValue(suggestion.text);
                                    inputRef.current?.focus();
                                  }}
                                  className="text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors flex items-center gap-2"
                                  data-testid={`doc-${suggestion.text.slice(0, 10)}`}
                                >
                                  <span>{suggestion.icon}</span>
                                  <span>{suggestion.text}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Deal Intelligence</p>
                            <div className="grid gap-1.5">
                              {[
                                { text: "Recommend next steps for...", icon: "💡" },
                                { text: "Find matching investors for...", icon: "🎯" },
                              ].map((suggestion) => (
                                <button
                                  key={suggestion.text}
                                  onClick={() => {
                                    setInputValue(suggestion.text);
                                    inputRef.current?.focus();
                                  }}
                                  className="text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors flex items-center gap-2"
                                  data-testid={`intel-${suggestion.text.slice(0, 10)}`}
                                >
                                  <span>{suggestion.icon}</span>
                                  <span>{suggestion.text}</span>
                                </button>
                              ))}
                            </div>
                          </div>
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
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,image/*"
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
                    
                    <div className="flex gap-2 relative">
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
                      {voiceEnabled && (
                        <Button
                          variant={isListening ? "default" : "outline"}
                          size="icon"
                          className={cn("h-11 w-11 flex-shrink-0", isListening && "bg-red-500 hover:bg-red-600")}
                          onClick={toggleListening}
                          disabled={sendMessage.isPending}
                          data-testid="button-voice-input"
                        >
                          {isListening ? (
                            <MicOff className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                          if (showMentions) {
                            handleMentionKeyDown(e);
                            if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
                          }
                          handleKeyDown(e);
                        }}
                        placeholder={isListening ? "Listening..." : "Ask Kronos anything... (@ to mention)"}
                        className="resize-none min-h-[44px] max-h-[120px]"
                        disabled={sendMessage.isPending}
                        data-testid="input-assistant-message"
                      />
                      {/* @ Mentions popup */}
                      {showMentions && filteredMentions.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                          <div className="p-1 text-xs text-muted-foreground border-b border-border px-2 py-1">
                            Tag a team member
                          </div>
                          {filteredMentions.map((member, idx) => (
                            <button
                              key={member.id}
                              onClick={() => insertMention(member)}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                                idx === mentionIndex && "bg-accent"
                              )}
                              data-testid={`mention-${member.id}`}
                            >
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                                {member.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-xs text-muted-foreground">{member.jobTitle || member.role}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
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

    </>
  );
}
