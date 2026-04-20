import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "KNGO SEO <notifications@kangomedia.com>";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  if (!resend) {
    console.log(`[EMAIL] Resend not configured — would have sent to ${to}: "${subject}"`);
    return null;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[EMAIL] Send error:", error);
      return null;
    }

    console.log(`[EMAIL] Sent to ${to}: "${subject}" — id: ${data?.id}`);
    return data;
  } catch (err) {
    console.error("[EMAIL] Exception:", err);
    return null;
  }
}

// ─── Email Templates ────────────────────────────────────

export function discoveryCompleteEmail(
  clientName: string,
  domain: string | null,
  keywordsFound: number,
  clientId: string,
  baseUrl: string,
) {
  const subject = `✅ Discovery complete for ${clientName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f1117; color: #e4e4e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: rgba(16,185,129,0.15); border-radius: 12px; line-height: 48px; font-size: 24px;">✅</div>
      </div>
      
      <h1 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 8px;">Discovery Complete</h1>
      <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin: 0 0 24px;">
        ${clientName}${domain ? ` · ${domain}` : ""}
      </p>
      
      <div style="background: #1a1b23; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; gap: 16px; text-align: center;">
          <div style="flex: 1;">
            <div style="font-size: 28px; font-weight: 800; color: #7c3aed;">${keywordsFound}</div>
            <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Keywords Found</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">What's Ready</h3>
        <div style="font-size: 14px; line-height: 2;">
          ✅ Site audit crawl initiated<br>
          ✅ ${keywordsFound} keywords discovered from site + competitors<br>
          ✅ AI strategic analysis generated<br>
          ⏳ Review & track recommended keywords
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${baseUrl}/agency/clients/${clientId}" 
           style="display: inline-block; background: #7c3aed; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
          Review Keywords →
        </a>
      </div>
      
      <p style="font-size: 11px; color: #52525b; text-align: center; margin-top: 24px;">
        KNGO SEO Platform · KangoMedia
      </p>
    </div>
  `;
  return { subject, html };
}
