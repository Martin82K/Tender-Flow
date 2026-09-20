import { beforeEach, expect, it, vi } from 'vitest';
import { syncImportedTenderDocHub } from '@features/projects/budget/api/tenderDocHub';
const fixture=vi.hoisted(()=>({project:{id:'p',owner_id:'u',dochub_enabled:true,dochub_provider:'gdrive',dochub_root_link:'/p',dochub_structure_v1:null},categories:[{id:'a',title:'Práce'}],desktop:true,from:vi.fn(),invoke:vi.fn(),ensure:vi.fn(),root:vi.fn(),user:vi.fn()}));
vi.mock('@infra/db/dbAdapter',()=>({dbAdapter:{from:fixture.from}}));
vi.mock('@infra/functions/functionsClient',()=>({invokeAuthedFunction:fixture.invoke}));
vi.mock('@infra/files/fileSystemService',()=>({ensureStructure:fixture.ensure}));
vi.mock('@infra/auth/authSessionStore',()=>({authSessionStore:{syncSession:vi.fn(async()=>{}),getSnapshot:fixture.user}}));
vi.mock('@infra/platform/platformAdapter',()=>({get isDesktop(){return fixture.desktop;}}));
vi.mock('@features/projects/dochub/model/personalRoot',()=>({resolveEffectiveProjectDocHubRoot:fixture.root}));
beforeEach(()=>{
  vi.clearAllMocks();fixture.project.dochub_enabled=true;fixture.project.dochub_provider='gdrive';fixture.desktop=true;
  fixture.invoke.mockResolvedValue({});fixture.ensure.mockResolvedValue({success:true});fixture.root.mockResolvedValue('/validated/p');fixture.user.mockReturnValue({session:{user:{id:'u'}}});
  fixture.from.mockImplementation((table:string)=>{const query={select:vi.fn(()=>query),eq:vi.fn(()=>query),single:vi.fn(async()=>({data:fixture.project,error:null})),in:vi.fn(async()=>({data:fixture.categories,error:null}))};return query;});
});
it('synchronizes only committed category ids through the authenticated cloud path',async()=>{
  await syncImportedTenderDocHub('p',['a']);
  expect(fixture.invoke).toHaveBeenCalledWith('dochub-sync-category',{body:{projectId:'p',categoryId:'a',categoryTitle:'Práce',action:'upsert'}});
  expect(fixture.ensure).not.toHaveBeenCalled();
});
it('uses the validated personal local root and one batched filesystem operation',async()=>{
  fixture.project.dochub_provider='onedrive';await syncImportedTenderDocHub('p',['a']);
  expect(fixture.root).toHaveBeenCalledWith(expect.objectContaining({id:'p',ownerId:'u'}),'u');
  expect(fixture.ensure).toHaveBeenCalledWith(expect.objectContaining({projectId:'p',rootPath:'/validated/p',categories:fixture.categories,suppliers:{a:[]}}));
  expect(fixture.invoke).not.toHaveBeenCalled();
});
it('does not touch disabled DocHub or a local root outside desktop',async()=>{
  fixture.project.dochub_enabled=false;await syncImportedTenderDocHub('p',['a']);expect(fixture.invoke).not.toHaveBeenCalled();
  fixture.project.dochub_enabled=true;fixture.project.dochub_provider='onedrive';fixture.desktop=false;
  await expect(syncImportedTenderDocHub('p',['a'])).rejects.toThrow();expect(fixture.ensure).not.toHaveBeenCalled();
});
it('does nothing for no new categories and reports synchronization failures',async()=>{
  await syncImportedTenderDocHub('p',[]);expect(fixture.from).not.toHaveBeenCalled();
  fixture.invoke.mockRejectedValue(new Error('Unavailable'));await expect(syncImportedTenderDocHub('p',['a'])).rejects.toThrow();
  fixture.project.dochub_provider='onedrive';fixture.ensure.mockResolvedValue({success:false,error:'Unavailable'});
  await expect(syncImportedTenderDocHub('p',['a'])).rejects.toThrow();
});
it('scopes category lookup to the project and stops before filesystem access without a verified identity/root',async()=>{
  await syncImportedTenderDocHub('p',['a']);
  expect(fixture.from.mock.results[1].value.eq).toHaveBeenCalledWith('project_id','p');
  expect(fixture.from.mock.results[1].value.in).toHaveBeenCalledWith('id',['a']);
  fixture.project.dochub_provider='onedrive';fixture.user.mockReturnValue(null);
  await expect(syncImportedTenderDocHub('p',['a'])).rejects.toThrow();
  fixture.user.mockReturnValue({session:{user:{id:'u'}}});fixture.root.mockResolvedValue('');
  await expect(syncImportedTenderDocHub('p',['a'])).rejects.toThrow();expect(fixture.ensure).not.toHaveBeenCalled();
});
