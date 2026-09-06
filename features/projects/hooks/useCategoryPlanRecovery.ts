import { useEffect, useRef, useState } from 'react';
import type { DemandCategory } from '@/types';

export interface CategoryPlanNotice {
  key: string;
  categoryTitle: string;
  status: 'syncing' | 'error' | 'complete';
}
interface Operation {
  projectId: string;
  category: DemandCategory;
  saved: boolean;
  dismissed: boolean;
  status?: CategoryPlanNotice['status'];
  pending?: Promise<void>;
}
interface Options {
  userId?: string;
  syncEnabled?: boolean;
  save: (projectId: string, category: DemandCategory) => Promise<unknown>;
  sync: (projectId: string, category: DemandCategory, isCurrent: () => boolean) => Promise<unknown>;
}

/** Keeps confirmed primary writes separate from retryable follow-up work. No sensitive state is persisted. */
export function useCategoryPlanRecovery({ userId, syncEnabled = true, save, sync }: Options) {
  const scope = useRef({ userId, syncEnabled, operations: new Map<string, Operation>() });
  const mounted = useRef(true);
  const [, redraw] = useState(0);
  if (scope.current.userId !== userId || scope.current.syncEnabled !== syncEnabled) {
    scope.current = { userId, syncEnabled, operations: new Map() };
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const currentScope = scope.current;
  const isCurrent = () => mounted.current && scope.current === currentScope;
  const update = () => { if (isCurrent()) redraw(value => value + 1); };

  const run = (key: string, operation: Operation): Promise<void> => {
    if (!isCurrent() || !userId) return Promise.resolve();
    if (operation.pending) return operation.pending;
    // Defer execution until the promise is registered, so synchronous double clicks join it.
    operation.pending = Promise.resolve().then(async () => {
      if (!isCurrent()) return;
      if (!operation.saved) {
        try {
          await save(operation.projectId, operation.category);
          operation.saved = true;
        } catch (error) {
          currentScope.operations.delete(key);
          throw error;
        }
      }
      if (!isCurrent() || !syncEnabled) return;
      operation.dismissed = false;
      operation.status = 'syncing'; update();
      try {
        await sync(operation.projectId, operation.category, isCurrent);
        if (isCurrent()) operation.status = 'complete';
      } catch {
        if (isCurrent()) operation.status = 'error';
      }
    }).finally(() => { operation.pending = undefined; update(); });
    return operation.pending;
  };
  const retry = (key: string) => {
    const operation = currentScope.operations.get(key);
    return operation?.saved && operation.status !== 'complete' ? run(key, operation) : Promise.resolve();
  };
  return {
    notices: [...currentScope.operations.entries()].flatMap(([key, operation]): CategoryPlanNotice[] =>
      operation.status && !operation.dismissed ? [{ key, categoryTitle: operation.category.title, status: operation.status }] : []),
    addCategory: (projectId: string, category: DemandCategory) => {
      const key = JSON.stringify([projectId, category.id]);
      const existing = currentScope.operations.get(key);
      if (existing) return existing.status === 'complete' ? Promise.resolve() : run(key, existing);
      const operation: Operation = { projectId, category: { ...category }, saved: false, dismissed: false };
      currentScope.operations.set(key, operation);
      return run(key, operation);
    },
    retry,
    dismiss: (key: string) => {
      const operation = currentScope.operations.get(key);
      // Retain the confirmed-write marker to keep a repeated submit idempotent.
      if (operation?.status === 'complete' || operation?.status === 'error') {
        operation.dismissed = true; update();
      }
    },
  };
}
