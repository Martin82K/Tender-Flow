import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isDemoSession,
  startDemoSession,
  endDemoSession,
  DEMO_SESSION_KEY,
  _testSetDemoActive,
} from '../services/demoData';

describe('Demo mode security', () => {
  beforeEach(() => {
    _testSetDemoActive(false);
    localStorage.clear();
  });

  afterEach(() => {
    _testSetDemoActive(false);
    localStorage.clear();
  });

  it('isDemoSession returns false by default', () => {
    expect(isDemoSession()).toBe(false);
  });

  it('setting localStorage directly does NOT activate demo mode (bypass prevention)', () => {
    // Attacker tries to set demo_session flag via DevTools
    localStorage.setItem(DEMO_SESSION_KEY, 'true');

    // Demo mode should NOT be active — runtime flag was never set
    expect(isDemoSession()).toBe(false);
  });

  it('startDemoSession activates demo mode via runtime flag', () => {
    startDemoSession();

    expect(isDemoSession()).toBe(true);
    // localStorage flag is also set (for demo data storage), but auth depends on runtime
    expect(localStorage.getItem(DEMO_SESSION_KEY)).toBe('true');
  });

  it('endDemoSession clears both runtime flag and localStorage', () => {
    startDemoSession();
    expect(isDemoSession()).toBe(true);

    endDemoSession();

    expect(isDemoSession()).toBe(false);
    expect(localStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });

  it('demo mode does not survive module re-evaluation (page refresh simulation)', () => {
    startDemoSession();
    expect(isDemoSession()).toBe(true);

    // Simulate page refresh: runtime variable resets, localStorage persists
    _testSetDemoActive(false);

    // Even though localStorage still has the flag, demo mode is NOT active
    expect(localStorage.getItem(DEMO_SESSION_KEY)).toBe('true');
    expect(isDemoSession()).toBe(false);
  });

  it('multiple start/end cycles work correctly', () => {
    startDemoSession();
    expect(isDemoSession()).toBe(true);

    endDemoSession();
    expect(isDemoSession()).toBe(false);

    startDemoSession();
    expect(isDemoSession()).toBe(true);

    endDemoSession();
    expect(isDemoSession()).toBe(false);
  });
});
