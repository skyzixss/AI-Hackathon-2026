import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createDemoData} from '../../../scripts/demo-data.ts';
import {demoTuition} from '../../features/payments/backend/demo-data.ts';

export const root = fileURLToPath(new URL('../../../', import.meta.url));
export const out = resolve(process.env.UI_SCREENSHOT_DIR || resolve(root,'work/session-browser-check'));
export const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const users=ids.map((id,i)=>({id,aud:'authenticated',role:'authenticated',email:`student-${i?'b':'a'}@example.test`,app_metadata:{},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}));
const demo=ids.map((id,i)=>createDemoData(id,i,new Date('2026-11-06T09:00:00Z')));
export const findings=[];
export async function createHarness(chromium) {
  await mkdir(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ru-RU',reducedMotion:'reduce'});
  const page=await context.newPage();
  const control={mode:'success',ttl:120,refreshCalls:0,passwordCalls:0,restCalls:0,errors:[]};
  page.on('pageerror',e=>control.errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-06T09:00:00Z')});
  const token=(i,now)=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:ids[i],exp:Math.floor(now/1000)+control.ttl,aud:'authenticated',role:'authenticated'})).toString('base64url'),'fictional-test-signature'].join('.');
  await context.route('http://127.0.0.1:54331/**',async route=>{
    const req=route.request();const url=new URL(req.url());const data=req.postDataJSON()??{};
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*','content-type':'application/json'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    let i=0;try{i=ids.indexOf(JSON.parse(Buffer.from((req.headers().authorization??'').split('.')[1],'base64url')).sub);if(i<0)i=0;}catch{}
    let status=200,body=[];
    if(url.pathname.endsWith('/token')){
      const refresh=url.searchParams.get('grant_type')==='refresh_token';
      if(refresh)control.refreshCalls++;else control.passwordCalls++;
      i=(data.email?.includes('student-b')||data.refresh_token?.endsWith('-b'))?1:0;
      if(refresh&&control.mode==='hard'){status=400;body={code:'refresh_token_not_found',msg:'Invalid Refresh Token: Refresh Token Not Found'};}
      else if(refresh&&control.mode==='retryable'){status=503;body={message:'Isolated fixture unavailable'};}
      else{const now=await page.evaluate(()=>Date.now());body={access_token:token(i,now),token_type:'bearer',refresh_token:'fictional-session-'+(i?'b':'a'),expires_in:control.ttl,user:users[i]};}
    } else if(url.pathname.endsWith('/logout'))return route.fulfill({status:204,headers});
    else if(url.pathname.endsWith('/user'))body=users[i];
    else {
      control.restCalls++;
      if(url.pathname.endsWith('/profiles'))body={student_id:ids[i],full_name:i?'Демо Студент Бета':'Демо Студент Альфа',faculty:'Вымышленный факультет',program:i?'Экономика':'Информатика',course:i?3:2,group_name:i?'ДЕМО-Б':'ДЕМО-А'};
      else if(url.pathname.endsWith('/schedule_entries'))body=demo[i].schedule;
      else if(url.pathname.endsWith('/grades'))body=demo[i].grades;
      else if(url.pathname.endsWith('/requests'))body=demo[i].requests;
      else if(url.pathname.endsWith('/notifications'))body=demo[i].notifications;
      else if(url.pathname.endsWith('/tuition_charges'))body=demoTuition(ids[i],i);
    }
    await route.fulfill({status,headers,body:JSON.stringify(body)});
  });
  const base=process.env.UI_BASE_URL || 'http://127.0.0.1:5174';
  if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Use a local Vite fixture build only');
  await page.goto(base+'/#home');
  await page.getByRole('button',{name:'Войти в кабинет',exact:true}).waitFor();
  const screenshot=async name=>{const file=resolve(out,name+'.png');await page.screenshot({path:file,fullPage:true,animations:'disabled'});return file;};
  const login=async(i=0)=>{await page.getByLabel('Электронная почта',{exact:true}).fill(users[i].email);await page.getByLabel('Пароль',{exact:true}).fill('fictional-test-password');await page.getByRole('button',{name:'Войти в кабинет',exact:true}).click();await page.getByRole('link',{name:'Мой профиль',exact:true}).first().waitFor();};
  const note=(check,result,detail={})=>{findings.push({check,result,...detail});};
  const save=async()=>writeFile(resolve(out,'results.json'),JSON.stringify({base:'d363c03524fc14fb11d874cb169393387b0e068f',appSha256:createHash('sha256').update((await readFile(resolve(root,'src/app/App.tsx'),'utf8')).replace(/\r\n/g,'\n')).digest('hex'),chrome:browser.version(),environment:'Actual React + Supabase SDK against isolated HTTP fixtures; controlled clock; no cloud credentials or writes',findings,counts:{refreshCalls:control.refreshCalls,passwordCalls:control.passwordCalls},pageErrors:control.errors},null,2)+'\n');
  return {browser,context,page,control,screenshot,login,note,save};
}
