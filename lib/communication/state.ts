import "server-only";

import { randomUUID } from "node:crypto";
import type { Lock, QueueEntry, StateAdapter } from "chat";
import { createServiceClient } from "@/lib/supabase/service";

export class SupabaseChatState implements StateAdapter {
  async connect() {}
  async disconnect() {}

  async subscribe(threadId: string) {
    const service = createServiceClient();
    const { error } = await service
      .from("communication_chat_subscriptions")
      .upsert({ thread_id: threadId }, { onConflict: "thread_id" });
    if (error) throw error;
  }

  async unsubscribe(threadId: string) {
    const { error } = await createServiceClient()
      .from("communication_chat_subscriptions")
      .delete()
      .eq("thread_id", threadId);
    if (error) throw error;
  }

  async isSubscribed(threadId: string) {
    const { data, error } = await createServiceClient()
      .from("communication_chat_subscriptions")
      .select("thread_id")
      .eq("thread_id", threadId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async acquireLock(threadId: string, ttlMs: number) {
    const token = randomUUID();
    const expiresAt = Date.now() + ttlMs;
    const { data, error } = await createServiceClient().rpc(
      "communication_acquire_lock",
      {
        target_thread_id: threadId,
        target_token: token,
        target_expires_at: new Date(expiresAt).toISOString(),
      },
    );
    if (error) throw error;
    return data ? ({ threadId, token, expiresAt } satisfies Lock) : null;
  }

  async releaseLock(lock: Lock) {
    const { error } = await createServiceClient().rpc(
      "communication_release_lock",
      { target_thread_id: lock.threadId, target_token: lock.token },
    );
    if (error) throw error;
  }

  async forceReleaseLock(threadId: string) {
    const { error } = await createServiceClient()
      .from("communication_chat_locks")
      .delete()
      .eq("thread_id", threadId);
    if (error) throw error;
  }

  async extendLock(lock: Lock, ttlMs: number) {
    const expiresAt = Date.now() + ttlMs;
    const { data, error } = await createServiceClient().rpc(
      "communication_extend_lock",
      {
        target_thread_id: lock.threadId,
        target_token: lock.token,
        target_expires_at: new Date(expiresAt).toISOString(),
      },
    );
    if (error) throw error;
    if (data) lock.expiresAt = expiresAt;
    return Boolean(data);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const service = createServiceClient();
    const { data, error } = await service
      .from("communication_chat_state")
      .select("value,expires_at")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      await service.from("communication_chat_state").delete().eq("key", key);
      return null;
    }
    return data.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number) {
    const { error } = await createServiceClient()
      .from("communication_chat_state")
      .upsert(
        {
          key,
          value,
          expires_at: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) throw error;
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number) {
    const { data, error } = await createServiceClient().rpc(
      "communication_state_set_if_absent",
      {
        target_key: key,
        target_value: value,
        target_expires_at: ttlMs
          ? new Date(Date.now() + ttlMs).toISOString()
          : null,
      },
    );
    if (error) throw error;
    return Boolean(data);
  }

  async delete(key: string) {
    const { error } = await createServiceClient()
      .from("communication_chat_state")
      .delete()
      .eq("key", key);
    if (error) throw error;
  }

  async appendToList(
    key: string,
    value: unknown,
    options?: { maxLength?: number; ttlMs?: number },
  ) {
    const current = await this.get<unknown[]>(key);
    const next = [...(current ?? []), value].slice(
      -(options?.maxLength ?? 100),
    );
    await this.set(key, next, options?.ttlMs);
  }

  async getList<T = unknown>(key: string) {
    return (await this.get<T[]>(key)) ?? [];
  }

  async enqueue(threadId: string, entry: QueueEntry, maxSize: number) {
    const service = createServiceClient();
    const { data } = await service
      .from("communication_chat_queues")
      .select("entries")
      .eq("thread_id", threadId)
      .maybeSingle();
    const entries = [...((data?.entries as QueueEntry[] | null) ?? []), entry]
      .filter((item) => item.expiresAt > Date.now())
      .slice(-maxSize);
    const { error } = await service
      .from("communication_chat_queues")
      .upsert(
        { thread_id: threadId, entries, updated_at: new Date().toISOString() },
        { onConflict: "thread_id" },
      );
    if (error) throw error;
    return entries.length;
  }

  async dequeue(threadId: string) {
    const service = createServiceClient();
    const { data } = await service
      .from("communication_chat_queues")
      .select("entries")
      .eq("thread_id", threadId)
      .maybeSingle();
    const entries = ((data?.entries as QueueEntry[] | null) ?? []).filter(
      (item) => item.expiresAt > Date.now(),
    );
    const next = entries.shift() ?? null;
    await service
      .from("communication_chat_queues")
      .upsert(
        { thread_id: threadId, entries, updated_at: new Date().toISOString() },
        { onConflict: "thread_id" },
      );
    return next;
  }

  async queueDepth(threadId: string) {
    const { data } = await createServiceClient()
      .from("communication_chat_queues")
      .select("entries")
      .eq("thread_id", threadId)
      .maybeSingle();
    return ((data?.entries as QueueEntry[] | null) ?? []).filter(
      (item) => item.expiresAt > Date.now(),
    ).length;
  }
}
