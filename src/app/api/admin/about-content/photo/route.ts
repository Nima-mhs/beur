import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "about-photos";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await getServiceClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

export async function POST(request: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "حجم فایل باید کمتر از ۸ مگابایت باشد" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "فقط فرمت JPG، PNG یا WebP مجاز است" }, { status: 400 });
  }

  const sb = getServiceClient();
  const path = `founder.${ext}`;
  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust: the storage path is fixed, so append a timestamp whenever it's replaced.
  const photoUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { data, error } = await sb
    .from("about_content")
    .update({ photo_url: photoUrl })
    .eq("id", 1)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ content: data });
}
