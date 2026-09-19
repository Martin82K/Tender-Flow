import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ContractWithDetails } from '@/types';
const mocks = vi.hoisted(() => ({ projectVersions:vi.fn(), canWrite:vi.fn(), save:vi.fn(), remove:vi.fn(), confirmDocument:vi.fn(), files:vi.fn(),events:vi.fn(), attach:vi.fn(), context:vi.fn(),contacts:vi.fn(), navigate:vi.fn(), search:'' }));
vi.mock('@features/projects/contracts/documents/api',() => ({contractDocumentsApi:mocks,downloadDocumentBlob:vi.fn()}));
vi.mock('@shared/routing/router',() => ({useLocation:()=>({search:mocks.search}),navigate:mocks.navigate}));
vi.mock('@features/projects/contracts/documents/export',()=>({exportDocumentPdf:vi.fn(),exportDocumentDocx:vi.fn()}));
import { SubcontractorDocuments } from '@features/projects/documents/ui/SubcontractorDocuments';
import { HandoverSection } from '@features/projects/contracts/documents/HandoverSection';
import { DocumentDetail } from '@features/projects/documents/ui/DocumentDetail';
import { DocumentRecordForm } from '@features/projects/documents/ui/DocumentRecordForm';
import { ProjectSidebar } from '@features/projects/ui/ProjectSidebar';
import { createHandoverDraft, freezeDocument } from '@features/projects/contracts/documents/model';
const contract = {id:'c',projectId:'p',vendorId:'v',vendorName:'Novák',contractNumber:'S-1',title:'Most'} as ContractWithDetails;
const version = {id:'v1',document_id:'d1',contract_id:'c',version:1,created_at:'2026-09-18',created_by:'u',snapshot:freezeDocument(createHandoverDraft(contract),'2026-09-18',1,null,'sub_site_handover')};
function wrap(element: React.ReactNode) {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{element}</QueryClientProvider>);}
beforeEach(()=>{vi.clearAllMocks();mocks.search='';mocks.contacts.mockResolvedValue(['Jan Novák']);mocks.projectVersions.mockResolvedValue([version]);mocks.canWrite.mockResolvedValue(true);mocks.files.mockResolvedValue([]);mocks.events.mockResolvedValue([]);});
describe('documents workspace',()=>{
  it('explains a missing contract and opens contract management from protocols', async()=>{
    mocks.search='?documentsView=protocols';mocks.projectVersions.mockResolvedValue([]);
    wrap(<SubcontractorDocuments projectId="p" readOnly={false} contractsState={{contracts:[],loading:false,error:null,refresh:vi.fn()}}/>);
    expect(await screen.findByText('Pro vytvoření protokolu nejprve přidejte subdodavatelskou smlouvu.')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Nový záznam'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Přejít na smlouvy'}));
    expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining('tab=contracts'));
  });
  it('opens the new record form from the protocols workspace and saves it', async()=>{
    mocks.search='?documentsView=protocols';mocks.projectVersions.mockResolvedValue([]);
    mocks.context.mockResolvedValue({project:{title:'Most'},organizationName:'Firma',organizationAddress:'Praha',vendorAddress:'Brno',logo:null});mocks.save.mockResolvedValue(version);
    wrap(<SubcontractorDocuments projectId="p" readOnly={false} contractsState={{contracts:[contract],loading:false,error:null,refresh:vi.fn()}}/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Nový záznam'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'Nový záznam'}));
    fireEvent.change(await screen.findByLabelText('Název záznamu'),{target:{value:'Předání úseku A'}});
    fireEvent.click(screen.getByRole('button',{name:'Uložit a otevřít editor'}));
    await waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining('documentId=d1')));
  });
  it('requires confirmation before deleting a record and refreshes the list', async()=>{
    mocks.remove.mockResolvedValue(undefined);const onBack=vi.fn(),onRefresh=vi.fn().mockResolvedValue(undefined);
    wrap(<DocumentDetail version={version} versions={[version]} canWrite onBack={onBack} onEdit={vi.fn()} onRefresh={onRefresh}/>);
    fireEvent.click(screen.getByRole('button',{name:'Smazat záznam'}));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Smazat záznam'}));
    await waitFor(()=>expect(mocks.remove).toHaveBeenCalledWith('c','d1',1));
    expect(onRefresh).toHaveBeenCalled();expect(onBack).toHaveBeenCalled();
  });
  it('keeps a failed deletion visible and does not leave the record', async()=>{
    mocks.remove.mockRejectedValue(new Error('Dokument má novější verzi.'));const onBack=vi.fn();
    wrap(<DocumentDetail version={version} versions={[version]} canWrite onBack={onBack} onEdit={vi.fn()} onRefresh={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Smazat záznam'}));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Smazat záznam'}));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Dokument má novější verzi.');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('loads vendor contact suggestions when reopening a saved protocol editor',async()=>{
    wrap(<DocumentDetail vendorId="v" version={version} versions={[version]} canWrite onBack={vi.fn()} onEdit={vi.fn()} onRefresh={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Otevřít editor'}));
    await waitFor(()=>expect(document.querySelector('#protocol-vendor-contacts option')).toHaveAttribute('value','Jan Novák'));
    expect(mocks.contacts).toHaveBeenCalledWith('v');
    expect(screen.getByLabelText('Zástupce subdodavatele')).toHaveValue('');
  });
  it('retains legacy handover history in a contract without any generated protocol',async()=>{
    mocks.events.mockResolvedValue([{id:'legacy',kind:'handover',result:'accepted',effective_date:'2026-09-01',created_at:'2026-09-01',source_note:'Původní podepsané předání',created_by:'u',document_version_id:null}]);
    wrap(<HandoverSection contract={contract} warrantyOnly onRefresh={vi.fn()}/>);
    expect(await screen.findByText('Původní podepsané předání')).toBeInTheDocument();
    expect(screen.getByText(/Předání díla.*Převzato bez vad/)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Zapsat předání'})).not.toBeInTheDocument();
  });
  it('expands documents independently of contracts and routes subcontractor selection',()=>{
    const onSelect=vi.fn();render(<ProjectSidebar projects={[{id:'p',name:'Most',location:'Praha',status:'realization'}]} selectedProjectId="p" activeTab="overview" hasFeature={()=>true} onSelect={onSelect}/>);
    fireEvent.click(screen.getByRole('button',{name:'Dokumenty',exact:true}));
    fireEvent.click(within(screen.getByRole('group',{name:'Dokumenty stavby'})).getByRole('button',{name:'Subdodavatel',exact:true}));
    expect(onSelect).toHaveBeenCalledWith('p','documents','subcontractor');
    expect(screen.queryByRole('group',{name:'Smluvní strany'})).not.toBeInTheDocument();
  });
  it('loads grouped overview and keeps writes disabled for read-only access',async()=>{
    wrap(<SubcontractorDocuments projectId="p" readOnly contractsState={{contracts:[contract],loading:false,error:null,refresh:vi.fn()}}/>);
    expect(await screen.findByText('Novák')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Nový záznam'})).not.toBeInTheDocument();
    expect(mocks.canWrite).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:'Smazat záznam'})).not.toBeInTheDocument();
    expect(mocks.projectVersions).toHaveBeenCalledWith(['c']);
  });
  it('updates an existing record by creating a new version without changing its identity',async()=>{
    const next={...version,id:'v2',version:2};mocks.save.mockResolvedValue(next);const onSaved=vi.fn();
    render(<DocumentRecordForm contracts={[contract]} existing={version} onClose={vi.fn()} onSaved={onSaved}/>);
    fireEvent.change(screen.getByLabelText('Název záznamu'),{target:{value:'Opravený název'}});
    fireEvent.click(screen.getByRole('button',{name:'Uložit změny'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith(next,false));
    expect(mocks.save).toHaveBeenCalledWith('c','d1',1,expect.objectContaining({version:2,fields:expect.objectContaining({recordTitle:'Opravený název'})}));
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it('explains denied write permission without enabling creation',async()=>{
    mocks.canWrite.mockResolvedValue(false);
    wrap(<SubcontractorDocuments projectId="p" readOnly={false} contractsState={{contracts:[contract],loading:false,error:null,refresh:vi.fn()}}/>);
    expect(await screen.findByText(/potřebujete oprávnění upravovat smlouvy/)).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Nový záznam'})).toBeDisabled();
  });
  it('creates a record even when the URL contains an unavailable contract filter',async()=>{
    mocks.context.mockResolvedValue({project:{title:'Most'},organizationName:'Firma',organizationAddress:'Praha',vendorAddress:'Brno',logo:null});mocks.save.mockResolvedValue(version);
    const onSaved=vi.fn();render(<DocumentRecordForm contracts={[contract]} initialContractId="removed-contract" onClose={vi.fn()} onSaved={onSaved}/>);
    fireEvent.change(screen.getByLabelText('Název záznamu'),{target:{value:'Nový protokol'}});
    fireEvent.click(screen.getByRole('button',{name:'Uložit a otevřít editor'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith(version,true));
    expect(mocks.save.mock.calls[0][0]).toBe('c');
  });
  it('creates a site record then opens the editor without confirming handover',async()=>{
    mocks.context.mockResolvedValue({project:{title:'Most'},organizationName:'Firma',organizationAddress:'Praha',vendorAddress:'Brno',logo:null});
    mocks.save.mockResolvedValue(version);const onSaved=vi.fn();
    render(<DocumentRecordForm contracts={[contract]} onClose={vi.fn()} onSaved={onSaved}/>);
    fireEvent.change(screen.getByLabelText('Název záznamu'),{target:{value:'Předání úseku A'}});
    fireEvent.click(screen.getByRole('button',{name:'Uložit a otevřít editor'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledWith(version,true));
    expect(mocks.save.mock.calls[0][3]).toMatchObject({kind:'sub_site_handover',fields:{recordTitle:'Předání úseku A',actualDate:'',result:''}});
    expect(mocks.confirmDocument).not.toHaveBeenCalled();
  });
  it('requires explicit confirmation with source and links it to the exact version',async()=>{
    mocks.confirmDocument.mockResolvedValue(undefined);
    wrap(<DocumentDetail version={version} versions={[version]} canWrite onBack={vi.fn()} onEdit={vi.fn()} onRefresh={vi.fn()}/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Zapsat skutečné předání'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'Zapsat skutečné předání'}));
    expect(screen.getByRole('button',{name:'Potvrdit a uložit'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Skutečné datum předání'),{target:{value:'2026-09-01'}});
    fireEvent.click(screen.getByRole('combobox',{name:'Výsledek'}));
    fireEvent.click(screen.getByRole('option',{name:'Převzato bez vad'}));
    fireEvent.change(screen.getByLabelText('Zdroj potvrzení'),{target:{value:'Podepsaný protokol 1'}});
    fireEvent.click(screen.getByRole('button',{name:'Potvrdit a uložit'}));
    await waitFor(()=>expect(mocks.confirmDocument).toHaveBeenCalledWith('v1','2026-09-01','accepted','Podepsaný protokol 1'));
  });
  it('does not present confirmations of older versions as confirmed current version',async()=>{
    mocks.events.mockResolvedValue([{id:'e1',document_version_id:'v0',kind:'site_handover',result:'accepted',effective_date:'2026-09-01',created_at:'2026-09-01',source_note:'Starší',created_by:'u'}]);
    wrap(<DocumentDetail version={version} versions={[version,{...version,id:'v0',version:0}]} canWrite={false} onBack={vi.fn()} onEdit={vi.fn()} onRefresh={vi.fn()}/>);
    expect(await screen.findByText('Nepotvrzeno')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Otevřít editor'})).not.toBeInTheDocument();
  });
  it('keeps upload failures visible and never confirms an attached file',async()=>{
    mocks.attach.mockRejectedValue(new Error('Neplatný PDF'));
    wrap(<DocumentDetail version={version} versions={[version]} canWrite onBack={vi.fn()} onEdit={vi.fn()} onRefresh={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Připojit soubor k aktuální verzi'),{target:{files:[new File(['bad'],'test.pdf')]}});
    expect(await screen.findByRole('alert')).toHaveTextContent('Neplatný PDF');
    expect(mocks.confirmDocument).not.toHaveBeenCalled();
  });
});
