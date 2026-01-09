import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User, Deal, Task, InsertUser, Meeting, Notification, TimeEntry, InsertTimeEntry, TimeOffRequest, InsertTimeOffRequest, AuditLog, Investor, InsertInvestor, InvestorInteraction, InsertInvestorInteraction, Okr, InsertOkr, Stakeholder, InsertStakeholder, Announcement, InsertAnnouncement, Poll, InsertPoll, MentorshipPairing, InsertMentorshipPairing, ClientPortalAccess, InsertClientPortalAccess, DocumentTemplate, InsertDocumentTemplate } from "@shared/schema";

export type { User, Deal, Task, Meeting, Notification };

// Session expiration event system
let sessionExpiredCallbacks: Array<() => void> = [];

export function onSessionExpired(callback: () => void) {
  sessionExpiredCallbacks.push(callback);
  return () => {
    sessionExpiredCallbacks = sessionExpiredCallbacks.filter(cb => cb !== callback);
  };
}

export function triggerSessionExpired() {
  sessionExpiredCallbacks.forEach(cb => cb());
}

// Check for session expiration (401) and handle it globally
function handleSessionExpiration(res: Response): boolean {
  if (res.status === 401) {
    triggerSessionExpired();
    return true;
  }
  return false;
}

// Generic API request helper with session handling
export async function apiRequest(method: string, url: string, body?: any): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (handleSessionExpiration(res)) {
      throw new Error("Your session has expired. Please log in again.");
    }
    throw new Error(`API request failed: ${res.status}`);
  }
  return res;
}

// Helper to make API calls with retry logic for transient failures
export async function apiRequestWithRetry(
  method: string, 
  url: string, 
  body?: any, 
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      
      if (res.ok) {
        return res;
      }
      
      if (handleSessionExpiration(res)) {
        throw new Error("Your session has expired. Please log in again.");
      }
      
      // Don't retry 4xx errors (except 408 timeout and 429 rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        throw new Error(`API request failed: ${res.status}`);
      }
      
      lastError = new Error(`API request failed: ${res.status}`);
    } catch (error: any) {
      lastError = error;
      // Check if it's a network error (worth retrying)
      if (error.name !== 'TypeError' && !error.message.includes('network')) {
        throw error;
      }
    }
    
    // Wait before retrying with exponential backoff
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw lastError || new Error("API request failed after retries");
}

// Auth API
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string; rememberMe?: boolean }) => {
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
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
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
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
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

export type OnboardingStatus = Record<string, { hasResume: boolean; hasPersonality: boolean; isComplete: boolean }>;

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const res = await fetch("/api/users/onboarding-status", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch onboarding status");
      return res.json() as Promise<OnboardingStatus>;
    },
  });
}

// Deal API - fetches all deals (paginated by default in production)
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

// Lightweight deal type for listing endpoints (excludes large JSON fields for performance)
// Uses attachmentCount instead of full attachments to prevent 64MB response limit
export type DealListing = Pick<Deal, 'id' | 'name' | 'dealType' | 'stage' | 'value' | 'client' | 'clientContactName' | 'clientContactEmail' | 'sector' | 'lead' | 'progress' | 'status' | 'description' | 'createdAt' | 'archivedAt'> & { attachmentCount: number };

// Lightweight deals listing (excludes large JSON fields for performance)
// Use this for dropdowns, selectors, or simple lists that don't need full data
export function useDealsListing() {
  return useQuery({
    queryKey: ["deals-listing"],
    queryFn: async () => {
      const res = await fetch("/api/deals/listing");
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json() as Promise<DealListing[]>;
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
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useApproveOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ opportunityId, skipPodFormation = false }: { opportunityId: string; skipPodFormation?: boolean }) => {
      const res = await fetch(`/api/opportunities/${opportunityId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipPodFormation }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to approve opportunity" }));
        throw new Error(errorData.error || "Failed to approve opportunity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useTransitionStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, newStage, skipPodFormation = false }: { dealId: string; newStage: string; skipPodFormation?: boolean }) => {
      const res = await fetch(`/api/deals/${dealId}/transition-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStage, skipPodFormation }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to transition stage" }));
        throw new Error(errorData.error || "Failed to transition stage");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
      queryClient.invalidateQueries({ queryKey: ["deals", vars.dealId] });
      queryClient.invalidateQueries({ queryKey: ["stage-pod-members", vars.dealId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ["deals", id] });
      const previousDeal = queryClient.getQueryData<Deal>(["deals", id]);
      if (previousDeal) {
        queryClient.setQueryData<Deal>(["deals", id], { ...previousDeal, ...updates });
      }
      return { previousDeal, id };
    },
    onError: (err, vars, context) => {
      if (context?.previousDeal) {
        queryClient.setQueryData(["deals", context.id], context.previousDeal);
      }
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deals", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
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
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
      queryClient.invalidateQueries({ queryKey: ["archived-deals"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMoveDealToOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      const res = await fetch(`/api/deals/${dealId}/move-to-opportunity`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to move deal" }));
        throw new Error(errorData.error || "Failed to move deal to opportunities");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
    },
  });
}

export function useBulkDeleteDeals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealIds: string[]) => {
      const res = await fetch("/api/deals/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealIds }),
      });
      if (!res.ok) throw new Error("Failed to bulk delete deals");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useBulkMoveToOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealIds: string[]) => {
      const res = await fetch("/api/deals/bulk-move-to-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealIds }),
      });
      if (!res.ok) throw new Error("Failed to bulk move deals");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
    },
  });
}

