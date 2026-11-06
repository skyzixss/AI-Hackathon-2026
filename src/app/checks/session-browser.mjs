// Real React/SDK, fictional HTTP responses. Local Vite only; never cloud Auth.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHarness,findings} from './session-fixtures.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const a=await createHarness(chromium);
const check=(name,value)=>{a.note(name,value);assert.ok(value,name);};
try{
 await a.login(0);
 await a.page.getByText('Демо Студент Альфа',{exact:true}).first().waitFor();
 const refresh=()=>a.page.evaluate(async()=>{
   const {connection}=await import('/src/app/client.ts');
   const result=await connection.client.auth.refreshSession();
   return {ok:!result.error,status:result.error?.status};
 });
 check('Healthy refresh succeeds',(await refresh()).ok);
 a.control.mode='hard';
 check('Proactive 400 preserves still-valid access',(await refresh()).status===400&&await a.page.locator('.portal-layout').count()===1);
 await a.page.clock.fastForward(130000);
 await a.page.getByRole('button',{name:'Войти в кабинет',exact:true}).waitFor({timeout:15000});
 check('Expired terminal failure removes private screens',await a.page.locator('.portal-layout').count()===0);
 check('Expired terminal failure removes SDK session',await a.page.evaluate(()=>!Object.keys(localStorage).some(k=>k.endsWith('-auth-token'))));
 a.control.mode='success';await a.login(1);
 await a.page.getByText('Демо Студент Бета',{exact:true}).first().waitFor();
 check('B after expired A sees only B',!(await a.page.getByRole('main').innerText()).includes('Альфа'));
 a.control.mode='retryable';
 const outage=a.page.waitForResponse(r=>r.url().includes('/token')&&r.status()===503);
 await a.page.clock.fastForward(130000);await outage;
 const heading=a.page.getByRole('heading',{name:'Не удалось обновить сессию',exact:true});
 await heading.waitFor();
 check('Expired 503 hides private screens',await a.page.locator('.portal-layout').count()===0);
 check('Expired warning receives keyboard focus',await heading.evaluate(e=>e===document.activeElement));
 check('Expired warning offers recovery',await a.page.getByRole('button',{name:'Попробовать снова',exact:true}).isVisible());
 a.control.ttl=3600;a.control.mode='success';
 const recovered=a.page.waitForResponse(r=>r.url().includes('/token')&&r.status()===200);
 await a.page.clock.fastForward(65000);await recovered;
 await a.page.getByText('Демо Студент Бета',{exact:true}).first().waitFor();
 check('Recovery restores B without A',!(await a.page.getByRole('main').innerText()).includes('Альфа'));
 await a.page.clock.fastForward(100000);
 check('Old deadline does not invalidate renewed access',await a.page.locator('.portal-layout').count()===1);
 console.log(`${findings.length} real browser/SDK session checks passed (isolated HTTP fixtures).`);
}finally{await a.save();await a.browser.close();}
