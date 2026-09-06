// Persistence events keep API writes independent of React and any particular QueryClient.
const listeners = new Set<() => void>();

export const notifyProjectBidsPersisted = (): void => {
  for (const listener of listeners) listener();
};

export const subscribeToProjectBidChanges = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