export function useArchiveDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes?: string }) => {
      const res = await fetch(`/api/deals/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, notes }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to archive deal" }));
        throw new Error(errorData.error || "Failed to archive deal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
      queryClient.invalidateQueries({ queryKey: ["archived-deals"] });
    },
  });
}

export function useRestoreDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deals/${id}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to restore deal" }));
        throw new Error(errorData.error || "Failed to restore deal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
      queryClient.invalidateQueries({ queryKey: ["archived-deals"] });
    },
  });
}

export function useArchivedDeals() {
  return useQuery<Deal[]>({
    queryKey: ["archived-deals"],
    queryFn: async () => {
      const res = await fetch("/api/deals/archived");
      if (!res.ok) throw new Error("Failed to fetch archived deals");
      return res.json();
    },
  });
}

// Custom Sectors API
export type CustomSector = {
  id: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
};

export function useCustomSectors() {
  return useQuery({
    queryKey: ["custom-sectors"],
    queryFn: async () => {
      const res = await fetch("/api/custom-sectors");
      if (!res.ok) throw new Error("Failed to fetch custom sectors");
      return res.json() as Promise<CustomSector[]>;
    },
  });
}

export function useCreateCustomSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/custom-sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to create custom sector" }));
        throw new Error(error.error || "Failed to create custom sector");
      }
      return res.json() as Promise<CustomSector>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-sectors"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
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

// Tag member on deal/opportunity (with notification)
export function useTagDealMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, memberId, memberName, memberRole }: { dealId: string; memberId: string; memberName: string; memberRole?: string }) => {
      const res = await fetch(`/api/deals/${dealId}/tag-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, memberName, memberRole }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to tag member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
    },
  });
}

// Remove member from deal/opportunity
export function useRemoveDealMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, memberId }: { dealId: string; memberId: string }) => {
      const res = await fetch(`/api/deals/${dealId}/remove-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deals-listing"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ===== GOOGLE CALENDAR API =====
export type GoogleCalendarEvent = {
  id: string;
  googleEventId: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  meetLink?: string;
  attendees: { email: string; name?: string; responseStatus?: string }[];
  organizer?: string;
  status?: string;
  htmlLink?: string;
  source: 'google';
};

export type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
};

export function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: async () => {
      const res = await fetch("/api/google-calendar/status");
      if (!res.ok) return { configured: false, connected: false };
      return res.json() as Promise<GoogleCalendarStatus>;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useConnectGoogleCalendar() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/google-calendar/connect");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to get authorization URL");
      }
      const data = await res.json();
      return data.authUrl as string;
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/google-calendar/disconnect", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to disconnect Google Calendar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      queryClient.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });
}

export function useSyncGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/google-calendar/sync", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sync with Google Calendar");
      }
      return res.json() as Promise<{ message: string; imported: number; skipped: number; totalGoogleEvents: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useGoogleCalendarEvents(timeMin?: Date, timeMax?: Date) {
  return useQuery({
    queryKey: ["google-calendar-events", timeMin?.toISOString(), timeMax?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (timeMin) params.append('timeMin', timeMin.toISOString());
      if (timeMax) params.append('timeMax', timeMax.toISOString());
      
      const res = await fetch(`/api/google-calendar/events?${params}`);
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch Google Calendar events");
      }
      return res.json() as Promise<GoogleCalendarEvent[]>;
    },
    staleTime: 1000 * 60,
  });
}

export function useCreateGoogleCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: {
      title: string;
      description?: string;
      location?: string;
      start: string;
      end: string;
      attendees?: string[];
      addMeetLink?: boolean;
    }) => {
      const res = await fetch("/api/google-calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create Google Calendar event");
      }
      return res.json() as Promise<GoogleCalendarEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-events"] });
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
      queryClient.invalidateQueries({ queryKey: ["investor-matches"] });
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
      queryClient.invalidateQueries({ queryKey: ["investor-matches"] });
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
      queryClient.invalidateQueries({ queryKey: ["investor-matches"] });
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
export interface StakeholdersResponse {
  stakeholders: Stakeholder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useStakeholders(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
}) {
  const { page = 1, pageSize = 50, search, type } = options || {};
  
  return useQuery({
    queryKey: ["stakeholders", { page, pageSize, search, type }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (type && type !== 'all') params.set('type', type);
      
      const res = await fetch(`/api/stakeholders?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch stakeholders");
      return res.json() as Promise<StakeholdersResponse>;
    },
    placeholderData: (previousData) => previousData,
  });
}

// Hook to fetch all investors (for investor matching pages)
export function useAllInvestors() {
  return useQuery({
    queryKey: ["stakeholders", "allInvestors"],
    queryFn: async () => {
      // Fetch investors with a large page size to get all of them
      const res = await fetch(`/api/stakeholders?type=investor&pageSize=10000`);
      if (!res.ok) throw new Error("Failed to fetch investors");
      const data = await res.json() as StakeholdersResponse;
      return data.stakeholders;
    },
  });
}

// Hook to fetch stakeholder stats (totals by type for summary display)
export interface StakeholderStatsResponse {
  total: number;
  typeCounts: Record<string, number>;
  favoriteCount: number;
}

