import { expect, it, vi } from 'vitest';
import { suggestOfferMatches } from '../../features/projects/offers/api/offerAssist';
vi.mock('@infra/db/dbAdapter',()=>({dbAdapter:{rpc:vi.fn()}}));
const invoke=vi.hoisted(()=>vi.fn());
vi.mock('@infra/functions/functionsClient',()=>({invokeAuthedFunction:invoke}));
const item={id:'a',code:'1',description:'Omítka',unit:'m2',quantity:'1',unitPrice:'100',total:'100',group:'SO01',source:{sheet:'S',row:1}};
it('sends no prices and rejects IDs outside supplied candidates',async()=>{
 invoke.mockResolvedValue({text:JSON.stringify({suggestions:[{baseId:'a',offerId:'foreign',reason:'match'}]}),complete:true,runId:'run'});
 await expect(suggestOfferMatches('p',[item],[{...item,id:'b'}],[{baseId:'a',offerId:null,status:'review',candidates:['b']}])).rejects.toThrow('nepovolenou');
 const body=invoke.mock.calls[0][1].body;expect(body.content).not.toContain('unitPrice');expect(body.content).not.toContain('total');
});
it('does not call paid AI if no candidates exist',async()=>{
 invoke.mockClear();expect(await suggestOfferMatches('p',[item],[],[{baseId:'a',offerId:null,status:'unmatched'}])).toEqual([]);expect(invoke).not.toHaveBeenCalled();
});
