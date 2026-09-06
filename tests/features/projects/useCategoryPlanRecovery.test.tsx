import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DemandCategory } from '@/types';
import { useCategoryPlanRecovery } from '@features/projects/hooks/useCategoryPlanRecovery';

const category = { id: 'category-1', title: 'Okna' } as DemandCategory;
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
const setup = () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const sync = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(({ userId }) => useCategoryPlanRecovery({ userId, save, sync }), { initialProps: { userId: 'u1' } });
  return { ...hook, save, sync };
};
describe('category plan recovery', () => {
  it('reports partial success and retries only the failed synchronization', async () => {
    const { result, save, sync } = setup();
    sync.mockRejectedValueOnce(new Error('network'));
    await act(async () => { await result.current.addCategory('p1', category); });
    expect(result.current.notices[0].status).toBe('error');
    await act(async () => { await result.current.retry(result.current.notices[0].key); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(result.current.notices[0].status).toBe('complete');
  });
  it('joins duplicate clicks during saving and during retry', async () => {
    const { result, save, sync } = setup();
    const saving = deferred(); save.mockReturnValueOnce(saving.promise);
    let first!: Promise<void>; let duplicate!: Promise<void>;
    await act(async () => { first = result.current.addCategory('p1', category); duplicate = result.current.addCategory('p1', category); });
    expect(save).toHaveBeenCalledTimes(1);
    sync.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { saving.resolve(); await Promise.all([first, duplicate]); });
    const syncing = deferred(); sync.mockReturnValueOnce(syncing.promise);
    await act(async () => { first = result.current.retry(result.current.notices[0].key); duplicate = result.current.retry(result.current.notices[0].key); });
    expect(result.current.notices[0].status).toBe('syncing');
    await act(async () => { syncing.resolve(); await Promise.all([first, duplicate]); });
    expect(sync).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('propagates primary save failure without attempting synchronization', async () => {
    const { result, save, sync } = setup(); save.mockRejectedValueOnce(new Error('save'));
    await act(async () => { await expect(result.current.addCategory('p1', category)).rejects.toThrow('save'); });
    expect(sync).not.toHaveBeenCalled(); expect(result.current.notices).toEqual([]);
  });
  it('does not continue a previous users operation or expose their notice', async () => {
    const { result, rerender, save, sync } = setup(); const saving = deferred(); save.mockReturnValueOnce(saving.promise);
    let pending!: Promise<void>; act(() => { pending = result.current.addCategory('p1', category); });
    rerender({ userId: 'u2' });
    await act(async () => { saving.resolve(); await pending; });
    expect(sync).not.toHaveBeenCalled(); expect(result.current.notices).toEqual([]);
  });
  it('tracks failures for multiple categories independently and never recreates a saved category', async () => {
    const { result, save, sync } = setup(); sync.mockRejectedValue(new Error('offline'));
    await act(async () => { await result.current.addCategory('p1', category); await result.current.addCategory('p1', { ...category, id: 'c2' }); });
    expect(result.current.notices).toHaveLength(2);
    await act(async () => { await result.current.addCategory('p1', category); });
    expect(save).toHaveBeenCalledTimes(2);
  });
  it('dismisses an error but retains the saved marker when the category is submitted again', async () => {
    const { result, save, sync } = setup();
    sync.mockRejectedValueOnce(new Error('permission revoked'));
    await act(async () => { await result.current.addCategory('p1', category); });
    const key = result.current.notices[0].key;
    act(() => result.current.dismiss(key));
    expect(result.current.notices).toEqual([]);
    await act(async () => { await result.current.addCategory('p1', category); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(result.current.notices[0].status).toBe('complete');
  });
  it('does not repeat completed synchronization after its notice is dismissed', async () => {
    const { result, save, sync } = setup();
    await act(async () => { await result.current.addCategory('p1', category); });
    const key = result.current.notices[0].key;
    act(() => result.current.dismiss(key));
    await act(async () => { await result.current.addCategory('p1', category); await result.current.retry(key); });
    expect(result.current.notices).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(1);
  });
  it('keeps pending synchronization visible when dismissal is requested', async () => {
    const { result, sync } = setup(); const syncing = deferred();
    sync.mockReturnValueOnce(syncing.promise);
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.addCategory('p1', category); });
    act(() => result.current.dismiss(result.current.notices[0].key));
    expect(result.current.notices[0].status).toBe('syncing');
    await act(async () => { syncing.resolve(); await pending; });
    expect(result.current.notices[0].status).toBe('complete');
  });

  it('stops a pending real-user follow-up when the same identity switches to demo mode', async () => {
    const saving = deferred(); const save = vi.fn().mockReturnValue(saving.promise); const sync = vi.fn();
    const { result, rerender } = renderHook(({ syncEnabled }) => useCategoryPlanRecovery({
      userId: 'u1', syncEnabled, save, sync,
    }), { initialProps: { syncEnabled: true } });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.addCategory('p1', category); });
    expect(save).toHaveBeenCalledTimes(1);
    rerender({ syncEnabled: false });
    await act(async () => { saving.resolve(); await pending; });
    expect(sync).not.toHaveBeenCalled();
    expect(result.current.notices).toEqual([]);
  });

});
