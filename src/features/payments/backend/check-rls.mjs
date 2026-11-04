// Prepared for #4: run ONLY in a new empty disposable PostgreSQL cluster.
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
if (!process.env.TEST_PG_SOCKET?.startsWith('/')) throw new Error('Use an isolated PostgreSQL Unix socket, never a hosted database');
const config = {host: process.env.TEST_PG_SOCKET, port: Number(process.env.TEST_PG_PORT || 55439), user: 'postgres', database: 'postgres'};
const db = new pg.Client(config); await db.connect();
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const ids = ['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'];
async function as(client, role, uid, sql, values = []) {
  await client.query('begin');
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [uid || '']);
    const result = await client.query(sql, values); await client.query('commit'); return result;
  } catch (error) { await client.query('rollback'); throw error; }
}
try {
  assert.equal((await db.query("select to_regclass('public.profiles') as existing")).rows[0].existing, null, 'Database must be empty');
  await db.query(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  await db.query(await readFile(new URL('../../../../supabase/migrations/20261104103450_portal_foundation.sql', import.meta.url), 'utf8'));
  await db.query(await readFile(new URL('./tuition.sql', import.meta.url), 'utf8'));
  for (const [index, student] of [A, B].entries()) {
    await db.query('insert into auth.users values ($1)', [student]);
    await db.query("insert into public.profiles values ($1,'Демо','Демо','Демо',1,'ДЕМО')", [student]);
    await db.query("insert into public.tuition_charges(id,student_id,title,contract_number,amount_kopecks,due_on) values ($1,$2,'Демо','ДЕМО',4500000,'2026-11-15')", [ids[index], student]);
  }
  for (const [mine, other, invoice] of [[A, B, ids[0]], [B, A, ids[1]]]) {
    assert.equal((await as(db, 'authenticated', mine, 'select * from public.tuition_charges where student_id=$1', [other])).rowCount, 0);
    assert.equal((await as(db, 'authenticated', mine, 'select * from public.tuition_charges')).rowCount, 1);
    const foreign = mine === A ? ids[1] : ids[0];
    for (const id of [foreign, '99999999-9999-4999-8999-999999999999'])
      await assert.rejects(as(db, 'authenticated', mine, 'select * from public.complete_demo_tuition_payment($1)', [id]), {code: '42501'});
    for (const sql of ["update public.tuition_charges set amount_kopecks=1", "update public.tuition_charges set paid_at=now()", 'delete from public.tuition_charges', "insert into public.tuition_charges(student_id,title,contract_number,amount_kopecks,due_on) values (auth.uid(),'x','x',1,current_date)"])
      await assert.rejects(as(db, 'authenticated', mine, sql), {code: '42501'});
    await assert.rejects(as(db, 'anon', null, 'select * from public.tuition_charges'), {code: '42501'});
    await assert.rejects(as(db, 'anon', null, 'select * from public.complete_demo_tuition_payment($1)', [invoice]), {code: '42501'});
    await assert.rejects(as(db, 'authenticated', null, 'select * from public.complete_demo_tuition_payment($1)', [invoice]), {code: '42501'});
    assert.equal((await as(db, 'authenticated', null, 'select * from public.tuition_charges')).rowCount, 0);
  }
  const second = new pg.Client(config); await second.connect();
  try {
    const [one, two] = await Promise.all([
      as(db, 'authenticated', A, 'select * from public.complete_demo_tuition_payment($1)', [ids[0]]),
      as(second, 'authenticated', A, 'select * from public.complete_demo_tuition_payment($1)', [ids[0]]),
    ]);
    assert.equal(one.rows[0].payment_reference, two.rows[0].payment_reference);
    assert.equal(one.rows[0].amount_kopecks, 4500000);
    assert.ok(one.rows[0].paid_at);
    const again = await as(db, 'authenticated', A, 'select * from public.complete_demo_tuition_payment($1)', [ids[0]]);
    assert.equal(again.rows[0].payment_reference, one.rows[0].payment_reference);
    assert.equal((await db.query('select * from public.tuition_charges where student_id=$1', [B])).rows[0].paid_at, null);
    console.log('Tuition RLS, direct forgery, anonymous access and concurrent idempotent demo payment passed.');
  } finally { await second.end(); }
} finally { await db.end(); }
