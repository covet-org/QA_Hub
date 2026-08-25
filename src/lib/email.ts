import "server-only";

/**
 * Outbound email via Resend (https://resend.com — free tier is plenty).
 * Without RESEND_API_KEY the message is logged to the server console so
 * the flow stays testable in development.
 *
 * EMAIL_FROM must be a verified sender in Resend (their onboarding
 * address works out of the box for sending to your own account email).
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "QA Hub <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(
      `[email:not-configured] would send to ${options.to}: "${options.subject}"\n${options.html}`,
    );
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`Email send failed: ${res.status} ${await res.text()}`);
    return { sent: false };
  }
  return { sent: true };
}
