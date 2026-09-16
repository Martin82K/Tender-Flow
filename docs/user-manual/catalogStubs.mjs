// Used only by the standalone documentation build, never by the application.
// Reads return synthetic fixtures. Unsupported reads and all remote writes fail closed.
export function catalogStubs(root) {
  const blocked = `const blocked=()=>{throw new Error('Dokumentační ukázka neprovádí vzdálené operace.')};const service=(reads={})=>new Proxy(reads,{get:(o,k)=>k in o?o[k]:blocked});`;
  const fixtures = `import {user,projects,project,contacts,task,contract} from '${root}/docs/user-manual/fixtureData.ts';`;
  const modules = {
    'context/AuthContext.tsx': `${fixtures} export const useAuth=()=>({user,updatePreferences:blocked,logout:blocked,login:blocked,canUseBiometric:false,hasSavedCredentials:false});`,
    'context/UIContext.tsx': `export const useUI=()=>({showAlert:blocked,showConfirm:async()=>false});`,
    'context/FeatureContext.tsx': `export const useFeatures=()=>({hasFeature:()=>true,currentPlan:'enterprise',isLoading:false});`,
    'features/tasks/hooks/useTaskProjectOptions.ts': `${fixtures} export const useTaskProjectOptions=()=>projects;`,
    'shared/auth/AuthIdentityContext.tsx': `${fixtures} export const useAuthIdentity=()=>user;`,
    'features/tasks/hooks/useTasksQuery.ts': `${fixtures} export const TASK_KEYS={all:['tasks'],list:()=>['tasks']};export const useTasksQuery=()=>({data:[task,{...task,id:'task-inbox',title:'Doplnit kontakty dodavatele',dueAt:undefined,reminderAt:undefined,priority:3}],isLoading:false,isError:false});`,
    'features/tasks/hooks/useTaskProjectsQuery.ts': `export const TODO_PROJECT_KEYS={all:['todo-projects'],list:()=>['todo-projects']};export const useTaskProjectsQuery=()=>({data:[],isLoading:false,isError:false});`,
    'features/tasks/hooks/useMicrosoftTodoSync.ts': `export const useMicrosoftTodoSync=()=>({connected:true,isChecking:false,isSyncing:false,lastSyncedAt:'2026-09-16T08:00:00Z',syncError:null,syncNow:blocked});`,
    'features/tasks/hooks/useTaskMutations.ts': `const mutation=()=>({mutate:blocked,mutateAsync:blocked,isPending:false});export const useCreateTaskMutation=mutation,useDeleteTaskMutation=mutation,useToggleTaskMutation=mutation,useUpdateTaskMutation=mutation,useDeleteCompletedTasksMutation=mutation;`,
    'features/projects/contracts/api/contractMutationsApi.ts': `export const contractMutationsApi=service();`,
    'features/projects/contracts/api/contractQueriesApi.ts': `export const contractQueriesApi=service({getMarkdownVersions:async()=>[],getContractMarkdownVersions:async()=>[],getAmendmentMarkdownVersions:async()=>[]});`,
    'features/contracts-overview/api/contractOverviewApi.ts': `${fixtures} export const formatContractOverviewMoney=(n,c='CZK')=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:c,maximumFractionDigits:0}).format(n);export const openContractOverviewDocument=blocked;export const getContractOverview=async()=>[{...contract,projectName:project.title,projectStatus:'realization',contractId:contract.id,contractPartner:contract.vendorName,contractTitle:contract.title,contractStatus:contract.status,approvedDrawdown:contract.approvedSum,remainingAmount:contract.remaining,maturityDays:30,warrantyEnd:null,amendments:contract.amendments}];`,
    'features/projects/api/projectScheduleApi.ts': `export const updateCategoryDeadline=blocked,updateCategoryRealizationWindow=blocked;`,
    'features/projects/api/tenderPlanApi.ts': `export const getTenderPlans=async()=>[{id:'plan-elektro',name:'Elektroinstalace',dateFrom:'2026-10-05',dateTo:'2026-10-23',categoryId:'elektro'},{id:'plan-slabo',name:'Slaboproud',dateFrom:'2026-10-12',dateTo:'2026-10-30',categoryId:'slaboproud'},{id:'plan-svetlo',name:'Venkovní osvětlení',dateFrom:'2026-11-02',dateTo:'2026-11-13'}];export const createTenderPlan=blocked,deleteTenderPlan=blocked,syncTenderPlansWithCategories=blocked,updateTenderPlanDates=blocked,updateTenderPlanItem=blocked,createTenderPlanId=()=> 'manual-plan',createTenderPlanRandomId=createTenderPlanId;`,
    'features/notifications/hooks/useNotifications.ts': `export const useNotifications=()=>({notifications:[],isLoading:false,unreadCount:0,refresh:()=>{},markRead:blocked,markAllRead:blocked,dismiss:blocked,dismissAll:blocked});`,
    'features/help/hooks/useHelp.ts': `export const useHelp=()=>({isActive:false,toggle:()=>{}});`,
    'features/projects/model/useProjectsState.ts': `${fixtures} export const useProjectsState=()=>({projects});`,
    'features/projects/hooks/useProjectPortfolioSummary.ts': `export const useProjectPortfolioSummary=()=>({data:{'manual-javor':{openCount:1,deadlines:[{date:'2026-10-23',title:'Elektroinstalace'}]},'manual-lipa':{openCount:0,deadlines:[]}},isLoading:false,isError:false});`,
    'services/contractService.ts': String.raw`export const contractService=service({getMarkdownVersions:async()=>[{id:'manual-version',entityType:'contract',contractId:'manual-contract',projectId:'manual-javor',versionNo:1,sourceKind:'manual_edit',contentMd:'# JAV-2026-001\n\nSyntetický přepis pro výuku.\n\nDodavatel: Javor Elektro — ukázka.\n\nZákladní cena: 1 620 000 Kč bez DPH.\n\nRozsah: elektroinstalace a slaboproud.\n\nTento text není skutečnou smlouvou.',metadata:{},createdAt:'2026-09-16T08:00:00Z'}],logMarkdownAccess:async()=>{}});`,
    'features/organization/api/index.ts': `export const organizationService=service({getOrganizationMembers:async()=>[{user_id:'manual-user',display_name:'Anna Ukázková',email:'anna@example.com',is_active:true},{user_id:'manual-petr',display_name:'Petr Vzorový',email:'petr@example.com',is_active:true}]});`,
    'services/projectService.ts': `export const projectService=service({getProjectTeam:async()=>[{userId:'manual-user',displayName:'Anna Ukázková',email:'anna@example.com',accessKind:'system_owner'},{userId:'manual-petr',displayName:'Petr Vzorový',email:'petr@example.com',accessKind:'team_member'}],getProjectShares:async()=>[]});`,
    'features/contacts/hooks/useContactsQuery.ts': `${fixtures} export const useContactsQuery=()=>({data:contacts,isLoading:false});`,
    'features/projects/hooks/useOverviewTenantDataQuery.ts': `${fixtures} export const useOverviewTenantDataQuery=()=>({data:{projects,projectDetails:{[project.id]:project}},isLoading:false,isError:false});`,
    'services/templateService.ts': `export const getTemplates=async()=>[{id:'manual-inquiry',name:'Poptávka Javor',subject:'Poptávka — Bytový dům Javor',content:'Dobrý den, žádáme o nabídku elektroinstalace pro ukázkovou stavbu Javor. Nabídku zašlete do 23. 10. 2026. Uveďte rozsah a případné výluky.',isDefault:true}];export const saveTemplate=blocked,deleteTemplate=blocked;`,
    'features/maps/services/mapyApiService.ts': `export const mapyApiService=service({getTileConfig:async()=>{throw new Error('Dokumentační náhled používá veřejný OSM podklad.')}});`,
    'features/maps/hooks/useNearbyRoutes.ts': `export const useNearbyRoutes=()=>({routes:new Map(),isLoading:false,error:null});`,
    'features/notifications/api/notificationPreferencesApi.ts': `import {DEFAULT_NOTIFICATION_PREFERENCES} from '${root}/features/notifications/types.ts';export const notificationPreferencesApi=service({get:async()=>({...DEFAULT_NOTIFICATION_PREFERENCES,quiet_hours_start:'18:00',quiet_hours_end:'07:00'})});`,
    'features/notifications/api/notificationApi.ts': `export const notificationApi=service({hasDesktopPermission:()=>false});`,
    'infra/auth/mfaService.ts': `export const mfaService=service({getStatus:async()=>({verifiedFactors:[{id:'manual-factor',factorType:'totp',friendlyName:'Ukázkový autentizátor',status:'verified'}],unverifiedFactors:[],currentLevel:'aal2',nextLevel:'aal2'})});`,
    'infra/auth/deviceService.ts': `export const authDeviceService=service({listDevices:async()=>[{id:'manual-device',deviceName:'Ukázkový prohlížeč',clientKind:'web',platform:'macOS',status:'active',isCurrent:true,lastSeenAt:'2026-09-16T08:00:00Z',firstSeenAt:'2026-09-10T08:00:00Z',ipAddress:'192.0.2.10'}]});`,
    'features/settings/api/mcpGrantService.ts': `export const listMyMcpClientGrants=async()=>[{clientId:'manual-ai',clientName:'Ukázkový AI klient',clientUri:'https://example.com',contactsReadExpiresAt:null,writeExpiresAt:'infinity',bidOfferWriteExpiresAt:null}];export const revokeMyMcpClientAccess=blocked,setMyMcpClientGrant=blocked;`,
    'infra/auth/microsoftAccountService.ts': `export const microsoftAccountService=service({completeMicrosoftAccountConnection:async()=>{},getGraphStatus:async()=>({connected:true}),getLoginIdentity:async()=>({available:true,linked:true,email:'anna@example.com'}),getTodoStatus:async()=>({syncError:null})});export const microsoftLoginService=service({isAvailable:async()=>true});`,
    'features/backup/api/backupService.ts': `export const backupService=service({isLocalBackupAvailable:()=>false});`,
    'services/userProfileService.ts': `export const userProfileService=service({getProfile:async()=>({displayName:'Anna Ukázková',signatureName:'Anna Ukázková',signatureRole:'Příprava staveb',signatureEmail:'anna@example.com',signaturePhone:'+420 000 000 001',signatureGreeting:'S pozdravem'})});`,
    'features/settings/api/index.ts': `export const trackFeatureUsage=async()=>{};export const organizationService=service({getMyOrgRequestStatus:async()=>({organization_id:'manual-org',organization_name:'Javor — ukázková organizace',status:'approved'})});`,
    'services/indexerService.ts': `export const loadIndexEntries=async()=>[{id:'manual-index',code:'741',description:'Elektroinstalace — ukázka'}];export const addIndexEntry=blocked,addIndexEntriesBulk=blocked,updateIndexEntry=blocked,deleteIndexEntry=blocked,deleteAllIndexEntries=blocked;`,
  };
  return {
    name: 'manual-catalog-synthetic-data', enforce: 'pre',
    async resolveId(source, importer) {
      if (source.startsWith('\0')) return;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved) return;
      const relative = resolved.id.replace(`${root}/`, '');
      if (relative in modules) return `\0manual-catalog:${relative}`;
    },
    load(id) {
      if (id.startsWith('\0manual-catalog:')) return blocked + modules[id.slice('\0manual-catalog:'.length)];
    },
  };
}
