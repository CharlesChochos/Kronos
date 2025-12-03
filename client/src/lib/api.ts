import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User, Deal, Task, InsertUser, Meeting, Notification, TimeEntry, InsertTimeEntry, TimeOffRequest, InsertTimeOffRequest, AuditLog, Investor, InsertInvestor, InvestorInteraction, InsertInvestorInteraction, Okr, InsertOkr, Stakeholder, InsertStakeholder, Announcement, InsertAnnouncement, Poll, InsertPoll, MentorshipPairing, InsertMentorshipPairing, ClientPortalAccess, InsertClientPortalAccess, DocumentTemplate, InsertDocumentTemplate } from "@shared/schema";

// Generic API request helper
export async function apiRequest(method: string, url: string, body?: any): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res;
}

// Auth API
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Signup failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Logout failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.clear();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch current user");
      }
      return res.json() as Promise<User>;
    },
    retry: false,
  });
}

// User API
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<User[]>;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json() as Promise<User>;
    },
    enabled: !!id,
  });
}

// Deal API
export function useDeals() {
  return useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const res = await fetch("/api/deals");
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json() as Promise<Deal[]>;
    },
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ["deals", id],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${id}`);
      if (!res.ok) throw new Error("Failed to fetch deal");
      return res.json() as Promise<Deal>;
    },
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deal: Omit<Deal, "id" | "createdAt">) => {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deal),
      });
      if (!res.ok) throw new Error("Failed to create deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Deal> & { id: string }) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to update deal" }));
        throw new Error(errorData.error || "Failed to update deal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

// Task API
export function useTasks(filters?: { userId?: string; dealId?: string }) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set("userId", filters.userId);
      if (filters?.dealId) params.set("dealId", filters.dealId);
      const query = params.toString();
      const res = await fetch(`/api/tasks${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json() as Promise<Task[]>;
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json() as Promise<Task>;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<Task, "id" | "createdAt">) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Meeting API
export function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) throw new Error("Failed to fetch meetings");
      return res.json() as Promise<Meeting[]>;
    },
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meeting: Omit<Meeting, "id" | "createdAt">) => {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meeting),
      });
      if (!res.ok) throw new Error("Failed to create meeting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      // Also invalidate notifications since meeting creation creates notifications
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Meeting> & { id: string }) => {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update meeting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete meeting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

// Notification API
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<Notification[]>;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// Market Data API
export type MarketDataItem = {
  name: string;
  symbol: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  description: string;
};

export type MarketDataResponse = {
  source: 'live' | 'simulated';
  data: MarketDataItem[];
};

export function useMarketData(symbols?: string[]) {
  return useQuery({
    queryKey: ["market-data", symbols?.join(',')],
    queryFn: async () => {
      const url = symbols && symbols.length > 0 
        ? `/api/market-data?symbols=${symbols.join(',')}`
        : "/api/market-data";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch market data");
      return res.json() as Promise<MarketDataResponse>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}

// Market News API
export type MarketNewsItem = {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image?: string;
  datetime: string;
  category: string;
  related?: string;
};

export type MarketNewsResponse = {
  source: 'live' | 'sample';
  data: MarketNewsItem[];
};

export function useMarketNews(category?: string) {
  return useQuery({
    queryKey: ["market-news", category],
    queryFn: async () => {
      const url = category 
        ? `/api/market-news?category=${category}`
        : "/api/market-news";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch market news");
      return res.json() as Promise<MarketNewsResponse>;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

// AI Document Generation
export function useGenerateDocument() {
  return useMutation({
    mutationFn: async ({ templateName, dealData, complianceOptions }: { 
      templateName: string; 
      dealData: any; 
      complianceOptions: { sec: boolean; finra: boolean; legal: boolean } 
    }) => {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName, dealData, complianceOptions }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate document");
      }
      return res.json() as Promise<{ content: string }>;
    },
  });
}

// User Profile API
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: { name?: string; email?: string; phone?: string; avatar?: string; role?: string } }) => {
      const res = await fetch(`/api/users/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }
      return res.json() as Promise<User>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async ({ userId, currentPassword, newPassword }: { userId: string; currentPassword: string; newPassword: string }) => {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change password");
      }
      return res.json();
    },
  });
}

// ===== TIME TRACKING API =====
export function useTimeEntries() {
  return useQuery({
    queryKey: ["time-entries"],
    queryFn: async () => {
      const res = await fetch("/api/time-entries");
      if (!res.ok) throw new Error("Failed to fetch time entries");
      return res.json() as Promise<TimeEntry[]>;
    },
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<InsertTimeEntry, 'userId'>) => {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create time entry");
      }
      return res.json() as Promise<TimeEntry>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete time entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
}

// ===== TIME OFF REQUESTS API =====
export function useTimeOffRequests() {
  return useQuery({
    queryKey: ["time-off-requests"],
    queryFn: async () => {
      const res = await fetch("/api/time-off-requests");
      if (!res.ok) throw new Error("Failed to fetch time off requests");
      return res.json() as Promise<(TimeOffRequest & { userName?: string; approverName?: string })[]>;
    },
  });
}

export function useCreateTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: Omit<InsertTimeOffRequest, 'userId'>) => {
      const res = await fetch("/api/time-off-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create time off request");
      }
      return res.json() as Promise<TimeOffRequest>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
    },
  });
}

export function useUpdateTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TimeOffRequest> }) => {
      const res = await fetch(`/api/time-off-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update time off request");
      }
      return res.json() as Promise<TimeOffRequest>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
    },
  });
}

// ===== AUDIT LOGS API =====
export function useAuditLogs(limit?: number) {
  return useQuery({
    queryKey: ["audit-logs", limit],
    queryFn: async () => {
      const url = limit ? `/api/audit-logs?limit=${limit}` : "/api/audit-logs";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json() as Promise<(AuditLog & { userName?: string })[]>;
    },
  });
}

// ===== INVESTOR CRM API =====
export function useInvestors() {
  return useQuery({
    queryKey: ["investors"],
    queryFn: async () => {
      const res = await fetch("/api/investors");
      if (!res.ok) throw new Error("Failed to fetch investors");
      return res.json() as Promise<Investor[]>;
    },
  });
}

export function useInvestor(id: string) {
  return useQuery({
    queryKey: ["investors", id],
    queryFn: async () => {
      const res = await fetch(`/api/investors/${id}`);
      if (!res.ok) throw new Error("Failed to fetch investor");
      return res.json() as Promise<Investor & { interactions: InvestorInteraction[] }>;
    },
    enabled: !!id,
  });
}

export function useCreateInvestor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (investor: InsertInvestor) => {
      const res = await fetch("/api/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(investor),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create investor");
      }
      return res.json() as Promise<Investor>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investors"] });
    },
  });
}

