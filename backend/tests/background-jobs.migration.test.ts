import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  'supabase/migrations/20260619120000_create_background_job_queues.sql',
);

describe('background job queue migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates durable PGMQ source and dead-letter queues', () => {
    expect(sql).toContain('create extension if not exists pgmq');
    expect(sql).toContain("pgmq.create('background_jobs')");
    expect(sql).toContain("pgmq.create('background_jobs_dead_letter')");
    expect(sql).not.toContain('create_unlogged');
  });

  it('uses fixed-name security-definer RPC functions', () => {
    expect(sql).toContain('public.enqueue_background_job');
    expect(sql).toContain('public.read_background_jobs');
    expect(sql).toContain('public.delete_background_job');
    expect(sql).toContain('public.extend_background_job_visibility');
    expect(sql).toContain('public.dead_letter_background_job');
    expect(sql).toContain('public.purge_background_job_dead_letters');
    expect(sql.match(/security definer/g)).toHaveLength(6);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(6);
  });

  it('enforces job size and supports visibility renewal', () => {
    expect(sql).toContain('octet_length(p_job::text) > 16384');
    expect(sql).toContain('pgmq.set_vt(');
  });

  it('atomically sends dead letters before deleting their source messages', () => {
    const sendIndex = sql.indexOf("pgmq.send(\n    'background_jobs_dead_letter'");
    const deleteIndex = sql.indexOf("pgmq.delete('background_jobs', p_msg_id)", sendIndex);

    expect(sendIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(sendIndex);
    expect(sql).toContain("'payloadSha256'");
    expect(sql).not.toContain("'job', v_message");
  });

  it('purges expired dead letters in concurrent-safe bounded batches', () => {
    expect(sql).toContain('queued.enqueued_at < p_before');
    expect(sql).toContain('limit p_limit');
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain("pgmq.delete('background_jobs_dead_letter', v_message_ids)");
  });

  it('grants queue RPC access only to the service role', () => {
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql.match(/to service_role/g)).toHaveLength(6);
    expect(sql).not.toContain('pgmq_public');
  });
});
