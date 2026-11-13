import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../../src/lib/state-spending.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {spendingValue,composition,readSpendingSelection,spendingPath,formatSpending}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const record={status:'available',total:1000,population:100,functions:{'10':200,'12':300,'06':0},investment:50};
test('same-year per-resident and budget-share denominators',()=>{
 assert.equal(spendingValue(record,'10','perCapita'),2);
 assert.equal(spendingValue(record,'10','share'),20);
 assert.equal(spendingValue(record,'investment','total'),50);
 assert.equal(spendingValue({...record,population:200},'10','perCapita'),1);
});
test('missing values stay missing while source zero is preserved',()=>{
 assert.equal(spendingValue({...record,status:'missing'},'10','total'),null);
 assert.equal(spendingValue({...record,functions:{}},'10','total'),null);
 assert.equal(spendingValue(record,'06','total'),0);
 assert.equal(spendingValue({...record,population:0},'10','perCapita'),null);
 assert.equal(spendingValue({...record,total:0},'10','share'),null);
 assert.equal(formatSpending(null,'total'),'Sem dados');
});
test('composition excludes investment overlap and sums to 100%',()=>{
 assert.deepEqual(composition(record),[20,30,0,50]);
 assert.equal(composition({...record,functions:{'10':200}}),null);
});
const data={version:'abc',years:[2024,2025],states:[{uf:'SP'},{uf:'MG'},{uf:'DF'}]};
test('share URL round-trips every selection and flags a revised snapshot',()=>{
 const selection={a:'DF',b:'SP',year:2024,metric:'investment',unit:'share'};
 const path=spendingPath(selection,'abc');
 assert.deepEqual(readSpendingSelection(new URL(path,'https://example.test').searchParams,data),{selection,corrected:false,stale:false});
 assert.equal(readSpendingSelection(new URLSearchParams('v=old'),data).stale,true);
});
test('invalid URLs fall back explicitly without allowing unknown metrics or years',()=>{
 const parsed=readSpendingSelection(new URLSearchParams('a=ZZ&year=2026&metric=__proto__&unit=bad'),data);
 assert.equal(parsed.corrected,true);assert.equal(parsed.selection.year,2025);assert.equal(parsed.selection.metric,'10');assert.equal(parsed.selection.a,'SP');
});
test('published snapshot covers all states with matching annual population and reconciled functions',async()=>{
 const snapshot=JSON.parse(await readFile(new URL('../../public/data/_state-spending.json',import.meta.url),'utf8'));
 assert.equal(new Set(snapshot.states.map(s=>s.uf)).size,27);
 for(const state of snapshot.states){
  assert.deepEqual(state.records.map(r=>r.year),snapshot.years);
  for(const r of state.records){
   assert.ok(r.population>0);
   if(r.status==='available'){
    assert.ok(Math.abs(Object.values(r.functions).reduce((a,b)=>a+b,0)-r.total)<=1);
    assert.ok(r.investment===null||(r.investment>=0&&r.investment<=r.total));
   }
  }
 }
});