export function useUpdateInvestor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertInvestor> }) => {
      const res = await fetch(`/api/investors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update investor");
      }
      return res.json() as Promise<Investor>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investors"] });
    },
  });
}

export function useDeleteInvestor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/investors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete investor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investors"] });
    },
  });
}

export function useCreateInvestorInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ investorId, interaction }: { investorId: string; interaction: Omit<InsertInvestorInteraction, 'investorId' | 'userId'> }) => {
      const res = await fetch(`/api/investors/${investorId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(interaction),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create interaction");
      }
      return res.json() as Promise<InvestorInteraction>;
    },
    onSuccess: (_, { investorId }) => {
      queryClient.invalidateQueries({ queryKey: ["investors", investorId] });
      queryClient.invalidateQueries({ queryKey: ["investors"] });
    },
  });
}

// ===== OKR API =====
export function useOkrs() {
  return useQuery({
    queryKey: ["okrs"],
    queryFn: async () => {
      const res = await fetch("/api/okrs");
      if (!res.ok) throw new Error("Failed to fetch OKRs");
      return res.json() as Promise<Okr[]>;
    },
  });
}

export function useCreateOkr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (okr: InsertOkr) => {
      const res = await fetch("/api/okrs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(okr),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create OKR");
      }
      return res.json() as Promise<Okr>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okrs"] });
    },
  });
}

export function useUpdateOkr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertOkr> }) => {
      const res = await fetch(`/api/okrs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update OKR");
      }
      return res.json() as Promise<Okr>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okrs"] });
    },
  });
}

export function useDeleteOkr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/okrs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete OKR");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okrs"] });
    },
  });
}

// ===== STAKEHOLDER API =====
export function useStakeholders() {
  return useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const res = await fetch("/api/stakeholders");
      if (!res.ok) throw new Error("Failed to fetch stakeholders");
      return res.json() as Promise<Stakeholder[]>;
    },
  });
}

export function useCreateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stakeholder: InsertStakeholder) => {
      const res = await fetch("/api/stakeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stakeholder),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create stakeholder");
      }
      return res.json() as Promise<Stakeholder>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}

export function useUpdateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertStakeholder> }) => {
      const res = await fetch(`/api/stakeholders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update stakeholder");
      }
      return res.json() as Promise<Stakeholder>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}