export function useStakeholderStats() {
  return useQuery({
    queryKey: ["stakeholders", "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/stakeholders/stats`);
      if (!res.ok) throw new Error("Failed to fetch stakeholder stats");
      return res.json() as Promise<StakeholderStatsResponse>;
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
      // Invalidate all stakeholder queries (including paginated)
      queryClient.invalidateQueries({ queryKey: ["stakeholders"], refetchType: 'all' });
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
      queryClient.invalidateQueries({ queryKey: ["stakeholders"], refetchType: 'all' });
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
      queryClient.invalidateQueries({ queryKey: ["stakeholders"], refetchType: 'all' });
    },
  });
}

// ===== INVESTORS TABLE API =====
export type InvestorTable = {
  id: string;
  name: string;
  firm: string;
  type: string;
  focus: string | null;
  aum: string | null;
  checkSize: string | null;
  preferredStage: string | null;
  location: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  linkedIn: string | null;
  notes: string | null;
  tags: string[] | null;
  isActive: boolean | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export function useInvestorsTable() {
  return useQuery({
    queryKey: ["investors-table"],
    queryFn: async () => {
      const res = await fetch("/api/investors-table");
      if (!res.ok) throw new Error("Failed to fetch investors");
      return res.json() as Promise<InvestorTable[]>;
    },
  });
}

export function useCreateInvestorTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (investor: Partial<InvestorTable>) => {
      const res = await fetch("/api/investors-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(investor),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create investor");
      }
      return res.json() as Promise<InvestorTable>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investors-table"] });
    },
  });
}

export function useUpdateInvestorTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InvestorTable> }) => {
      const res = await fetch(`/api/investors-table/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update investor");
      }
      return res.json() as Promise<InvestorTable>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investors-table"] });
    },
  });
}

export function useDeleteInvestorTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/investors-table/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete investor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investors-table"] });
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

// ===== DOCUMENT STORAGE API =====
export type DocumentRecord = {
  id: string;
  title: string;
  type: string;
  category: string;
  filename: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  content?: string;
  dealId?: string;
  dealName?: string;
  uploadedBy?: string;
  uploaderName?: string;
  tags?: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json() as Promise<DocumentRecord[]>;
    },
    staleTime: 0, // Always refetch on invalidation for immediate updates
  });
}

export function useDocumentsByDeal(dealId: string | null) {
  return useQuery({
    queryKey: ["documents", "deal", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const res = await fetch(`/api/documents/deal/${dealId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deal documents");
      return res.json() as Promise<DocumentRecord[]>;
    },
    enabled: !!dealId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doc: {
      title: string;
      type: string;
      category?: string;
      filename: string;
      originalName?: string;
      mimeType?: string;
      size?: number;
      content?: string;
      dealId?: string;
      dealName?: string;
      tags?: string[];
    }) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(doc),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create document");
      }
      return res.json() as Promise<DocumentRecord>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"], refetchType: 'all' });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DocumentRecord> }) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update document");
      }
      return res.json() as Promise<DocumentRecord>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"], refetchType: 'all' });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"], refetchType: 'all' });
    },
  });
}

// ===== INVESTOR MATCH HOOKS =====

export type InvestorMatch = {
  id: string;
  dealId: string;
  investorId: string;
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
    mutationFn: async (match: { dealId: string; investorId: string; status: string }) => {
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
    mutationFn: async ({ dealId, investorId }: { dealId: string; investorId: string }) => {
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
  hasSeenWelcome?: boolean;
  updatedAt?: string;
};

export function useUserPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user-preferences");
      if (res.status === 401) {
        return null;
      }
      if (!res.ok) throw new Error(`Failed to fetch user preferences: ${res.status}`);
      return res.json() as Promise<UserPreferencesType>;
    },
    enabled: options?.enabled !== false,
    retry: 1,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
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
    onMutate: async (newPrefs) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["user-preferences"] });
      // Snapshot current value
      const previousPrefs = queryClient.getQueryData<UserPreferencesType>(["user-preferences"]);
      // Optimistically update cache
      if (previousPrefs) {
        queryClient.setQueryData<UserPreferencesType>(["user-preferences"], {
          ...previousPrefs,
          ...newPrefs,
          settings: { ...(previousPrefs.settings || {}), ...(newPrefs.settings || {}) },
        });
      }
      return { previousPrefs };
    },
    onError: (_err, _newPrefs, context) => {
      // Rollback on error
      if (context?.previousPrefs) {
        queryClient.setQueryData(["user-preferences"], context.previousPrefs);
      }
    },
    onSettled: () => {
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
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: ["user-preferences"] });
      const previousPrefs = queryClient.getQueryData<UserPreferencesType>(["user-preferences"]);
      if (previousPrefs) {
        queryClient.setQueryData<UserPreferencesType>(["user-preferences"], {
          ...previousPrefs,
          ...newPrefs,
          settings: { ...(previousPrefs.settings || {}), ...(newPrefs.settings || {}) },
        });
      }
      return { previousPrefs };
    },
    onError: (_err, _newPrefs, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData(["user-preferences"], context.previousPrefs);
      }
    },
    onSettled: () => {
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

// 2FA API
export function use2FAStatus() {
  return useQuery({
    queryKey: ["2fa-status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/2fa/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch 2FA status");
      return res.json() as Promise<{ enabled: boolean; hasSecret: boolean }>;
    },
  });
}

export function useSetup2FA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to setup 2FA");
      }
      return res.json() as Promise<{ secret: string; qrCode: string; otpauthUrl: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
    },
  });
}

export function useVerify2FA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Invalid verification code");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useDisable2FA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to disable 2FA");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

// ===== CLIENT PORTAL API =====

