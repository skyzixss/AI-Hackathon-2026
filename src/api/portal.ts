import type { PortalClient } from '../lib/supabase.ts';
export interface Profile { student_id: string; full_name: string; faculty: string; program: string; course: number; group_name: string }
export interface Lesson { id: string; student_id: string; subject: string; starts_at: string; ends_at: string; room: string; teacher: string; change_note: string | null }
export interface Grade { id: string; student_id: string; subject: string; assessment: 'exam'|'credit'|'coursework'; result: string; semester: number; exam_at: string | null }
export interface StudentRequest { id: string; student_id: string; kind: 'certificate'|'application'; body: string; status: 'submitted'|'in_review'|'ready'|'rejected'; created_at: string }
export interface Notification { id: string; student_id: string; title: string; body: string; created_at: string; read_at: string | null }

// Every query is protected by database RLS, including direct REST requests.
export function portalApi(client: PortalClient) {
  return {
    async signIn(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    async signOut() { const { error } = await client.auth.signOut(); if (error) throw error; },
    async profile() { const { data } = await client.from('profiles').select('*').single<Profile>().throwOnError(); return data!; },
    async schedule(from: string, to: string) {
      const { data } = await client.from('schedule_entries').select('*').gte('starts_at',from).lt('starts_at',to).order('starts_at').returns<Lesson[]>().throwOnError(); return data ?? [];
    },
    async grades() { const { data } = await client.from('grades').select('*').order('semester').returns<Grade[]>().throwOnError(); return data ?? []; },
    async requests() { const { data } = await client.from('requests').select('*').order('created_at',{ascending:false}).returns<StudentRequest[]>().throwOnError(); return data ?? []; },
    async createRequest(kind: StudentRequest['kind'], body: string) {
      if (!['certificate','application'].includes(kind) || !body.trim() || body.trim().length > 2000) throw new Error('Invalid request');
      const { data } = await client.from('requests').insert({kind,body:body.trim()}).select('*').single<StudentRequest>().throwOnError(); return data!;
    },
    async notifications() { const { data } = await client.from('notifications').select('*').order('created_at',{ascending:false}).returns<Notification[]>().throwOnError(); return data ?? []; },
    async markRead(id: string) {
      const { data } = await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).select('*').single<Notification>().throwOnError(); return data!;
    },
  };
}
