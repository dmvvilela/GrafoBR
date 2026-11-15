import {writeAssets,writeWorkerConfig,writeRootConfig,cleanBuildOutputDir} from '@cloudflare/build-output-utils';
import config from './cloudflare.config.ts';
import { addCanonical } from './canonical.mjs';
const root=process.cwd();
await cleanBuildOutputDir(root);
await writeAssets({root,sourceDirectory:'../web/out'});
console.log('Added canonical URLs:', await addCanonical(root+'/.cloudflare/output/v0/workers/default/assets', 'https://grafo-br.dmvvilela.workers.dev'));
await writeWorkerConfig({root,config:config.worker});
await writeRootConfig(root,{accountId:config.accountId},{isPreview:false});