export type PortalInvite = {
  id: string;
  email: string;
  name: string;
  organization?: string;
  token: string;
  dealIds: string[];
  accessLevel: string;
  invitedBy: string;
  inviterName: string;
  message?: string;
  status: string;
  expiresAt: string;
  acceptedAt?: string;
  userId?: string;
  createdAt: string;
};

export type PortalUpdate = {
  id: string;
  dealId: string;
  title: string;
  content: string;
  type: string;
  authorId: string;
  authorName: string;
  isPublic: boolean;
  createdAt: string;
};

export type PortalMessage = {
  id: string;
  dealId: string;
  senderId: string;
  senderName: string;
  isExternal: boolean;
  content: string;
  createdAt: string;
};

// Get all portal invites (CEO only)
export function usePortalInvites() {
  return useQuery({
    queryKey: ["portal-invites"],
    queryFn: async () => {
      const res = await fetch("/api/portal/invites", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch portal invites");
      return res.json() as Promise<PortalInvite[]>;
    },
  });
}

// Create portal invite
export function useCreatePortalInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      name: string;
      organization?: string;
      dealIds: string[];
      accessLevel?: string;
      message?: string;
    }) => {
      const res = await fetch("/api/portal/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create invite");
      }
      return res.json() as Promise<PortalInvite>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-invites"] });
    },
  });
}

// Revoke portal invite
export function useRevokePortalInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/portal/invites/${id}/revoke`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to revoke invite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-invites"] });
    },
  });
}

// Get invite details by token (public)
export function usePortalInviteByToken(token: string | null) {
  return useQuery({
    queryKey: ["portal-invite-token", token],
    queryFn: async () => {
      if (!token) return null;
      const res = await fetch(`/api/portal/register/${token}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch invite");
      }
      return res.json() as Promise<{
        email: string;
        name: string;
        organization?: string;
        inviterName: string;
        accessLevel: string;
        dealNames: string[];
        expiresAt: string;
      }>;
    },
    enabled: !!token,
  });
}

// Complete portal registration
export function usePortalRegister() {
  return useMutation({
    mutationFn: async ({ token, password, phone }: { token: string; password: string; phone?: string }) => {
      const res = await fetch(`/api/portal/register/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, phone }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Registration failed");
      }
      return res.json();
    },
  });
}

// Portal login (external users)
export function usePortalLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
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

// Get external user's deals
export function usePortalDeals() {
  return useQuery({
    queryKey: ["portal-my-deals"],
    queryFn: async () => {
      const res = await fetch("/api/portal/my-deals", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json() as Promise<Deal[]>;
    },
  });
}

// Get portal updates for a deal
export function usePortalUpdates(dealId: string | null) {
  return useQuery({
    queryKey: ["portal-updates", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const res = await fetch(`/api/portal/deals/${dealId}/updates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch updates");
      return res.json() as Promise<PortalUpdate[]>;
    },
    enabled: !!dealId,
  });
}

// Create portal update (internal users)
export function useCreatePortalUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      dealId: string;
      title: string;
      content: string;
      type?: string;
      isPublic?: boolean;
    }) => {
      const res = await fetch(`/api/portal/deals/${data.dealId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create update");
      }
      return res.json() as Promise<PortalUpdate>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["portal-updates", vars.dealId] });
    },
  });
}

// Get portal messages for a deal
export function usePortalMessages(dealId: string | null) {
  return useQuery({
    queryKey: ["portal-messages", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const res = await fetch(`/api/portal/deals/${dealId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<PortalMessage[]>;
    },
    enabled: !!dealId,
  });
}

// Send portal message
export function useSendPortalMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealId: string; content: string }) => {
      const res = await fetch(`/api/portal/deals/${data.dealId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: data.content }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send message");
      }
      return res.json() as Promise<PortalMessage>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["portal-messages", vars.dealId] });
    },
  });
}

// Get all external users (CEO only)
export function useExternalUsers() {
  return useQuery({
    queryKey: ["external-users"],
    queryFn: async () => {
      const res = await fetch("/api/portal/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch external users");
      return res.json();
    },
  });
}

// ===== DEAL FEES HOOKS =====

export type DealFeeType = {
  id: string;
  dealId: string;
  feeType: string;
  amount: number | null;
  percentage: number | null;
  currency: string | null;
  description: string | null;
  billingFrequency: string | null;
  createdAt: string;
};

export function useDealFees(dealId: string) {
  return useQuery({
    queryKey: ["deal-fees", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/fees`);
      if (!res.ok) throw new Error("Failed to fetch deal fees");
      return res.json() as Promise<DealFeeType[]>;
    },
    enabled: !!dealId,
  });
}

export function useAllDealFees() {
  return useQuery({
    queryKey: ["all-deal-fees"],
    queryFn: async () => {
      const res = await fetch("/api/deal-fees");
      if (!res.ok) throw new Error("Failed to fetch all deal fees");
      return res.json() as Promise<DealFeeType[]>;
    },
  });
}

export function useCreateDealFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, fee }: { dealId: string; fee: Omit<DealFeeType, 'id' | 'dealId' | 'createdAt'> }) => {
      const res = await fetch(`/api/deals/${dealId}/fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fee),
      });
      if (!res.ok) throw new Error("Failed to create deal fee");
      return res.json() as Promise<DealFeeType>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deal-fees", vars.dealId] });
      queryClient.invalidateQueries({ queryKey: ["all-deal-fees"] });
    },
  });
}

export function useUpdateDealFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DealFeeType> }) => {
      const res = await fetch(`/api/deal-fees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update deal fee");
      return res.json() as Promise<DealFeeType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-fees"] });
      queryClient.invalidateQueries({ queryKey: ["all-deal-fees"] });
    },
  });
}

