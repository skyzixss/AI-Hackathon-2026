import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { portalApi } from '../src/api/portal.ts';
import { isRevokedRefresh, newRequestNotifications } from './live-assertions.ts';

const url=process.env.SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(url!=='https://jbzaqvutbybrhjctrexc.supabase.co' || !key?.startsWith('sb_publishable_')) throw new Error('Configure the dedicated demo project and its publishable key');
const credentials=JSON.parse(await readFile('work/demo-credentials.json','utf8')) as {email:string;password:string}[];
assert.equal(credentials.length,2);
const students=[];
let checks=0;
const ok=(condition:unknown)=>{assert.ok(condition);checks++;};
async function rest(path:string, token:string|null, method='GET', body?:unknown){
 const response=await fetch(`${url}${path}`,{method,headers:{apikey:key!,...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{}),Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
 return {status:response.status,body:await response.json()};
}
try {
 await writeFile('work/live-auth-results.json',JSON.stringify({passed:false,checks:0,at:new Date().toISOString()}));
 const settings=await rest('/auth/v1/settings',null);
 ok(settings.status===200 && settings.body.disable_signup===true);
 for(const credential of credentials){
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const api=portalApi(client);
  const login=await api.signIn(credential.email,credential.password);
  ok(!!login.session && !!login.user);
  ok(login.session!.expires_in<=300);
  const profile=await api.profile();ok(profile.student_id===login.user.id);
  students.push({client,api,credential,id:login.user.id,token:login.session!.access_token});
 }
 ok(students[0].id!==students[1].id);
 for(const [i,s] of students.entries()){
  const other=students[1-i];
  for(const table of ['profiles','schedule_entries','grades','requests','notifications']){
   const cross=await rest(`/rest/v1/${table}?student_id=eq.${other.id}&select=*`,s.token);
   ok(cross.status===200 && Array.isArray(cross.body) && cross.body.length===0);
   const anon=await rest(`/rest/v1/${table}?select=*`,null);
   ok([401,403].includes(anon.status));
  }
  ok((await s.api.grades()).length>0);
  ok((await s.api.schedule('2026-01-01T00:00:00Z','2027-01-01T00:00:00Z')).length>0);
  const existingNoticeIds=new Set((await s.api.notifications()).map(n=>n.id));
  const request=await s.api.createRequest('certificate',`Проверка сохранения ${Date.now()}`);
  ok(request.student_id===s.id && request.status==='submitted');
  const readByOther=await rest(`/rest/v1/requests?id=eq.${request.id}&select=*`,other.token);
  ok(readByOther.status===200 && readByOther.body.length===0);
  const badOwner=await rest('/rest/v1/requests',s.token,'POST',{student_id:other.id,kind:'certificate',body:'Подмена'});
  ok([401,403].includes(badOwner.status));
  const badStatus=await rest(`/rest/v1/requests?id=eq.${request.id}`,s.token,'PATCH',{status:'ready'});
  ok([401,403].includes(badStatus.status));
  const notices=await s.api.notifications();
  const createdNotices=newRequestNotifications(existingNoticeIds,notices,s.id);
  ok(createdNotices.length===1);
  const ownNotice=createdNotices[0];ok((await s.api.markRead(ownNotice.id)).read_at!==null);
  const badRead=await rest(`/rest/v1/notifications?id=eq.${ownNotice.id}`,other.token,'PATCH',{read_at:new Date().toISOString()});
  ok(badRead.status===200 && badRead.body.length===0);
  // Establish that refresh works before sign-out; then test its current token.
  const renewed=await s.client.auth.refreshSession();
  if(renewed.error) throw renewed.error;
  ok(!!renewed.data.session?.refresh_token);
  const currentRefresh=renewed.data.session!.refresh_token;
  await s.api.signOut();ok((await s.client.auth.getSession()).data.session===null);
  const refresh=await rest('/auth/v1/token?grant_type=refresh_token',null,'POST',{refresh_token:currentRefresh});
  if(!isRevokedRefresh(refresh.status,refresh.body)) console.error('Refresh response diagnostic:',refresh.status,refresh.body?.error_code ?? refresh.body?.code ?? 'no_code');
  ok(isRevokedRefresh(refresh.status,refresh.body));
  await s.api.signIn(s.credential.email,s.credential.password);
  ok((await s.api.requests()).some(r=>r.id===request.id));
  await s.api.signOut();
 }
 const invalid=await rest('/rest/v1/profiles?select=*','invalid.jwt');ok(invalid.status===401);
 const report={project:'jbzaqvutbybrhjctrexc',checks,passed:true,at:new Date().toISOString(),limitations:['Not a browser test','Issued access JWT may remain valid until expiry; refresh revocation checked']};
 await writeFile('work/live-auth-results.json',JSON.stringify(report,null,2));
 console.log(`Live Auth/REST: ${checks} checks passed. No credentials printed.`);
} catch(error){
 await writeFile('work/live-auth-results.json',JSON.stringify({passed:false,checks,at:new Date().toISOString()}));
 console.error('Live verification failed:',error instanceof Error?error.name:'Error','after',checks,'checks');process.exitCode=1;
} finally {
 for(const s of students) await s.client.auth.signOut().catch(()=>{});
}
