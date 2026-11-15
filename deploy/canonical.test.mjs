import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {addCanonical} from './canonical.mjs';
test('canonical normalizer preserves explicit metadata, excludes 404 and verification, and is idempotent',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'grafo-seo-'));
 try{
  await mkdir(path.join(root,'politico'));
  const fixtures={'index.html':'<head></head>','politico/123.html':'<head></head>','404.html':'<head></head>','google.html':'google-site-verification: x','explicit.html':'<head><link rel="canonical" href="https://example.com/explicit"/></head>'};
  for(const [file,body] of Object.entries(fixtures))await writeFile(path.join(root,file),body);
  assert.equal(await addCanonical(root,'https://example.com'),2);
  assert.match(await readFile(path.join(root,'index.html'),'utf8'),/href="https:\/\/example.com\/"/);
  assert.match(await readFile(path.join(root,'politico/123.html'),'utf8'),/href="https:\/\/example.com\/politico\/123"/);
  for(const file of ['404.html','google.html','explicit.html'])assert.equal(await readFile(path.join(root,file),'utf8'),fixtures[file]);
  assert.equal(await addCanonical(root,'https://example.com'),0);
 }finally{await rm(root,{recursive:true,force:true});}
});
