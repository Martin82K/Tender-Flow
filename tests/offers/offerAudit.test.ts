import { expect, it, vi } from 'vitest';
import { logMcpAuditEvent } from '../../server/mcp/audit.js';
it('records comparison audit metadata without document or price contents', async () => {
 const insert=vi.fn().mockResolvedValue({error:null});
 await logMcpAuditEvent({from:()=>({insert})},{userId:'u',toolName:'tf_match_offer_items',action:'read',success:true,requestSummary:{projectId:'p',inquiry:[{description:'PRIVATE TEXT',total:'123456'}]}});
 expect(insert.mock.calls[0][0].request_summary).toEqual({projectId:'p',id:undefined,documentContentOmitted:true});
 expect(JSON.stringify(insert.mock.calls)).not.toContain('PRIVATE TEXT');
});
it('bounds comparison audit metadata even when a handler receives an oversized identifier', async () => {
 const insert=vi.fn().mockResolvedValue({error:null});
 await logMcpAuditEvent({from:()=>({insert})},{userId:'u',toolName:'tf_match_offer_items',action:'read',success:false,requestSummary:{projectId:'x'.repeat(1024*1024)}});
 expect(JSON.stringify(insert.mock.calls[0][0].request_summary).length).toBeLessThan(4000);
});
