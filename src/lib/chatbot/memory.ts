import { getServiceClient } from "@/lib/supabase/service";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_HISTORY = 20;

export async function loadSession(sessionId: string): Promise<{
  messages: ChatMessage[];
  longTermMemory: string;
}> {
  const supabase = getServiceClient();

  const [{ data: session }, { data: memory }] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("messages")
      .eq("session_id", sessionId)
      .maybeSingle(),
    supabase
      .from("chat_memory")
      .select("key, value")
      .eq("session_id", sessionId),
  ]);

  const messages = ((session?.messages ?? []) as ChatMessage[]).slice(-MAX_HISTORY);
  const longTermMemory = (memory ?? [])
    .map((m: { key: string; value: string }) => `${m.key}: ${m.value}`)
    .join("\n");

  return { messages, longTermMemory };
}

export async function saveSession(
  sessionId: string,
  messages: ChatMessage[]
): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("chat_sessions").upsert(
    {
      session_id: sessionId,
      messages: messages.slice(-MAX_HISTORY),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
}

export async function saveLongTermMemory(
  sessionId: string,
  key: string,
  value: string
): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from("chat_memory")
    .upsert({ session_id: sessionId, key, value }, { onConflict: "session_id,key" });
}
