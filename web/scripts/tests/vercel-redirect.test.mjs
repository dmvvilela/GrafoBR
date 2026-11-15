import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url),'utf8'));
test('legacy Vercel URL redirects root explicitly before deep links',()=>{
  assert.deepEqual(config.redirects[0],{source:'/',destination:'https://grafo-br.dmvvilela.workers.dev/',permanent:true});
  assert.deepEqual(config.redirects[1],{source:'/:path*',destination:'https://grafo-br.dmvvilela.workers.dev/:path*',permanent:true});
});
