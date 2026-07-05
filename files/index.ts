// supabase/functions/send-push/index.ts
// Edge Function بتبعت Web Push حقيقي (خارج الموقع) للمستخدمين
// بتستقبل: { user_id, title, body, url }  →  لعضو واحد
//        أو: { all: true, title, body, url }  →  لكل الأعضاء

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, all, title, body, url } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title مطلوب" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let query = supabase.from("push_subscriptions").select("*");
    if (!all) {
      if (!user_id) return new Response(JSON.stringify({ error: "user_id مطلوب" }), { status: 400, headers: corsHeaders });
      query = query.eq("user_id", user_id);
    }

    const { data: subs, error } = await query;
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: "مفيش اشتراكات push لهذا المستخدم" }), { headers: corsHeaders });
    }

    const payload = JSON.stringify({ title, body: body || "", url: url || "./" });
    const expiredEndpoints: string[] = [];

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        ).catch((err) => {
          // 404/410 يعني الاشتراك ده مبقاش موجود (المستخدم شال الإذن أو الموقع من متصفحه)
          if (err.statusCode === 404 || err.statusCode === 410) expiredEndpoints.push(s.endpoint);
          throw err;
        })
      )
    );

    // تنضيف الاشتراكات المنتهية من قاعدة البيانات
    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ sent, failed, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});