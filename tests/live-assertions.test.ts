import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRevokedRefresh, newRequestNotifications } from '../scripts/live-assertions.ts';
import type { Notification } from '../src/api/portal.ts';
const notice=(id:string,student_id='A',title='Заявка принята'): Notification => ({id,student_id,title,body:'demo',created_at:'2026-11-04T00:00:00Z',read_at:null});
test('old request notifications cannot pass a new-request check',()=>{
 assert.deepEqual(newRequestNotifications(new Set(['old']),[notice('old')],'A'),[]);
 assert.deepEqual(newRequestNotifications(new Set(['old']),[notice('old'),notice('new','B'),notice('news','A','Новость')],'A'),[]);
 assert.deepEqual(newRequestNotifications(new Set(['old']),[notice('old'),notice('new')],'A').map(n=>n.id),['new']);
});
test('only expected missing-session responses prove revocation',()=>{
 for(const code of ['refresh_token_not_found','session_not_found']) {
  assert.equal(isRevokedRefresh(400,{code}),true);
  assert.equal(isRevokedRefresh(400,{code:400,error_code:code}),true);
 }
 for(const status of [200,401,403,429,500,502,503]) assert.equal(isRevokedRefresh(status,{code:'refresh_token_not_found'}),false);
 for(const body of [null,{},'error',{code:400},{code:400,error_code:'over_request_rate_limit'},{code:'over_request_rate_limit'},{code:'unexpected_failure'},{code:'invalid_credentials'},{code:'refresh_token_already_used'}]) assert.equal(isRevokedRefresh(400,body),false);
});
