// supabase/functions/send-push/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(
  "mailto:mo7amedhossam86@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const { user_id, all, title, body, url } = await req.json();

    let query = supabase.from("push_subscriptions").select("*");
    if (!all) {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id or all is required" }), { status: 400 });
      }
      query = query.eq("user_id", user_id);
    }

    const { data: subs, error } = await query;
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "no subscriptions" }), { status: 200 });
    }

    const payload = JSON.stringify({ title: title || "TAM+", body: body || "", url: url || "/" });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    );

    const deadEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const statusCode = r.reason?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          deadEndpoints.push(subs[i].endpoint);
        }
      }
    });
    if (deadEndpoints.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
