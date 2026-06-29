import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { getServiceClient } from "@/lib/supabase/service";
import { invalidateEmbeddingCache } from "@/lib/chatbot/embeddings";
import { invalidateBrainCache } from "@/lib/chatbot/brain";

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  const type = req.nextUrl.searchParams.get("type") ?? "all";

  const [embRes, modelRes] = await Promise.all([
    sb.from("embedding_config").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("model_config").select("*").order("channel"),
  ]);

  if (type === "embedding") return NextResponse.json({ embedding: embRes.data });
  if (type === "model")     return NextResponse.json({ models: modelRes.data ?? [] });

  return NextResponse.json({
    embedding: embRes.data,
    models:    modelRes.data ?? [],
  });
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  const body = await req.json();
  const { type, ...payload } = body;

  if (type === "embedding") {
    const { data, error } = await sb
      .from("embedding_config")
      .upsert({ ...payload, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateEmbeddingCache();
    return NextResponse.json({ success: true, data });
  }

  if (type === "model") {
    const { channel, ...rest } = payload;
    const { data, error } = await sb
      .from("model_config")
      .upsert({ channel, ...rest, updated_at: new Date().toISOString() }, { onConflict: "channel" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateBrainCache();
    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
