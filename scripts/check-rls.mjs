import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { checkTuition } from './check-tuition.mjs';
if (!process.env.TEST_PG_SOCKET) throw new Error('Run through npm run test:db, not against an existing database');
const config={host:process.env.TEST_PG_SOCKET,port:Number(process.env.TEST_PG_PORT),user:'postgres',database:'postgres'};
const db=new pg.Client(config);
await db.connect();
let count=0;
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
async function as(role,uid,sql,params=[]) {
 await db.query('begin');
 try {
  await db.query(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);
  return await db.query(sql,params);
 } finally { await db.query('rollback'); }
}
async function denied(role,uid,sql,params=[]) {
 await assert.rejects(as(role,uid,sql,params),{code:'42501'}); count++;
}
try {
 // Auth issuer is stubbed here; this suite verifies real PostgreSQL RLS and grants,
 // not GoTrue password hashing or PostgREST JWT verification.
 await db.query(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.query(await readFile(`supabase/migrations/${file}`,'utf8'));
 for(const id of [A,B]) {
  await db.query('insert into auth.users values ($1)',[id]);
  await db.query("insert into public.profiles values ($1,'Демо','Демо','Демо',1,'ДЕМО')",[id]);
  await db.query("insert into public.schedule_entries(student_id,subject,starts_at,ends_at,room,teacher) values ($1,'Демо',now(),now()+interval '1 hour','101','Демо')",[id]);
  await db.query("insert into public.grades(student_id,subject,assessment,result,semester) values ($1,'Демо','exam','5',1)",[id]);
  await db.query("insert into public.requests(student_id,kind,body) values ($1,'certificate','Демо')",[id]);
 }
 for(const [own,other] of [[A,B],[B,A]]) {
  for(const table of ['profiles','schedule_entries','grades','requests','notifications']) {
   assert.equal((await as('authenticated',own,`select * from public.${table} where student_id=$1`,[other])).rowCount,0); count++;
   assert.equal((await as('authenticated',own,`select * from public.${table} where student_id=$1`,[own])).rowCount,1); count++;
   await denied('anon',null,`select * from public.${table}`);
   assert.equal((await as('authenticated',null,`select * from public.${table}`)).rowCount,0); count++;
  }
  const result=await as('authenticated',own,"insert into public.requests(kind,body) values ('certificate','Новая') returning *");
  assert.equal(result.rows[0].student_id,own); assert.equal(result.rows[0].status,'submitted'); count++;
  await denied('authenticated',own,"insert into public.requests(student_id,kind,body) values ($1,'certificate','Подмена')",[other]);
  await denied('authenticated',own,"insert into public.requests(kind,body,status) values ('certificate','Подмена','ready')");
  await denied('authenticated',own,"update public.requests set status='ready'");
  await denied('authenticated',own,"update public.requests set student_id=$1",[other]);
  await denied('authenticated',own,"delete from public.requests");
  await denied('authenticated',own,"update public.profiles set full_name='Подмена'");
  await denied('authenticated',own,"update public.grades set result='5'");
  await denied('authenticated',own,"update public.notifications set student_id=$1",[other]);
  await denied('authenticated',own,"insert into public.notifications(student_id,title,body) values ($1,'Подмена','Подмена')",[other]);
  const notification=(await db.query('select id from public.notifications where student_id=$1',[other])).rows[0];
  assert.equal((await as('authenticated',own,'update public.notifications set read_at=now() where id=$1 returning *',[notification.id])).rowCount,0); count++;
  const mine=(await db.query('select id from public.notifications where student_id=$1',[own])).rows[0];
  assert.equal((await as('authenticated',own,'update public.notifications set read_at=now() where id=$1 returning *',[mine.id])).rowCount,1); count++;
  // Actual insert+trigger is atomic, notification is private to the creator.
  await db.query('begin');
  await db.query('set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[own]);
  await db.query("insert into public.requests(kind,body) values ('application','Новая')");
  assert.equal((await db.query('select * from public.notifications')).rowCount,2); count++;
  await db.query('rollback');
 }
 console.log(`PostgreSQL RLS: ${count} checks passed (A→B, B→A, anonymous, owner/status forgery, private notifications).`);
 await checkTuition(db, config);
} finally {await db.end();}
