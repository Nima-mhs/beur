import { NextRequest, NextResponse } from "next/server";
import { ingestDocument, reindexDocument } from "@/lib/chatbot/ingestion";
import { getServiceClient } from "@/lib/supabase/service";

// Admin-only ingestion endpoint.
// Verifies the caller is an admin via service-role DB check.

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;

  try {
    const sb = getServiceClient();
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return false;

    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return profile?.role === "admin";
  } catch {
    return false;
  }
}

// POST /api/chatbot/ingest — ingest a new document
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, sourceType, content, sourceUrl, tags } = body;

    if (!title || !sourceType) {
      return NextResponse.json({ error: "title and sourceType are required" }, { status: 400 });
    }

    if (sourceType !== "url" && !content) {
      return NextResponse.json({ error: "content is required for non-URL sources" }, { status: 400 });
    }

    const documentId = await ingestDocument({ title, sourceType, content, sourceUrl, tags });
    return NextResponse.json({ success: true, documentId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ingestion failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/chatbot/ingest — re-index existing document
export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { documentId } = await req.json();
    if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

    await reindexDocument(documentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "reindex failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/chatbot/ingest — delete document + its chunks
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { documentId } = await req.json();
    if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

    const sb = getServiceClient();
    await sb.from("documents").delete().eq("id", documentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
