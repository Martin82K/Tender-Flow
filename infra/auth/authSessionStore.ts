import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";

export type AuthSessionEvent = AuthChangeEvent | "SESSION_SYNC";

export interface AuthSessionSnapshot {
  event: AuthSessionEvent;
  session: Session | null;
  accessToken: string | null;
  updatedAt: number;
}

type AuthSessionListener = (snapshot: AuthSessionSnapshot) => void;

class AuthSessionStore {
  private snapshot: AuthSessionSnapshot | null = null;
  private listeners = new Set<AuthSessionListener>();
  private authSubscription: { unsubscribe: () => void } | null = null;
  private syncInFlight: Promise<void> | null = null;

  start(): void {
    if (this.authSubscription) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      this.publish(event, session);
    });
    this.authSubscription = subscription;
  }

  stop(): void {
    if (!this.authSubscription) return;
    this.authSubscription.unsubscribe();
    this.authSubscription = null;
  }

  getSnapshot(): AuthSessionSnapshot | null {
    return this.snapshot;
  }

  subscribe(listener: AuthSessionListener): () => void {
    this.listeners.add(listener);
    if (this.snapshot) {
      listener(this.snapshot);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  async syncSession(): Promise<void> {
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        this.publish("SESSION_SYNC", data?.session ?? null);
      } finally {
        this.syncInFlight = null;
      }
    })();
    return this.syncInFlight;
  }

  private publish(event: AuthSessionEvent, session: Session | null): void {
    const nextSnapshot: AuthSessionSnapshot = {
      event,
      session,
      accessToken: session?.access_token ?? null,
      updatedAt: Date.now(),
    };
    this.snapshot = nextSnapshot;
    for (const listener of this.listeners) {
      listener(nextSnapshot);
    }
  }
}

export const authSessionStore = new AuthSessionStore();
