import { dbAdapter } from '@infra/db/dbAdapter';
import { isDesktop } from '@infra/platform/platformAdapter';
import { invokeAuthedFunction } from '@infra/functions/functionsClient';
import { ensureStructure } from '@infra/files/fileSystemService';
import { authSessionStore } from '@infra/auth/authSessionStore';
import { resolveEffectiveProjectDocHubRoot } from '@features/projects/dochub/model/personalRoot';
import { buildHierarchyTree, ensureExtraHierarchy, resolveDocHubStructureV1 } from '@shared/dochub/docHub';
import type { ProjectDetails } from '@/types';

/** Post-commit, repeatable folder creation; never repeats the database import. */
export async function syncImportedTenderDocHub(projectId:string,createdIds:string[]):Promise<void> {
  if(!createdIds.length)return;
  const projectResult=await dbAdapter.from('projects').select('id,owner_id,dochub_enabled,dochub_provider,dochub_root_link,dochub_root_id,dochub_structure_v1').eq('id',projectId).single();
  if(projectResult.error||!projectResult.data)throw new Error('Nastavení DocHubu není dostupné.');
  const row=projectResult.data;
  if(!row.dochub_enabled||!row.dochub_provider)return;
  const categories:Array<{id:string;title:string}>=[];const uniqueIds=[...new Set(createdIds)];
  for(let start=0;start<uniqueIds.length;start+=100){
    const categoryResult=await dbAdapter.from('demand_categories').select('id,title').eq('project_id',projectId).in('id',uniqueIds.slice(start,start+100));
    if(categoryResult.error)throw new Error('Nová VŘ nejsou dostupná pro synchronizaci.');
    categories.push(...(categoryResult.data??[]));
  }
  if(!categories.length)return;
  if((row.dochub_provider==='onedrive'||row.dochub_provider==='local')){
    if(!isDesktop)throw new Error('Lokální složky vytvořte v desktopové aplikaci.');
    await authSessionStore.syncSession();const userId=authSessionStore.getSnapshot()?.session?.user.id;if(!userId)throw new Error('Přihlášení není dostupné.');
    // Legacy local roots use the same owner/personal-root validation as OneDrive.
    const project:ProjectDetails={id:projectId,ownerId:row.owner_id??undefined,title:'',location:'',finishDate:'',siteManager:'',categories:[],docHubProvider:'onedrive',docHubRootLink:row.dochub_root_link??undefined,docHubRootId:row.dochub_root_id,docHubStructureV1:row.dochub_structure_v1};
    const rootPath=await resolveEffectiveProjectDocHubRoot(project,userId);
    if(!rootPath)throw new Error('Nastavte vlastní ověřené umístění DocHubu.');
    const structure=resolveDocHubStructureV1(project.docHubStructureV1??undefined);
    const result=await ensureStructure({projectId,rootPath,structure,categories,suppliers:Object.fromEntries(categories.map(c=>[c.id,[]])),hierarchy:buildHierarchyTree(ensureExtraHierarchy(structure.extraHierarchy))});
    if(!result.success)throw new Error('Lokální složky se nepodařilo vytvořit.');
    return;
  }
  if(row.dochub_provider!=='gdrive'&&row.dochub_provider!=='onedrive_cloud')throw new Error('Poskytovatel DocHubu není podporovaný.');
  // Limit concurrent authenticated provider requests; abort remaining batches on failure.
  for(let start=0;start<categories.length;start+=4){
    const results=await Promise.allSettled(categories.slice(start,start+4).map(c=>invokeAuthedFunction('dochub-sync-category',{body:{projectId,categoryId:c.id,categoryTitle:c.title,action:'upsert'}})));
    if(results.some(result=>result.status==='rejected'))throw new Error('Cloudové složky se nepodařilo vytvořit.');
  }
}