export function useDeleteDealFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deal-fees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deal fee");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-fees"] });
      queryClient.invalidateQueries({ queryKey: ["all-deal-fees"] });
    },
  });
}

// ===== STAGE DOCUMENTS HOOKS =====

export type StageDocumentType = {
  id: string;
  dealId: string;
  stage: string;
  documentId: string | null;
  title: string;
  filename: string | null;
  url: string | null;
  mimeType: string | null;
  size: number | null;
  uploadedBy: string | null;
  uploaderName: string | null;
  createdAt: string;
};

export function useStageDocuments(dealId: string, stage?: string) {
  return useQuery({
    queryKey: ["stage-documents", dealId, stage],
    queryFn: async () => {
      const url = stage 
        ? `/api/deals/${dealId}/stage-documents?stage=${encodeURIComponent(stage)}`
        : `/api/deals/${dealId}/stage-documents`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch stage documents");
      return res.json() as Promise<StageDocumentType[]>;
    },
    enabled: !!dealId,
  });
}

export function useCreateStageDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, doc }: { dealId: string; doc: Omit<StageDocumentType, 'id' | 'dealId' | 'uploadedBy' | 'uploaderName' | 'createdAt'> }) => {
      const res = await fetch(`/api/deals/${dealId}/stage-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      if (!res.ok) throw new Error("Failed to create stage document");
      return res.json() as Promise<StageDocumentType>;
    },
    onMutate: async ({ dealId, doc }) => {
      await queryClient.cancelQueries({ queryKey: ["stage-documents", dealId, doc.stage] });
      const previousDocs = queryClient.getQueryData<StageDocumentType[]>(["stage-documents", dealId, doc.stage]);
      const optimisticDoc: StageDocumentType = {
        id: `temp-${Date.now()}`,
        dealId,
        documentId: null,
        uploadedBy: null,
        uploaderName: null,
        createdAt: new Date().toISOString(),
        ...doc,
      };
      queryClient.setQueryData<StageDocumentType[]>(
        ["stage-documents", dealId, doc.stage],
        (old) => [...(old || []), optimisticDoc]
      );
      return { previousDocs };
    },
    onError: (err, vars, context) => {
      if (context?.previousDocs) {
        queryClient.setQueryData(["stage-documents", vars.dealId, vars.doc.stage], context.previousDocs);
      }
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: ["stage-documents", vars.dealId, vars.doc.stage] });
      // Also invalidate the "all documents" query (without stage) for AI analysis feature
      queryClient.invalidateQueries({ queryKey: ["stage-documents", vars.dealId, undefined] });
    },
  });
}

export function useDeleteStageDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dealId, stage }: { id: string; dealId?: string; stage?: string }) => {
      const res = await fetch(`/api/stage-documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete stage document");
      return res.json();
    },
    onMutate: async ({ id, dealId, stage }) => {
      if (dealId && stage) {
        await queryClient.cancelQueries({ queryKey: ["stage-documents", dealId, stage] });
        const previousDocs = queryClient.getQueryData<StageDocumentType[]>(["stage-documents", dealId, stage]);
        queryClient.setQueryData<StageDocumentType[]>(
          ["stage-documents", dealId, stage],
          (old) => (old || []).filter(doc => doc.id !== id)
        );
        return { previousDocs, dealId, stage };
      }
      return {};
    },
    onError: (err, vars, context) => {
      if (context?.previousDocs && context?.dealId && context?.stage) {
        queryClient.setQueryData(["stage-documents", context.dealId, context.stage], context.previousDocs);
      }
    },
    onSettled: (_, __, vars) => {
      if (vars.dealId && vars.stage) {
        queryClient.invalidateQueries({ queryKey: ["stage-documents", vars.dealId, vars.stage] });
        // Also invalidate the "all documents" query (without stage) for AI analysis feature
        queryClient.invalidateQueries({ queryKey: ["stage-documents", vars.dealId, undefined] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["stage-documents"] });
      }
    },
  });
}

// ===== STAGE POD MEMBERS HOOKS =====

export type StagePodMemberType = {
  id: string;
  dealId: string;
  stage: string;
  userId: string;
  userName: string;
  role: string;
  email: string | null;
  phone: string | null;
  isLead: boolean | null;
  createdAt: string;
};

export function useStagePodMembers(dealId: string, stage?: string) {
  return useQuery({
    queryKey: ["stage-pod-members", dealId, stage],
    queryFn: async () => {
      const url = stage 
        ? `/api/deals/${dealId}/stage-pod-members?stage=${encodeURIComponent(stage)}`
        : `/api/deals/${dealId}/stage-pod-members`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch stage pod members");
      return res.json() as Promise<StagePodMemberType[]>;
    },
    enabled: !!dealId,
  });
}

export function useCreateStagePodMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, member }: { dealId: string; member: Omit<StagePodMemberType, 'id' | 'dealId' | 'createdAt'> }) => {
      const res = await fetch(`/api/deals/${dealId}/stage-pod-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(member),
      });
      if (!res.ok) throw new Error("Failed to add stage pod member");
      return res.json() as Promise<StagePodMemberType>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["stage-pod-members", vars.dealId] });
    },
  });
}

export function useUpdateStagePodMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StagePodMemberType> }) => {
      const res = await fetch(`/api/stage-pod-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update stage pod member");
      return res.json() as Promise<StagePodMemberType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-pod-members"] });
    },
  });
}

