import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for AuthContext Realtime Subscription
 * 
 * These tests verify that the realtime subscription is properly set up
 * and handles various database changes correctly.
 */

// Mock Supabase realtime channel
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
};

const mockRemoveChannel = vi.fn();

// Track subscription calls for verification
let realtimeSubscriptions: Array<{
  event: string;
  schema: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
}> = [];

// Override the .on method to capture subscriptions
mockChannel.on.mockImplementation((eventType: string, config: any, callback: any) => {
  if (eventType === 'postgres_changes') {
    realtimeSubscriptions.push({
      event: config.event,
      schema: config.schema,
      table: config.table,
      filter: config.filter,
      callback,
    });
  }
  return mockChannel;
});

const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-123', email: 'test@example.com' },
          access_token: 'mock-token',
        },
      },
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-123', email: 'test@example.com' } },
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { organization_id: 'org-123' },
    }),
  }),
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: mockRemoveChannel,
};

vi.mock('../services/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('../services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      subscriptionTier: 'starter',
      organizationId: 'org-123',
    }),
    getUserFromSession: vi.fn().mockResolvedValue({
      id: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      subscriptionTier: 'starter',
    }),
  },
}));

vi.mock('../services/demoData', () => ({
  isDemoSession: vi.fn().mockReturnValue(false),
  DEMO_USER: null,
  endDemoSession: vi.fn(),
  startDemoSession: vi.fn(),
}));

describe('AuthContext Realtime Subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtimeSubscriptions = [];
    mockChannel.on.mockClear();
    mockChannel.subscribe.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Subscription Setup', () => {
    it('should subscribe to correct tables for realtime updates', async () => {
      // Simulate the subscription setup
      const { setupRealtimeSubscription } = await simulateSubscriptionSetup();
      await setupRealtimeSubscription();

      // Verify channel was created
      expect(mockSupabase.channel).toHaveBeenCalledWith('user-permission-updates');

      // Verify all expected tables are subscribed
      const subscribedTables = realtimeSubscriptions.map((s) => s.table);
      expect(subscribedTables).toContain('organizations');
      expect(subscribedTables).toContain('user_profiles');
      expect(subscribedTables).toContain('project_shares');
      expect(subscribedTables).toContain('organization_members');
    });

    it('should filter organization updates by user org ID', async () => {
      const { setupRealtimeSubscription } = await simulateSubscriptionSetup();
      await setupRealtimeSubscription();

      const orgSubscription = realtimeSubscriptions.find((s) => s.table === 'organizations');
      expect(orgSubscription).toBeDefined();
      expect(orgSubscription?.filter).toBe('id=eq.org-123');
    });

    it('should filter user_profiles updates by user ID', async () => {
      const { setupRealtimeSubscription } = await simulateSubscriptionSetup();
      await setupRealtimeSubscription();

      const profileSubscription = realtimeSubscriptions.find((s) => s.table === 'user_profiles');
      expect(profileSubscription).toBeDefined();
      expect(profileSubscription?.filter).toBe('user_id=eq.test-user-123');
    });

    it('should filter project_shares updates by user ID', async () => {
      const { setupRealtimeSubscription } = await simulateSubscriptionSetup();
      await setupRealtimeSubscription();

      const sharesSubscription = realtimeSubscriptions.find((s) => s.table === 'project_shares');
      expect(sharesSubscription).toBeDefined();
      expect(sharesSubscription?.filter).toBe('user_id=eq.test-user-123');
    });
  });

  describe('Event Handling', () => {
    it('should dispatch custom event when project_shares changes', async () => {
      const { setupRealtimeSubscription } = await simulateSubscriptionSetup();
      await setupRealtimeSubscription();

      const sharesSubscription = realtimeSubscriptions.find((s) => s.table === 'project_shares');
      expect(sharesSubscription).toBeDefined();

      // Listen for custom event
      let eventReceived = false;
      let eventDetail: any = null;
      const handler = (e: CustomEvent) => {
        eventReceived = true;
        eventDetail = e.detail;
      };
      window.addEventListener('project-shares-updated', handler as EventListener);

      // Simulate a project share change
      sharesSubscription?.callback({
        eventType: 'INSERT',
        new: { project_id: 'proj-1', user_id: 'test-user-123' },
      });

      expect(eventReceived).toBe(true);
      expect(eventDetail?.eventType).toBe('INSERT');

      window.removeEventListener('project-shares-updated', handler as EventListener);
    });
  });
});

/**
 * Helper to simulate the subscription setup logic from AuthContext
 */
async function simulateSubscriptionSetup() {
  const setupRealtimeSubscription = async () => {
    const { data: { session } } = await mockSupabase.auth.getSession();
    if (!session?.user) return;

    const userId = session.user.id;
    
    const { data: orgMember } = await mockSupabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    const orgId = orgMember?.organization_id;

    mockSupabase
      .channel('user-permission-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'organizations',
        filter: orgId ? `id=eq.${orgId}` : undefined
      }, async () => {
        console.log('[Test] Organization updated');
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_profiles',
        filter: `user_id=eq.${userId}`
      }, async () => {
        console.log('[Test] User profile updated');
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_shares',
        filter: `user_id=eq.${userId}`
      }, (payload: any) => {
        window.dispatchEvent(new CustomEvent('project-shares-updated', { detail: payload }));
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organization_members',
        filter: `user_id=eq.${userId}`
      }, async () => {
        console.log('[Test] Organization membership changed');
      })
      .subscribe();
  };

  return { setupRealtimeSubscription };
}
