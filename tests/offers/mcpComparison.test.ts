import { describe, expect, it, vi } from 'vitest';
import { registerOfferComparisonsModule } from '../../server/mcp/modules/offerComparisons.js';
function setup(includeWriteTools = true, denied = false) {
  const configs = new Map<string, { inputSchema: { projectId: { safeParse: (value: unknown) => { success: boolean } } } }>();
  const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
  const rpc = vi.fn().mockResolvedValue({ data: {}, error: denied ? { message: 'denied' } : null });
  registerOfferComparisonsModule({ supabase: { rpc }, tools: { register: (name: string, _config: unknown, handler: (args: unknown) => Promise<unknown>) => { configs.set(name, _config as { inputSchema: { projectId: { safeParse: (value: unknown) => { success: boolean } } } }); handlers.set(name, handler); } }, includeWriteTools });
  return { rpc, handlers, configs };
}
describe('MCP offer comparison boundary', () => {
  it('does not expose saving when writes are disabled', () => {
    expect(setup(false).handlers.has('tf_save_offer_comparison')).toBe(false);
  });
  it('checks project access before matching supplied content', async () => {
    const { handlers, rpc } = setup(true, true);
    await expect(handlers.get('tf_match_offer_items')!({ projectId: 'foreign', inquiry: [], offer: [] })).rejects.toThrow('denied');
    expect(rpc).toHaveBeenCalledWith('offer_comparison_load', { project_input: 'foreign' });
  });
  it('uses only the database access check; does not invoke AI', async () => {
    const { handlers, rpc } = setup();
    await handlers.get('tf_match_offer_items')!({ projectId: 'own', inquiry: [], offer: [] });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

it.each(['tf_list_offer_comparisons','tf_match_offer_items','tf_save_offer_comparison'])('bounds the project identifier before %s reaches the handler', name => {
 const schema=setup().configs.get(name).inputSchema.projectId;
 expect(schema.safeParse('x'.repeat(1024*1024)).success).toBe(false);
 expect(schema.safeParse('project-123').success).toBe(true);
});
