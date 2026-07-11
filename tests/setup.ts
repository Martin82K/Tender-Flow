import '@testing-library/jest-dom';
import { afterAll, afterEach } from 'vitest';
import { testConsoleGuard } from './utils/consoleGuard';

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: unknown[]) => testConsoleGuard.capture('error', args);
console.warn = (...args: unknown[]) => testConsoleGuard.capture('warn', args);

afterEach(() => {
  try {
    testConsoleGuard.verify();
  } finally {
    testConsoleGuard.reset();
  }
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