export function useDeleteStagePodMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stage-pod-members/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove stage pod member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-pod-members"] });
    },
  });
}

// ===== STAGE VOICE NOTES HOOKS =====

export type StageVoiceNoteType = {
  id: string;
  dealId: string;
  stage: string;
  title: string;
  filename: string;
  url: string | null;
  duration: number | null;
  transcript: string | null;
  recordedBy: string | null;
  recorderName: string | null;
  createdAt: string;
};

export function useStageVoiceNotes(dealId: string, stage?: string) {
  return useQuery({
    queryKey: ["stage-voice-notes", dealId, stage],
    queryFn: async () => {
      const url = stage 
        ? `/api/deals/${dealId}/stage-voice-notes?stage=${encodeURIComponent(stage)}`
        : `/api/deals/${dealId}/stage-voice-notes`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch stage voice notes");
      return res.json() as Promise<StageVoiceNoteType[]>;
    },
    enabled: !!dealId,
  });
}

export function useCreateStageVoiceNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, note }: { dealId: string; note: Omit<StageVoiceNoteType, 'id' | 'dealId' | 'recordedBy' | 'recorderName' | 'createdAt'> }) => {
      const res = await fetch(`/api/deals/${dealId}/stage-voice-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      });
      if (!res.ok) throw new Error("Failed to create stage voice note");
      return res.json() as Promise<StageVoiceNoteType>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["stage-voice-notes", vars.dealId] });
    },
  });
}

export function useDeleteStageVoiceNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stage-voice-notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete stage voice note");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-voice-notes"] });
    },
  });
}

// ===== TASK COMMENTS HOOKS =====

export type TaskCommentType = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (!res.ok) throw new Error("Failed to fetch task comments");
      return res.json() as Promise<TaskCommentType[]>;
    },
    enabled: !!taskId,
  });
}

export function useCreateTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to create task comment");
      return res.json() as Promise<TaskCommentType>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", vars.taskId] });
    },
  });
}

export function useUpdateTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await fetch(`/api/task-comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to update task comment");
      return res.json() as Promise<TaskCommentType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments"] });
    },
  });
}

export function useDeleteTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/task-comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task comment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments"] });
    },
  });
}

// ===== DEAL NOTES HOOKS =====

export type DealNoteType = {
  id: string;
  dealId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export function useDealNotes(dealId: string) {
  return useQuery({
    queryKey: ["deal-notes", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/notes`);
      if (!res.ok) throw new Error("Failed to fetch deal notes");
      return res.json() as Promise<DealNoteType[]>;
    },
    enabled: !!dealId,
  });
}

export function useCreateDealNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, content }: { dealId: string; content: string }) => {
      const res = await fetch(`/api/deals/${dealId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to create deal note");
      return res.json() as Promise<DealNoteType>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deal-notes", vars.dealId] });
    },
  });
}

export function useUpdateDealNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await fetch(`/api/deal-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to update deal note");
      return res.json() as Promise<DealNoteType>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-notes"] });
    },
  });
}

export function useDeleteDealNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deal-notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deal note");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-notes"] });
    },
  });
}

// ===== USER SEARCH HOOK =====

export type UserSearchResult = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar: string | null;
};

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["user-search", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to search users");
      return res.json() as Promise<UserSearchResult[]>;
    },
    enabled: query.length >= 2,
  });
}

// ===== FORMS API =====

// Branching condition - show field when another field has specific value
export interface FormBranchCondition {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
}

// Table column definition
export interface FormTableColumn {
  id: string;
  header: string;
}

// Table cell
export interface FormTableCell {
  value: string;
}

// Content block for rich text
export interface FormContentBlock {
  type: 'paragraph' | 'heading' | 'list' | 'link';
  text?: string;
  items?: string[];
  url?: string;
  linkText?: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'single-select' | 'multi-select' | 'date' | 'number' | 'file' | 'heading' | 'textarea' | 'table' | 'content';
  label: string;
  required: boolean;
  options?: string[];
  description?: string;
  placeholder?: string;
  // Branching support
  showWhen?: FormBranchCondition;
  // Table support
  tableColumns?: FormTableColumn[];
  tableRows?: FormTableCell[][];
  // Rich content support
  contentBlocks?: FormContentBlock[];
}

export interface Form {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  fields: FormField[];
  status: 'draft' | 'published' | 'archived';
  shareToken: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  formTitle: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterId: string | null;
  responses: Array<{ fieldId: string; value: any }>;
  taskId: string | null;
  status: string;
  createdAt: string;
}

export function useForms() {
  return useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const res = await fetch("/api/forms");
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error("Failed to fetch forms");
      }
      return res.json() as Promise<Form[]>;
    },
  });
}

export function useForm(id: string | undefined) {
  return useQuery({
    queryKey: ["forms", id],
    queryFn: async () => {
      const res = await fetch(`/api/forms/${id}`);
      if (!res.ok) throw new Error("Failed to fetch form");
      return res.json() as Promise<Form>;
    },
    enabled: !!id,
  });
}

export function useCreateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description?: string; fields?: FormField[] }) => {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create form");
      }
      return res.json() as Promise<Form>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });
}

export function useUpdateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string; coverImage?: string | null; fields?: FormField[]; status?: string }) => {
      const res = await fetch(`/api/forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update form");
      return res.json() as Promise<Form>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      queryClient.invalidateQueries({ queryKey: ["forms", vars.id] });
    },
  });
}

