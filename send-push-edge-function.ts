// ================================================================
//  Supabase Edge Function: send-push
//  ده كود سيرفر (مش بيتحط في index.html) — بيتنشر على Supabase نفسها
// ================================================================
//
// 🔧 خطوات التركيب:
//
// 1) لو أول مرة تستخدم Supabase Edge Functions محلياً، نصّب الـ CLI:
//    npm install -g supabase
//
// 2) من مجلد مشروعك في التيرمينال:
//    supabase login
//    supabase link --project-ref hdfxiqsgzttiulsjcrgb
//    supabase functions new send-push
//    (ده هيعمل مجلد supabase/functions/send-push/index.ts — الصق فيه الكود ده بدل اللي فيه)
//
// 3) لازم يكون عندك VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY (Public/Private pair).
//    المفتاح العام اللي عندك في index.html دلوقتي هو:
//    BLl0EmM7EouZ-dbEn03Rb0-LnXCoBCH1ZkOjiRBc8xnQkhKhQgRpH2fOS7ATMj6fktyzkIb4jZlNe1jyonVTmA8
//
//    لو معندكش المفتاح الخاص (Private) المطابق له، سيب حاجة كده وولّد زوج جديد بالكامل:
//    npx web-push generate-vapid-keys
//    وبعدين حدّث VAPID_PUBLIC_KEY في index.html بالمفتاح العام الجديد.
//
// 4) سجّل المفتاح الخاص كـ secret في Supabase (من نفس مجلد المشروع):
//    supabase secrets set VAPID_PUBLIC_KEY="المفتاح_العام_هنا"
//    supabase secrets set VAPID_PRIVATE_KEY="المفتاح_الخاص_هنا"
//
//    ملحوظة: SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY متوفرين تلقائياً
//    جوه أي Edge Function من غير ما تحطهم يدوياً.
//
// 5) انشر الفنكشن:
//    supabase functions deploy send-push
//
// 6) جرب من التيرمينال (اختياري للتأكد إنها شغالة):
//    curl -X POST 'https://hdfxiqsgzttiulsjcrgb.supabase.co/functions/v1/send-push' \
//      -H "Authorization: Bearer <anon-key>" \
//      -H "Content-Type: application/json" \
//      -d '{"all": true, "title": "تجربة", "body": "الإشعارات شغالة ✅", "url": "./"}'
//
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails(
  'mailto:admin@tamplus.app', // ممكن تغيّره لإيميلك
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// service role عشان يقدر يقرأ كل الاشتراكات بغض النظر عن RLS
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // CORS بسيط عشان لو حبيت تنده عليها من متصفح مباشرة
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { user_id, all, title, body, url } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: 'title مطلوب' }), { status: 400 });
    }

    let query = sb.from('push_subscriptions').select('*');
    if (!all) {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'لازم تبعت user_id أو all:true' }), { status: 400 });
      }
      query = query.eq('user_id', user_id);
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: body || '', url: url || './' });

    const results = await Promise.allSettled(
      (subs || []).map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
          .catch(async (err) => {
            // الاشتراك ملغي أو منتهي — امسحه من الداتابيز عشان منحاولش نبعتله تاني
            if (err.statusCode === 404 || err.statusCode === 410) {
              await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
            }
            throw err;
          })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return new Response(JSON.stringify({ sent, failed, total: results.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    console.error('send-push error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
