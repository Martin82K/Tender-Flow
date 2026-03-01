import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/functionsClient', () => ({
  invokeAuthedFunction: vi.fn(),
}));

import { AIApiTest } from '@/features/settings/AIApiTest';

describe('AIApiTest server-only režim', () => {
  it('nezobrazuje vstup API klíče a komunikuje server-only režim', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    render(<AIApiTest />);

    expect(screen.getByText(/Server-only mode/i)).toBeInTheDocument();
    expect(screen.queryByText(/^API Klíč$/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Vložte váš API klíč/i)).not.toBeInTheDocument();
  });
});
