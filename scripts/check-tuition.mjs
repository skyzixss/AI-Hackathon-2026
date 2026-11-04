import pg from 'pg';
import assert from 'node:assert/strict';

// Called only by check-rls.mjs in the same disposable database after all
// migrations and fictional A/B profiles are created. No hosted credentials.
export async function checkTuition(db, config) {
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';
  const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];
  async function as(client, role, uid, sql, values = []) {
    await client.query('begin');
    try {
      await client.query(`set local role ${role}`);
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [uid || '']);
      const result = await client.query(sql, values);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
  for (const [index, student] of [A, B].entries()) {
    await db.query("insert into public.tuition_charges(id,student_id,title,contract_number,amount_kopecks,due_on) values ($1,$2,'Демо','ДЕМО',4500000,'2026-11-15')", [ids[index], student]);
  }
  for (const [mine, other, invoice] of [[A, B, ids[0]], [B, A, ids[1]]]) {
    assert.equal((await as(db, 'authenticated', mine, 'select * from public.tuition_charges where student_id=$1', [other])).rowCount, 0);
    assert.equal((await as(db, 'authenticated', mine, 'select * from public.tuition_charges')).rowCount, 1);
    const foreign = mine === A ? ids[1] : ids[0];
    for (const id of [foreign, '99999999-9999-4999-8999-999999999999', null]) {
      await assert.rejects(as(db, 'authenticated', mine, 'select * from public.complete_demo_tuition_payment($1)', [id]), {code: '42501'});
    }
    for (const sql of [
      'update public.tuition_charges set amount_kopecks=1',
      'update public.tuition_charges set paid_at=now()',
      "update public.tuition_charges set payment_reference='forged'",
      `update public.tuition_charges set student_id='${other}'`,
      'update public.tuition_charges set demo_only=false',
      'delete from public.tuition_charges',
      "insert into public.tuition_charges(student_id,title,contract_number,amount_kopecks,due_on) values (auth.uid(),'x','x',1,current_date)",
    ]) await assert.rejects(as(db, 'authenticated', mine, sql), {code: '42501'});
    await assert.rejects(as(db, 'anon', null, 'select * from public.tuition_charges'), {code: '42501'});
    await assert.rejects(as(db, 'anon', null, 'select * from public.complete_demo_tuition_payment($1)', [invoice]), {code: '42501'});
    await assert.rejects(as(db, 'authenticated', null, 'select * from public.complete_demo_tuition_payment($1)', [invoice]), {code: '42501'});
    assert.equal((await as(db, 'authenticated', null, 'select * from public.tuition_charges')).rowCount, 0);
  }
  const second = new pg.Client(config);
  await second.connect();
  try {
    const [one, two] = await Promise.all([
      as(db, 'authenticated', A, 'select * from public.complete_demo_tuition_payment($1)', [ids[0]]),
      as(second, 'authenticated', A, 'select * from public.complete_demo_tuition_payment($1)', [ids[0]]),
    ]);
    assert.deepEqual(one.rows, two.rows);
    assert.equal(one.rows[0].student_id, A);
    assert.equal(one.rows[0].amount_kopecks, 4500000);
    assert.ok(one.rows[0].paid_at);
    assert.match(one.rows[0].payment_reference, /^DEMO-/);
    const again = await as(db, 'authenticated', A, 'select * from public.complete_demo_tuition_payment($1)', [ids[0]]);
    assert.deepEqual(again.rows, one.rows);
    assert.equal((await db.query('select paid_at from public.tuition_charges where student_id=$1', [B])).rows[0].paid_at, null);
    console.log('Tuition PostgreSQL: ownership, forgery, anonymous access and concurrent idempotent demo payment passed.');
  } finally { await second.end(); }
}
