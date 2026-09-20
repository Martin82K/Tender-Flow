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
it('normalizes Czech decimals before the database without changing source input',async()=>{
 const {handlers,rpc}=setup();
 const item={id:'a',code:'1',description:'Malba',unit:'m2',quantity:'1,5',unitPrice:'1 000,20',total:'1 500,30',group:'',source:{sheet:'S',row:2}};
 const sources=[{id:'base',origin:'mcp',name:'Poptávka',sha256:'a'.repeat(64),items:[item],notes:[]},{id:'offer',origin:'mcp',name:'Nabídka',sha256:'b'.repeat(64),items:[{...item,id:'b'}],notes:[]}];
 await handlers.get('tf_save_offer_comparison')!({projectId:'own',requestId:'00000000-0000-4000-8000-000000000001',title:'Test',expectedVersion:0,sources,assignments:{offer:[{baseId:'a',offerId:'b',status:'matched'}]}});
 expect(rpc.mock.calls[0][1].document_input.sources[0].items[0]).toMatchObject({quantity:'1.5',unitPrice:'1000.20',total:'1500.30'});
 expect(item.quantity).toBe('1,5');expect(item.total).toBe('1 500,30');
});