export function usePublishForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/forms/${id}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to publish form");
      return res.json() as Promise<Form>;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      queryClient.invalidateQueries({ queryKey: ["forms", id] });
    },
  });
}

export function useDeleteForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete form");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });
}

export function useUnpublishForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/forms/${id}/unpublish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to unpublish form");
      return res.json() as Promise<Form>;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      queryClient.invalidateQueries({ queryKey: ["forms", id] });
    },
  });
}

export function useShareForm() {
  return useMutation({
    mutationFn: async ({ id, emails, message }: { id: string; emails: string[]; message?: string }) => {
      const res = await fetch(`/api/forms/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, message }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to share form");
      }
      return res.json() as Promise<{ success: boolean; results: any[]; formLink: string }>;
    },
  });
}

export function useFormSubmissions(formId: string | undefined) {
  return useQuery({
    queryKey: ["form-submissions", formId],
    queryFn: async () => {
      const res = await fetch(`/api/forms/${formId}/submissions`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json() as Promise<FormSubmission[]>;
    },
    enabled: !!formId,
  });
}

export function usePublicForm(shareToken: string | undefined) {
  return useQuery({
    queryKey: ["public-form", shareToken],
    queryFn: async () => {
      const res = await fetch(`/api/public/forms/${shareToken}`);
      if (!res.ok) throw new Error("Failed to fetch form");
      return res.json() as Promise<Partial<Form>>;
    },
    enabled: !!shareToken,
  });
}

export function useSubmitPublicForm() {
  return useMutation({
    mutationFn: async ({ shareToken, responses, submitterName, submitterEmail }: {
      shareToken: string;
      responses: Array<{ fieldId: string; value: any }>;
      submitterName?: string;
      submitterEmail?: string;
    }) => {
      const res = await fetch(`/api/public/forms/${shareToken}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, submitterName, submitterEmail }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit form");
      }
      return res.json();
    },
  });
}

// ===== TASK TEMPLATES =====

export interface TemplateTask {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  relativeDueDays?: number;
  position: number;
}

export interface TemplateSection {
  id: string;
  title: string;
  position: number;
  tasks: TemplateTask[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sections: TemplateSection[];
  isArchived: boolean | null;
  usageCount: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateUsage {
  id: string;
  templateId: string;
  templateName: string;
  appliedBy: string;
  contextType: string | null;
  contextName: string | null;
  tasksCreated: number | null;
  startDate: string;
  createdAt: string;
}

export function useTaskTemplates() {
  return useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const res = await fetch("/api/task-templates");
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error("Failed to fetch task templates");
      }
      return res.json() as Promise<TaskTemplate[]>;
    },
  });
}

export function useTaskTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["task-templates", id],
    queryFn: async () => {
      const res = await fetch(`/api/task-templates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch task template");
      return res.json() as Promise<TaskTemplate>;
    },
    enabled: !!id,
  });
}

export function useCreateTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; category?: string; sections?: TemplateSection[] }) => {
      const res = await fetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create task template");
      }
      return res.json() as Promise<TaskTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
    },
  });
}

export function useUpdateTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; category?: string; sections?: TemplateSection[]; isArchived?: boolean }) => {
      const res = await fetch(`/api/task-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update task template");
      return res.json() as Promise<TaskTemplate>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      queryClient.invalidateQueries({ queryKey: ["task-templates", vars.id] });
    },
  });
}

export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/task-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
    },
  });
}

export function useApplyTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, startDate, contextType, contextName, assigneeOverrides }: {
      id: string;
      startDate?: string;
      contextType?: string;
      contextName?: string;
      assigneeOverrides?: Record<string, string>;
    }) => {
      const res = await fetch(`/api/task-templates/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, contextType, contextName, assigneeOverrides }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to apply task template");
      }
      return res.json() as Promise<{ success: boolean; tasksCreated: number; tasks: any[] }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
    },
  });
}

export function useTaskTemplateUsage(templateId: string | undefined) {
  return useQuery({
    queryKey: ["task-template-usage", templateId],
    queryFn: async () => {
      const res = await fetch(`/api/task-templates/${templateId}/usage`);
      if (!res.ok) throw new Error("Failed to fetch template usage");
      return res.json() as Promise<TaskTemplateUsage[]>;
    },
    enabled: !!templateId,
  });
}

// ===== PERSONALITY ASSESSMENT =====

export type PersonalityQuestion = {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
};

export type PersonalityScore = {
  profile: string;
  score: number;
};

export type DeploymentTags = {
  dealTeamStatus: string;
  primaryVertical: string;
  secondaryVertical: string;
  primaryDealPhase: string;
  secondaryDealPhase: string;
  topFiveArchetypes: string[];
  riskFlag: string | null;
};

export type AIAnalysis = {
  employeeSnapshot: string;
  scoreDistribution: string;
  primaryArchetype: string;
  secondaryTraits: string;
  supportingTraits: string;
  lowSignalTags: string;
  absentTraits: string;
  dealPhaseFit: string;
  dealTypeProficiency: string;
  managerialNotes: string;
  deploymentTags: DeploymentTags;
  rawResponse: string;
};

export type PersonalityAssessment = {
  id: string;
  userId: string;
  answers: Record<number, 'A' | 'B'>;
  allScores: PersonalityScore[];
  topThreeProfiles: PersonalityScore[];
  aiAnalysis: AIAnalysis | null;
  status: string; // 'pending' | 'analyzing' | 'completed' | 'failed'
  completedAt: string | null;
  createdAt: string;
};

export function usePersonalityQuestions() {
  return useQuery({
    queryKey: ["personality-questions"],
    queryFn: async () => {
      const res = await fetch("/api/personality/questions");
      if (!res.ok) throw new Error("Failed to fetch personality questions");
      return res.json() as Promise<PersonalityQuestion[]>;
    },
  });
}

export function usePersonalityAssessment() {
  return useQuery({
    queryKey: ["personality-assessment"],
    queryFn: async () => {
      const res = await fetch("/api/personality/assessment");
      if (!res.ok) throw new Error("Failed to fetch personality assessment");
      return res.json() as Promise<PersonalityAssessment | null>;
    },
    refetchInterval: (query) => {
      // Poll every 2 seconds while analyzing
      if (query.state.data?.status === 'analyzing') return 2000;
      return false;
    },
  });
}

export function useUserPersonalityAssessment(userId: string | undefined) {
  return useQuery({
    queryKey: ["personality-assessment", userId],
    queryFn: async () => {
      const res = await fetch(`/api/personality/assessment/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch personality assessment");
      return res.json() as Promise<PersonalityAssessment | null>;
    },
    enabled: !!userId,
  });
}

