/**
 * Chatbot tools (function calling) in OpenAI-compatible format.
 * OpenRouter uses OpenAI API format for tool definitions.
 */

import { getServiceClient } from "@/lib/supabase/service";

// OpenAI-format tool definitions (works with all OpenRouter models that support tool use)
export const OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "capture_lead",
      description:
        "وقتی کاربر تمایل به مشاوره یا رزرو دارد و اطلاعات تماسی ارائه می‌دهد، این ابزار را فراخوانی کن تا اطلاعات در سیستم ذخیره شود و تیم با ایشان تماس بگیرد.",
      parameters: {
        type: "object",
        properties: {
          name:     { type: "string", description: "نام و نام خانوادگی" },
          phone:    { type: "string", description: "شماره موبایل" },
          email:    { type: "string", description: "آدرس ایمیل" },
          interest: { type: "string", description: "موضوع درخواست (مثلاً: مشاوره رنگ، رزرو جلسه)" },
          notes:    { type: "string", description: "یادداشت اضافی" },
        },
        required: ["interest"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_enrollment_status",
      description:
        "وضعیت رزرو یا ثبت‌نام کاربر را از پایگاه داده بررسی کن. کاربر باید ایمیل یا شماره تلفن خود را بدهد.",
      parameters: {
        type: "object",
        properties: {
          identifier: {
            type: "string",
            description: "ایمیل یا شماره تلفن کاربر برای جستجوی رزرو",
          },
        },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "handoff_to_human",
      description:
        "وقتی سوال کاملاً خارج از حوزه BEUR SEASON است یا کاربر به صراحت می‌خواهد با یک انسان صحبت کند، این ابزار را فراخوانی کن.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "دلیل درخواست انتقال به اپراتور انسانی",
          },
        },
        required: ["reason"],
      },
    },
  },
];

// Legacy Anthropic-format export (kept for backward compatibility)
export const TOOLS = OPENAI_TOOLS.map((t) => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters,
}));

// ─── Tool execution ────────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolInput: Record<string, string>,
  sessionId: string
): Promise<string> {
  const supabase = getServiceClient();

  if (toolName === "capture_lead") {
    const { error } = await supabase.from("chatbot_leads").insert({
      session_id: sessionId,
      name:     toolInput.name     ?? null,
      phone:    toolInput.phone    ?? null,
      email:    toolInput.email    ?? null,
      interest: toolInput.interest,
      notes:    toolInput.notes    ?? null,
      source:   "chatbot",
    });

    if (error) {
      console.error("Lead capture error:", error);
      return "error: could not save lead";
    }
    return "success: lead saved. Please thank the user and confirm that the BEUR SEASON team will contact them soon.";
  }

  if (toolName === "check_enrollment_status") {
    const id = toolInput.identifier?.trim();
    if (!id) return "error: identifier is required";

    const { data, error } = await supabase
      .from("bookings")
      .select("id, service, status, full_name, created_at, slot_id, time_slots(starts_at)")
      .or(`email.eq.${id},phone.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) return "error: database lookup failed";
    if (!data || data.length === 0) return `not_found: no booking found for "${id}"`;

    return data
      .map((b) => {
        const slotArr = b.time_slots;
        const slot = Array.isArray(slotArr) ? slotArr[0] : slotArr;
        const parts = [
          `رزرو #${String(b.id).slice(0, 8)}`,
          `خدمت: ${b.service}`,
          `وضعیت: ${b.status}`,
        ];
        if (slot?.starts_at) {
          parts.push(`زمان: ${new Date(slot.starts_at).toLocaleString("fa-IR")}`);
        }
        return parts.join(" | ");
      })
      .join("\n");
  }

  if (toolName === "handoff_to_human") {
    // Mark conversation as waiting for human in DB
    try {
      const sb = getServiceClient();
      await sb
        .from("conversations")
        .update({ status: "waiting_human" })
        .eq("session_id", sessionId);
    } catch {
      // non-critical
    }
    return "success: conversation marked for human handoff. Inform the user that an operator will be with them shortly.";
  }

  return "unknown tool";
}
