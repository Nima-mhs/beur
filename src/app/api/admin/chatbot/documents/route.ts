import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { getServiceClient } from "@/lib/supabase/service";
import { ingestDocument, reindexDocument } from "@/lib/chatbot/ingestion";

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("documents")
    .select("id, title, source_type, source_url, status, tags, chunk_count, error_msg, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { action, documentId, title, sourceType, content, sourceUrl, tags } = body;

    if (action === "reindex" && documentId) {
      await reindexDocument(documentId);
      return NextResponse.json({ success: true });
    }

    if (!title || !sourceType) {
      return NextResponse.json({ error: "title and sourceType required" }, { status: 400 });
    }

    const id = await ingestDocument({ title, sourceType, content, sourceUrl, tags });
    return NextResponse.json({ success: true, documentId: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId } = await req.json();
  const sb = getServiceClient();
  await sb.from("documents").delete().eq("id", documentId);
  return NextResponse.json({ success: true });
}
