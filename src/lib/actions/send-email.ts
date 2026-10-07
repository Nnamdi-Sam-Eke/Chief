import { createServerFn } from "@tanstack/react-start";

/**
 * The only place a real email actually gets sent. Called exclusively from
 * the Drafts tab's explicit "Send" button (src/components/memory/memory-page.tsx)
 * — never automatically, regardless of policy.emailSend. Uses Resend's REST
 * API directly (same "fetch, no SDK" style as chat.ts/tts.ts/transcribe.ts).
 */
export const sendDraftedEmail = createServerFn({ method: "POST" })
  .validator((input: { to: string; subject: string; body: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return { ok: false as const, error: "Email sending isn't configured yet." };
    }
    if (!data.to?.trim()) {
      return { ok: false as const, error: "No recipient address." };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: data.to.trim(),
        subject: data.subject?.trim() || "(no subject)",
        text: data.body,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false as const, error: `Send failed (${res.status})`, detail: errText.slice(0, 240) };
    }

    return { ok: true as const };
  });
