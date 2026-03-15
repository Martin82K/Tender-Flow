import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeAuthedFunctionMock = vi.fn();

vi.mock('../services/functionsClient', () => ({
  invokeAuthedFunction: (...args: unknown[]) => invokeAuthedFunctionMock(...args),
}));

describe('emailService', () => {
  beforeEach(() => {
    invokeAuthedFunctionMock.mockReset();
    vi.restoreAllMocks();
  });

  it('při chybě loguje jen sanitizované detaily', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    invokeAuthedFunctionMock.mockRejectedValue(
      new Error('Email john@example.com token Bearer abc.def.ghi'),
    );

    const { emailService } = await import('../services/emailService');

    await expect(
      emailService.sendEmail({
        to: 'john@example.com',
        subject: 'Test',
        text: 'Hello',
      }),
    ).rejects.toThrow('Email john@example.com token Bearer abc.def.ghi');

    const loggedPayload = JSON.stringify(consoleErrorSpy.mock.calls[0]?.[1]);
    expect(loggedPayload).toContain('[redacted-email]');
    expect(loggedPayload).toContain('[redacted-token]');
    expect(loggedPayload).not.toContain('john@example.com');
    expect(loggedPayload).not.toContain('abc.def.ghi');
  });
});