export function useDeleteStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stakeholders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete stakeholder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
  });
}

// ===== ANNOUNCEMENT API =====
export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch("/api/announcements");
      if (!res.ok) throw new Error("Failed to fetch announcements");
      return res.json() as Promise<Announcement[]>;
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (announcement: Omit<InsertAnnouncement, 'authorId' | 'authorName'>) => {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announcement),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create announcement");
      }
      return res.json() as Promise<Announcement>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertAnnouncement> }) => {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update announcement");
      }
      return res.json() as Promise<Announcement>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete announcement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

// ===== POLL API =====
export function usePolls() {
  return useQuery({
    queryKey: ["polls"],
    queryFn: async () => {
      const res = await fetch("/api/polls");
      if (!res.ok) throw new Error("Failed to fetch polls");
      return res.json() as Promise<Poll[]>;
    },
  });
}

export function useCreatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (poll: Omit<InsertPoll, 'creatorId' | 'creatorName'>) => {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poll),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create poll");
      }
      return res.json() as Promise<Poll>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
  });
}

export function useUpdatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertPoll> }) => {
      const res = await fetch(`/api/polls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update poll");
      }
      return res.json() as Promise<Poll>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/polls/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete poll");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
  });
}

// ===== MENTORSHIP PAIRING API =====
export function useMentorshipPairings() {
  return useQuery({
    queryKey: ["mentorship-pairings"],
    queryFn: async () => {
      const res = await fetch("/api/mentorship-pairings");
      if (!res.ok) throw new Error("Failed to fetch mentorship pairings");
      return res.json() as Promise<MentorshipPairing[]>;
    },
  });
}

export function useCreateMentorshipPairing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pairing: InsertMentorshipPairing) => {
      const res = await fetch("/api/mentorship-pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pairing),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create mentorship pairing");
      }
      return res.json() as Promise<MentorshipPairing>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorship-pairings"] });
    },
  });
}

export function useUpdateMentorshipPairing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertMentorshipPairing> }) => {
      const res = await fetch(`/api/mentorship-pairings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update mentorship pairing");
      }
      return res.json() as Promise<MentorshipPairing>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorship-pairings"] });
    },
  });
}

export function useDeleteMentorshipPairing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/mentorship-pairings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete mentorship pairing");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorship-pairings"] });
    },
  });
}

// ===== CLIENT PORTAL ACCESS API =====
export function useClientPortalAccess() {
  return useQuery({
    queryKey: ["client-portal-access"],
    queryFn: async () => {
      const res = await fetch("/api/client-portal-access");
      if (!res.ok) throw new Error("Failed to fetch client portal access");
      return res.json() as Promise<ClientPortalAccess[]>;
    },
  });
}

export function useCreateClientPortalAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (access: Omit<InsertClientPortalAccess, 'invitedBy'>) => {
      const res = await fetch("/api/client-portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(access),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create client portal access");
      }
      return res.json() as Promise<ClientPortalAccess>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-portal-access"] });
    },
  });
}

export function useUpdateClientPortalAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertClientPortalAccess> }) => {
      const res = await fetch(`/api/client-portal-access/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update client portal access");
      }
      return res.json() as Promise<ClientPortalAccess>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-portal-access"] });
    },
  });
}

export function useDeleteClientPortalAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/client-portal-access/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete client portal access");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-portal-access"] });
    },
  });
}

// ===== DOCUMENT TEMPLATE API =====
export function useDocumentTemplates() {
  return useQuery({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const res = await fetch("/api/document-templates");
      if (!res.ok) throw new Error("Failed to fetch document templates");
      return res.json() as Promise<DocumentTemplate[]>;
    },
  });
}

export function useCreateDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: Omit<InsertDocumentTemplate, 'createdBy'>) => {
      const res = await fetch("/api/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create document template");
      }
      return res.json() as Promise<DocumentTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
    },
  });
}

export function useUpdateDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertDocumentTemplate> }) => {
      const res = await fetch(`/api/document-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update document template");
      }
      return res.json() as Promise<DocumentTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
    },
  });
}

export function useDeleteDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete document template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
    },
  });
}

// ===== INVESTOR MATCH HOOKS =====

export type InvestorMatch = {
  id: string;
  dealId: string;
  investorId: number;
  status: string;
  matchedBy: string | null;
  matchedAt: string;
};

