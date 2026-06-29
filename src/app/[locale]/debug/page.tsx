"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DebugPage() {
  const [info, setInfo] = useState<Record<string, unknown>>({ loading: true });
  const supabase = createClient();

  useEffect(() => {
    async function run() {
      const { data: userData } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!userData.user) {
        setInfo({ status: "NOT LOGGED IN", user: null });
        return;
      }

      const token = sessionData.session?.access_token ?? "";
      const [meRes, debugRes] = await Promise.all([
        fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/debug-me", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const meJson = await meRes.json();
      const debugJson = await debugRes.json();

      setInfo({
        status: "LOGGED IN",
        userId: userData.user.id,
        email: userData.user.email,
        hasToken: !!token,
        tokenLength: token.length,
        apiMeResponse: meJson,
        isAdmin: meJson.role === "admin",
        debugMe: debugJson,
      });
    }
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ fontFamily: "monospace", padding: 32, direction: "ltr" }}>
      <h1 style={{ marginBottom: 16 }}>Admin Debug Info</h1>
      <pre style={{ background: "#f0f0f0", padding: 16, borderRadius: 8, fontSize: 14, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(info, null, 2)}
      </pre>
    </div>
  );
}
