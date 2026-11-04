import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createTuitionApi } from '../src/features/payments/api.ts';
import type { PortalClient } from '../src/lib/supabase.ts';
import type { TuitionCharge } from '../src/features/payments/model.ts';

const url=process.env.SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secret=process.env.SUPABASE_SECRET_KEY;
if(url!=='https://jbzaqvutbybrhjctrexc.supabase.co' || !key?.startsWith('sb_publishable_') || !secret || process.env.PORTAL_ALLOW_DEMO_SEED!=='yes') {
  throw new Error('Configure only the dedicated demo project and opt in to test fixtures');
}
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const credentials=JSON.parse(await readFile('work/demo-credentials.json','utf8')) as {email:string;password:string}[];
assert.equal(credentials.length,2);
const students:{client:PortalClient;api:ReturnType<typeof createTuitionApi>;baseline:TuitionCharge[];id:string;token:string}[]=[];
const fixtures=[randomUUID(),randomUUID()];
let checks=0;
let passed=false;
const ok=(value:unknown)=>{assert.ok(value);checks++;};
async function rest(path:string,token:string|null,method='GET',body?:unknown) {
  const response=await fetch(url+path,{method,headers:{apikey:key!,...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{}),Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json()};
}
await writeFile('work/tuition-live-results.json',JSON.stringify({passed:false,checks:0}));
try {
  for(const credential of credentials) {
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.auth.signInWithPassword(credential);
    if(error)throw error;
    ok(!!data.user && !!data.session);
    const api=createTuitionApi(client);
    const baseline=await api.charges();
    ok(baseline.length>0 && baseline.every(row=>row.student_id===data.user!.id && row.demo_only));
    students.push({client,api,baseline,id:data.user!.id,token:data.session!.access_token});
  }
  // Use only temporary invoices created by this test. The six demo invoices
  // and their balances/history remain available for the presentation.
  const insert=await admin.from('tuition_charges').insert(students.map((s,i)=>({
    id:fixtures[i],student_id:s.id,title:'Автоматическая проверка демо',
    contract_number:'ТЕСТ',amount_kopecks:12345+i,due_on:'2026-12-15',
  })));
  if(insert.error)throw insert.error;
  for(const [i,s] of students.entries()) {
    const other=students[1-i];
    const cross=await rest(`/rest/v1/tuition_charges?student_id=eq.${other.id}&select=*`,s.token);
    ok(cross.status===200 && cross.body.length===0);
    const anon=await rest('/rest/v1/tuition_charges?select=*',null);
    ok([401,403].includes(anon.status));
    for(const id of [fixtures[1-i],randomUUID()]) {
      const result=await rest('/rest/v1/rpc/complete_demo_tuition_payment',s.token,'POST',{charge_id:id});
      ok(result.status===403 && result.body.code==='42501');
    }
    const anonymous=await rest('/rest/v1/rpc/complete_demo_tuition_payment',null,'POST',{charge_id:fixtures[i]});
    ok([401,403].includes(anonymous.status));
    for(const body of [{amount_kopecks:1},{paid_at:new Date().toISOString()},{student_id:other.id},{payment_reference:'forged'},{demo_only:false}]) {
      const result=await rest(`/rest/v1/tuition_charges?id=eq.${fixtures[i]}`,s.token,'PATCH',body);
      ok(result.status===403);
    }
    const beforeOther=await other.api.charges();
    const [one,two]=await Promise.all([s.api.payDemo(fixtures[i]),s.api.payDemo(fixtures[i])]);
    ok(one.payment_reference===two.payment_reference && one.paid_at===two.paid_at);
    ok(one.student_id===s.id && one.amount_kopecks===12345+i && one.demo_only);
    const again=await s.api.payDemo(fixtures[i]);
    ok(again.payment_reference===one.payment_reference && again.paid_at===one.paid_at);
    assert.deepEqual(await other.api.charges(),beforeOther); checks++;
    const forged=await rest('/rest/v1/tuition_charges',s.token,'POST',{student_id:s.id,title:'Подмена',contract_number:'x',amount_kopecks:1,due_on:'2026-12-15'});
    ok(forged.status===403);
    await s.client.auth.signOut();
    const relogin=await s.client.auth.signInWithPassword(credentials[i]);
    if(relogin.error)throw relogin.error;
    ok((await s.api.charges()).some(row=>row.id===fixtures[i] && row.payment_reference===one.payment_reference));
  }
  passed=true;
} catch(error) {
  console.error('Tuition live verification failed:',error instanceof Error?error.name:'Error','after',checks,'checks');
  process.exitCode=1;
} finally {
  const cleanup=await admin.from('tuition_charges').delete().in('id',fixtures);
  if(cleanup.error) {passed=false;process.exitCode=1;console.error('Temporary tuition fixture cleanup failed');}
  for(const s of students) {
    if(passed) {
      try {assert.deepEqual(await s.api.charges(),s.baseline);checks++;}
      catch {passed=false;process.exitCode=1;console.error('Demo invoice baseline changed');}
    }
    await s.client.auth.signOut().catch(()=>{});
  }
  await writeFile('work/tuition-live-results.json',JSON.stringify({project:'jbzaqvutbybrhjctrexc',passed,checks,at:new Date().toISOString(),limitations:['Not a browser test','Temporary invoices only; seeded demonstration balances preserved']},null,2));
}
if(passed)console.log(`Tuition live Auth/REST: ${checks} checks passed; temporary invoices removed, demo balances preserved.`);
