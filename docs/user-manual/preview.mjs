import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'tf-manual-fixtures-'));
const config = {
  configFile: false, envDir: false, root: here, publicDir: false,
  plugins: [react(), {
    name: 'manual-no-backend', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/api/contractMutationsApi')) return '\0manual-mutations';
      if (id.endsWith('/api/tenderPlanApi')) return '\0manual-plans';
    },
    load(id) {
      if (id === '\0manual-mutations') return 'const blocked=async()=>{throw new Error("Ukázka příručky neukládá data.")};export const contractMutationsApi={linkContractToBid:blocked,unlinkContractFromBid:blocked};';
      if (id === '\0manual-plans') return `
        const blocked=async()=>{throw new Error('Ukázka příručky neukládá data.')};
        export const createTenderPlan=blocked,deleteTenderPlan=blocked,syncTenderPlansWithCategories=blocked,updateTenderPlanDates=blocked,updateTenderPlanItem=blocked;
        export const createTenderPlanId=()=> 'manual-plan',createTenderPlanRandomId=createTenderPlanId;
        export const getTenderPlans=async()=>[
          {id:'plan-elektro',name:'Elektroinstalace',dateFrom:'2026-10-05',dateTo:'2026-10-23',categoryId:'elektro'},
          {id:'plan-slabo',name:'Slaboproud',dateFrom:'2026-10-12',dateTo:'2026-10-30',categoryId:'slaboproud'},
          {id:'plan-svetlo',name:'Venkovní osvětlení',dateFrom:'2026-11-02',dateTo:'2026-11-13'}
        ];`;
    },
  }],
  resolve: { alias: Object.fromEntries([['@', ''], ['@shared', 'shared'], ['@features', 'features']].map(([name, dir]) => [name, path.join(root, dir)])) },
  css: { postcss: root },
  build: { outDir: temporary, emptyOutDir: true },
  preview: { host: '127.0.0.1', port: 4176, strictPort: true },
};
await build(config);
await preview(config);