export function useSubmitPersonalityAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ answers, dealTeamStatus }: { answers: Record<number, 'A' | 'B'>; dealTeamStatus?: string }) => {
      const res = await fetch("/api/personality/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, dealTeamStatus }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit assessment");
      }
      return res.json() as Promise<PersonalityAssessment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personality-assessment"] });
    },
  });
}

// ===== RESUME ANALYSIS =====

export type OnboardingPlacement = {
  assignedDealTeam: string;
  primaryVertical: string;
  secondaryVertical: string;
  primaryDealPhase: string;
  secondaryDealPhase: string;
  initialSeatRecommendation: string;
  topFiveInferredTags: string[];
  coverageGaps: string;
  pendingCombinedAnalysis?: boolean;
  combinedAnalysisCompletedAt?: string;
  placementRationale?: string;
};

export type ResumeAIAnalysis = {
  candidateSnapshot: string;
  evidenceAnchors: string;
  transactionProfile: string;
  roleElevationAutonomy: string;
  dealPhaseFit: string;
  dealTypeProficiency: string;
  resumeInferredTags: string;
  managerialNotes: string;
  onboardingPlacement: OnboardingPlacement;
  rawResponse: string;
};

export type ResumeAnalysis = {
  id: string;
  userId: string;
  fileName: string;
  fileContent: string | null;
  aiAnalysis: ResumeAIAnalysis | null;
  assignedDealTeam: string | null;
  status: string; // 'pending' | 'analyzing' | 'completed' | 'failed'
  completedAt: string | null;
  createdAt: string;
};

export function useResumeAnalysis() {
  return useQuery({
    queryKey: ["resume-analysis"],
    queryFn: async () => {
      const res = await fetch("/api/resume/analysis");
      if (!res.ok) throw new Error("Failed to fetch resume analysis");
      return res.json() as Promise<ResumeAnalysis | null>;
    },
    refetchInterval: (query) => {
      if (query.state.data?.status === 'analyzing') return 2000;
      return false;
    },
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('resume', file);
      
      const res = await fetch("/api/resume/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload resume");
      }
      return res.json() as Promise<ResumeAnalysis>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resume-analysis"] });
    },
  });
}

// ===== AI DOCUMENT ANALYSIS =====

export type AiDocumentAnalysis = {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  summary: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type DocumentRef = { source: 'stage' | 'attachment'; id: string };

export function useStartAiDocumentAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, documents }: { dealId: string; documents: DocumentRef[] }) => {
      const res = await fetch(`/api/deals/${dealId}/ai-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to start document analysis");
      }
      return res.json() as Promise<{ success: boolean; analysisId: string; status: string }>;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ai-document-analysis", vars.dealId] });
    },
  });
}

export function useAiDocumentAnalysis(dealId: string, analysisId: string | null) {
  return useQuery({
    queryKey: ["ai-document-analysis", dealId, analysisId],
    queryFn: async () => {
      if (!analysisId) return null;
      const res = await fetch(`/api/deals/${dealId}/ai-summary/${analysisId}`);
      if (!res.ok) throw new Error("Failed to fetch analysis status");
      return res.json() as Promise<AiDocumentAnalysis>;
    },
    enabled: !!analysisId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'processing') return 2000;
      return false;
    },
  });
}

export function useLatestAiDocumentAnalysis(dealId: string | undefined) {
  return useQuery({
    queryKey: ["ai-document-analysis-latest", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const res = await fetch(`/api/deals/${dealId}/ai-summary/latest`);
      if (!res.ok) throw new Error("Failed to fetch latest analysis");
      const data = await res.json();
      return data.analysis as AiDocumentAnalysis | null;
    },
    enabled: !!dealId,
  });
}

export function useSaveAiSummaryAsNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, analysisId }: { dealId: string; analysisId: string }) => {
      const res = await fetch(`/api/deals/${dealId}/ai-summary/${analysisId}/save-as-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save summary as note");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["deal-notes", vars.dealId] });
      queryClient.invalidateQueries({ queryKey: ["ai-document-analysis-latest", vars.dealId] });
    },
  });
}
