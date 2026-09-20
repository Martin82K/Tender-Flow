import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { OfferProcessingAdmin } from '../../features/settings/OfferProcessingAdmin';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@infra/db/dbAdapter',()=>({dbAdapter:{rpc}}));
it('shows unknown charges separately and accuracy only from reviewed suggestions', async()=>{
 rpc.mockResolvedValue({data:{settings:{enabled:false,monthly_limit_usd:5},runs:[{id:'1',project_id:'p',stage:'matching',model:'small',status:'failed',reserved_usd:0.1,estimated_cost_usd:null,created_at:'2026-09-20T12:00:00Z'},{id:'2',project_id:'p',stage:'matching',model:'small',status:'completed',estimated_cost_usd:0,created_at:'2026-09-20T12:00:00Z'}],quality:[{model:'small',accepted:3,rejected:1}]},error:null});
 render(<OfferProcessingAdmin organizationId="org"/>);
 expect(await screen.findByText('Neznámý')).toBeInTheDocument();
 expect(screen.getByText(/75.0 % správných z ověřených/)).toBeInTheDocument();
 expect(screen.getByText('Neznámý náklad / běžící: 1')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Uložit limit'}));
 await waitFor(()=>expect(rpc).toHaveBeenLastCalledWith('offer_processing_admin',{org_input:'org',days_input:30,enabled_input:false,limit_input:5}));
});
