import { beforeEach, describe, expect, it, vi } from 'vitest';
import { organizationService } from '../services/organizationService';

const supabaseMocks = vi.hoisted(() => ({
  functionsInvoke: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    functions: {
      invoke: supabaseMocks.functionsInvoke,
    },
  },
}));

describe('organizationService.deleteUserAccount', () => {
  beforeEach(() => {
    supabaseMocks.functionsInvoke.mockReset();
  });

  it('volá Edge Function delete-user-account se správnými parametry', async () => {
    supabaseMocks.functionsInvoke.mockResolvedValue({
      data: { success: true, rpcResult: { user_id: 'user-1', email: 'a@b.cz' } },
      error: null,
    });

    await organizationService.deleteUserAccount('org-1', 'user-1', 'a@b.cz');

    expect(supabaseMocks.functionsInvoke).toHaveBeenCalledWith('delete-user-account', {
      body: {
        orgId: 'org-1',
        userId: 'user-1',
        confirmationEmail: 'a@b.cz',
      },
    });
  });

  it('propaguje serverovou chybu z Edge Function', async () => {
    supabaseMocks.functionsInvoke.mockResolvedValue({
      data: { error: 'Only organization owner can delete user accounts' },
      error: { message: 'Edge Function returned non-2xx' },
    });

    await expect(
      organizationService.deleteUserAccount('org-1', 'user-1', 'a@b.cz'),
    ).rejects.toThrow('Only organization owner can delete user accounts');
  });

  it('hází chybu, pokud response nemá success=true', async () => {
    supabaseMocks.functionsInvoke.mockResolvedValue({
      data: { success: false, error: 'Confirmation email does not match' },
      error: null,
    });

    await expect(
      organizationService.deleteUserAccount('org-1', 'user-1', 'wrong@b.cz'),
    ).rejects.toThrow('Confirmation email does not match');
  });

  it('hází generickou chybu, pokud je odpověď prázdná', async () => {
    supabaseMocks.functionsInvoke.mockResolvedValue({ data: null, error: null });

    await expect(
      organizationService.deleteUserAccount('org-1', 'user-1', 'a@b.cz'),
    ).rejects.toThrow('Smazání účtu selhalo.');
  });
});
