import { expect, it, vi } from 'vitest';
import { suggestOfferMatches, extractPdfOffer } from '../../features/projects/offers/api/offerAssist';
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
it('generates candidate proposals for inquiry rows omitted from MCP assignments',async()=>{
 invoke.mockClear();invoke.mockResolvedValue({text:JSON.stringify({suggestions:[{baseId:'a',offerId:'b',reason:'Stejná položka'}]}),complete:true,runId:'run'});
 const result=await suggestOfferMatches('p',[item],[{...item,id:'b'}],[]);
 expect(invoke).toHaveBeenCalledTimes(1);expect(result[0].offerId).toBe('b');
});

it('skips rows without candidates before selecting the paid batch',async()=>{
 invoke.mockClear();invoke.mockResolvedValue({text:JSON.stringify({suggestions:[{baseId:'a',offerId:'b',reason:'Shoda'}]}),complete:true,runId:'run'});
 const unmatched=Array.from({length:20},(_,i)=>({...item,id:`missing-${i}`,code:`missing-${i}`,description:`Jiná práce ${i}`}));
 expect(await suggestOfferMatches('p',[...unmatched,item],[{...item,id:'b'}],[])).toHaveLength(1);
 expect(JSON.parse(invoke.mock.calls[0][1].body.content)).toHaveLength(1);
});
it('derives a missing PDF total from explicit operands while preserving supplied totals and zero',async()=>{
 invoke.mockClear();invoke.mockResolvedValueOnce({pages:[{page:1,text:'OCR'}],limitedToPages:20}).mockResolvedValueOnce({complete:true,text:JSON.stringify({items:[{...item,quantity:'1.5',unitPrice:'2.33',total:null},{...item,quantity:'2',unitPrice:'3',total:'7'},{...item,quantity:'2',unitPrice:'0',total:null}],notes:[],summary:null})});
 const file=new File(['%PDF-1.7'],'offer.pdf');Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('%PDF-1.7').buffer});
 const result=await extractPdfOffer('p',file);expect(result.items.map(row=>row.total)).toEqual(['3.50','7','0.00']);
});

it('rejects more than 10000 PDF items before returning a document or charging later pages',async()=>{
 invoke.mockClear();invoke.mockResolvedValueOnce({pages:Array.from({length:12},(_,i)=>({page:i+1,text:'OCR'})),limitedToPages:20}).mockResolvedValue({complete:true,text:JSON.stringify({items:Array(1000).fill(item),notes:[],summary:null})});
 const file=new File(['%PDF-1.7'],'large.pdf');Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('%PDF-1.7').buffer});
 await expect(extractPdfOffer('p',file)).rejects.toThrow('10 000');expect(invoke).toHaveBeenCalledTimes(12);
});
