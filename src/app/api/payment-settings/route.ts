import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

// Reads no cookies/headers, so Next.js would otherwise treat this as a static
// route and cache the response at build time — admin edits would never show up.
export const dynamic = "force-dynamic";

// Public: booking page needs this to show payment instructions to any visitor,
// authenticated or not, before they've created an account.
export async function GET() {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("payment_settings")
    .select(
      "consultation_duration_min,consultation_price_irr,consultation_price_usd,irr_bank_name,irr_card_number,irr_account_holder,intl_card_brand,intl_card_number,intl_account_holder"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
