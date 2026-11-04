import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPortalClient } from '../src/lib/supabase.ts';
import { portalApi } from '../src/api/portal.ts';
test('browser client refuses privileged and missing keys',()=>{
 for(const key of ['', 'sb_secret_do-not-expose', 'service_role']) assert.throws(()=>createPortalClient('https://example.supabase.co',key));
});
test('invalid requests fail before any network access',async()=>{
 const client=createPortalClient('https://example.supabase.co','sb_publishable_fictional');
 const api=portalApi(client);
 await assert.rejects(api.createRequest('certificate',' '));
 await assert.rejects(api.createRequest('certificate','x'.repeat(2001)));
 await assert.rejects(api.createRequest('invalid' as 'certificate','test'));
});
