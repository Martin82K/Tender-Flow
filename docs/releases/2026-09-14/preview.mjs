import {build,preview} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const config={configFile:false,root:here,publicDir:false,plugins:[react(),{name:'documentation-no-backend',enforce:'pre',resolveId(id){if(id.endsWith('/api/contractMutationsApi'))return '\0documentation-mutations';},load(id){if(id==='\0documentation-mutations')return 'export const contractMutationsApi={linkContractToBid:async()=>{},unlinkContractFromBid:async()=>{}};';}}],resolve:{alias:Object.fromEntries([['@',''],['@shared','shared'],['@features','features']].map(([key,p])=>[key,path.join(root,p)]))},css:{postcss:root},build:{outDir:'/private/tmp/tf-feature-guides-dist',emptyOutDir:true},preview:{host:'127.0.0.1',port:4175,strictPort:true}};
await build(config);await preview(config);