export function useInvestorMatches(dealId: string | null) {
  return useQuery({
    queryKey: ["investor-matches", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const res = await fetch(`/api/investor-matches/${dealId}`);
      if (!res.ok) throw new Error("Failed to fetch investor matches");
      return res.json() as Promise<InvestorMatch[]>;
    },
    enabled: !!dealId,
  });
}

export function useCreateInvestorMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (match: { dealId: string; investorId: number; status: string }) => {
      const res = await fetch("/api/investor-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(match),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create investor match");
      }
      return res.json() as Promise<InvestorMatch>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["investor-matches", variables.dealId] });
    },
  });
}

export function useDeleteInvestorMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, investorId }: { dealId: string; investorId: number }) => {
      const res = await fetch(`/api/investor-matches/${dealId}/${investorId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete investor match");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["investor-matches", variables.dealId] });
    },
  });
}

// ===== USER PREFERENCES HOOKS =====

export type UserPreferencesType = {
  id?: string;
  userId: string;
  dashboardWidgets: any[];
  sidebarCollapsed: boolean;
  theme: string;
  complianceDefaults: { sec: boolean; finra: boolean; legal: boolean };
  marketSymbols: string[];
  settings?: Record<string, any>; // General settings (notifications, display, account preferences)
  updatedAt?: string;
};

export function useUserPreferences() {
  return useQuery({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user-preferences");
      if (!res.ok) throw new Error("Failed to fetch user preferences");
      return res.json() as Promise<UserPreferencesType>;
    },
  });
}

export function useSaveUserPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Partial<UserPreferencesType>) => {
      const res = await fetch("/api/user-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save user preferences");
      }
      return res.json() as Promise<UserPreferencesType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
    },
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<UserPreferencesType>) => {
      const res = await fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user preferences");
      }
      return res.json() as Promise<UserPreferencesType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
    },
  });
}

// ===== DEAL TEMPLATE HOOKS =====

export type DealTemplateType = {
  id: string;
  name: string;
  description: string | null;
  sector: string;
  dealType: string;
  stages: string[];
  defaultTasks: { title: string; type: string; priority: string }[];
  estimatedDuration: number | null;
  checklistItems: string[];
  isFavorite: boolean | null;
  usageCount: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function useDealTemplates() {
  return useQuery({
    queryKey: ["deal-templates"],
    queryFn: async () => {
      const res = await fetch("/api/deal-templates");
      if (!res.ok) throw new Error("Failed to fetch deal templates");
      return res.json() as Promise<DealTemplateType[]>;
    },
  });
}

export function useCreateDealTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: Omit<DealTemplateType, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      const res = await fetch("/api/deal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create deal template");
      }
      return res.json() as Promise<DealTemplateType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-templates"] });
    },
  });
}

export function useUpdateDealTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DealTemplateType> }) => {
      const res = await fetch(`/api/deal-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update deal template");
      }
      return res.json() as Promise<DealTemplateType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-templates"] });
    },
  });
}

export function useDeleteDealTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deal-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deal template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-templates"] });
    },
  });
}

// ===== CALENDAR EVENT HOOKS =====

export type CalendarEventType = {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string | null;
  description: string | null;
  dealId: string | null;
  dealName: string | null;
  location: string | null;
  participants: string[];
  isAllDay: boolean | null;
  color: string | null;
  investor: string | null;
  status: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const res = await fetch("/api/calendar-events");
      if (!res.ok) throw new Error("Failed to fetch calendar events");
      return res.json() as Promise<CalendarEventType[]>;
    },
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: Omit<CalendarEventType, 'id' | 'createdBy' | 'createdAt'>) => {
      const res = await fetch("/api/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create calendar event");
      }
      return res.json() as Promise<CalendarEventType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CalendarEventType> }) => {
      const res = await fetch(`/api/calendar-events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update calendar event");
      }
      return res.json() as Promise<CalendarEventType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/calendar-events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete calendar event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

// ===== TASK ATTACHMENT HOOKS =====

export type TaskAttachmentType = {
  id: string;
  taskId: string;
  filename: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  uploadedBy: string | null;
  uploadedAt: string;
};

export function useTaskAttachments(taskId: string) {
  return useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/task-attachments/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task attachments");
      return res.json() as Promise<TaskAttachmentType[]>;
    },
    enabled: !!taskId,
  });
}

export function useCreateTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: Omit<TaskAttachmentType, 'id' | 'uploadedBy' | 'uploadedAt'>) => {
      const res = await fetch("/api/task-attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attachment),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create task attachment");
      }
      return res.json() as Promise<TaskAttachmentType>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", data.taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/task-attachments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task attachment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
