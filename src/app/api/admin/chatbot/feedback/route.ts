import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  const rating = req.nextUrl.searchParams.get("rating");
  const limit  = Number(req.nextUrl.searchParams.get("limit") ?? "50");

  let query = sb
    .from("feedback")
    .select("*, messages(content, model_used, conversation_id)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rating) query = query.eq("rating", Number(rating));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data ?? [] });
}

// Accept feedback from the chat widget/page (no admin auth needed)
export async function POST(req: NextRequest) {
  try {
    const { message_id, conversation_id, rating, comment } = await req.json();

    if (rating !== 1 && rating !== -1) {
      return NextResponse.json({ error: "rating must be 1 or -1" }, { status: 400 });
    }

    const sb = getServiceClient();
    await sb.from("feedback").upsert(
      { message_id, conversation_id, rating, comment },
      { onConflict: "message_id" }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
