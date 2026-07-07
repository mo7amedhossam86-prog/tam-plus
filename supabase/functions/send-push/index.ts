import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const SENDER_EMAIL = "mo7amedhossam86@gmail.com"; // نفس الإيميل اللي وثقته في Brevo
const SENDER_NAME = "TAM+";

serve(async (req) => {
  try {
    const payload = await req.json();
    const email = payload?.user?.email;
    const token = payload?.email_data?.token;
    const actionType = payload?.email_data?.email_action_type;

    if (!email || !token) {
      return new Response(JSON.stringify({ error: "missing email or token" }), { status: 400 });
    }

    let subject = "كود التأكيد - TAM+";
    let title = "كود تأكيد التسجيل";
    if (actionType === "recovery") { subject = "كود استعادة كلمة المرور - TAM+"; title = "كود استعادة كلمة المرور"; }
    if (actionType === "email_change") { subject = "كود تأكيد تغيير الإيميل - TAM+"; title = "كود تأكيد تغيير الإيميل"; }

    const html = `
      <div style="font-family:sans-serif;text-align:center;padding:24px;direction:rtl">
        <h2>${title}</h2>
        <p>الكود بتاعك هو:</p>
        <h1 style="letter-spacing:8px;color:#111">${token}</h1>
        <p style="color:#666;font-size:13px">الكود صالح لمدة محدودة، متشاركوش مع حد.</p>
      </div>`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log("Brevo API error:", errText);
      return new Response(JSON.stringify({ error: errText }), { status: 500 });
    }

    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.log("send-email hook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});