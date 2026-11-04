import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in ignored .env');
if (process.env.PORTAL_ALLOW_DEMO_SEED !== 'yes') throw new Error('Set PORTAL_ALLOW_DEMO_SEED=yes only for a dedicated demo project');
const admin = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const credentials: {email:string;password:string}[]=[];
for (const [i,label] of ['a','b'].entries()) {
 const email=`student-${label}@example.test`;
 const password=randomBytes(24).toString('base64url');
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(error) throw new Error(`Cannot create demo user ${label}: ${error.code ?? 'unknown'}. Existing users are not overwritten.`);
 const id=data.user.id;
 credentials.push({email,password});
 // Save immediately: a partial failure must not lose the newly generated password.
 await mkdir('work',{recursive:true});
 await writeFile('work/demo-credentials.json',JSON.stringify(credentials,null,2),{mode:0o600});
 const profile=await admin.from('profiles').insert({student_id:id,full_name:`Тестовый Студент ${label.toUpperCase()}`,faculty:'Учебный факультет',program:i?'Экономика':'Информатика',course:i+1,group_name:`ДЕМО-${label.toUpperCase()}`});
 if(profile.error) throw profile.error;
 const start=new Date(); start.setUTCHours(9+i*2,0,0,0);
 const seed=[
  admin.from('schedule_entries').insert({student_id:id,subject:i?'Микроэкономика':'Алгоритмы',starts_at:start.toISOString(),ends_at:new Date(+start+5400000).toISOString(),room:`Демо-${101+i}`,teacher:`Вымышленный Преподаватель ${label.toUpperCase()}`,change_note:i?null:'Перенос в новую аудиторию'}),
  admin.from('grades').insert({student_id:id,subject:i?'Микроэкономика':'Алгоритмы',assessment:'exam',result:i?'4':'5',semester:1,exam_at:new Date(+start+86400000*7).toISOString()}),
  admin.from('notifications').insert({student_id:id,title:'Демонстрационные данные',body:'Это конкурсный концепт, не официальный сервис.'}),
 ];
 for(const result of await Promise.all(seed)) if(result.error) throw result.error;
}
console.log('Created two fictional students. Credentials saved only to ignored work/demo-credentials.json.');
