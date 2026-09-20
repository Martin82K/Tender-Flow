import { expect, it, vi } from 'vitest';
import { validateComparison, comparisonApi } from '../../features/projects/offers/api/comparisonApi';
import { registerOfferComparisonsModule } from '../../server/mcp/modules/offerComparisons.js';
import type { ComparisonDocument } from '../../features/projects/offers/model/types';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('@infra/db/dbAdapter',()=>({dbAdapter:{rpc}}));
const rows=Array.from({length:9000},(_,i)=>({id:`r${i}`,code:String(i),description:'Malba',unit:'m2',quantity:'1',unitPrice:null,total:null,group:'',source:{sheet:'S',row:i+1}}));
const source=(id:string,items=rows)=>({id,name:id,sha256:'a'.repeat(64),origin:'mcp' as const,items,notes:[]});
const itemLimit:ComparisonDocument={schemaVersion:1,sources:Array.from({length:6},(_,i)=>source(`s${i}`)),assignments:{}};
const linkLimit:ComparisonDocument={schemaVersion:1,sources:[source('base'),...Array.from({length:6},(_,i)=>source(`s${i}`,rows.slice(0,1)))],assignments:Object.fromEntries(Array.from({length:6},(_,i)=>[`s${i}`,rows.map(row=>({baseId:row.id,offerId:null,status:'review' as const}))]))};
const candidateLimit:ComparisonDocument={schemaVersion:1,sources:[source('base'),source('offer',rows.slice(0,30))],assignments:{offer:rows.map(row=>({baseId:row.id,offerId:null,status:'review',candidates:rows.slice(0,30).map(row=>row.id)}))}};
it.each([itemLimit,linkLimit,candidateLimit])('rejects aggregate work limits in the web validator before saving',async doc=>{
 rpc.mockClear();expect(()=>validateComparison(doc)).toThrow('Souhrnný limit');await expect(comparisonApi.save('p',null,'Test',doc,'request')).rejects.toThrow('Souhrnný limit');expect(rpc).not.toHaveBeenCalled();
});
it('rejects aggregate work in MCP before matching or RPC and while loading old snapshots',async()=>{
 rpc.mockClear();let save:(args:unknown)=>Promise<unknown>=async()=>{};
 registerOfferComparisonsModule({supabase:{rpc},tools:{register:(name:string,_config:unknown,handler:typeof save)=>{if(name==='tf_save_offer_comparison')save=handler;}},includeWriteTools:true});
 await expect(save({projectId:'p',title:'Test',sources:itemLimit.sources,assignments:{}})).rejects.toThrow('Souhrnný limit');expect(rpc).not.toHaveBeenCalled();
 rpc.mockResolvedValueOnce({data:{document:candidateLimit},error:null});await expect(comparisonApi.load('p','v')).rejects.toThrow('Souhrnný limit');
});
