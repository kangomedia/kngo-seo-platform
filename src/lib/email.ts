import Mailgun from "mailgun.js";
import FormData from "form-data";

const mailgun = new Mailgun(FormData);

const mg = process.env.MAILGUN_API_KEY
  ? mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
    })
  : null;

const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || "";
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || "KNGO SEO <notifications@kangomedia.com>";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  if (!mg || !MAILGUN_DOMAIN) {
    console.log(`[EMAIL] Mailgun not configured — would have sent to ${to}: "${subject}"`);
    return null;
  }

  try {
    const result = await mg.messages.create(MAILGUN_DOMAIN, {
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    console.log(`[EMAIL] Sent to ${to}: "${subject}" — id: ${result.id}`);
    return { id: result.id };
  } catch (err) {
    console.error("[EMAIL] Send error:", err);
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

export function planApprovalEmail(
  clientName: string,
  planTitle: string,
  pieceCount: number,
  reviewUrl: string,
) {
  const subject = `📋 Content plan ready for your review — ${clientName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f1117; color: #e4e4e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: rgba(124,58,237,0.15); border-radius: 12px; line-height: 48px; font-size: 24px;">📋</div>
      </div>
      
      <h1 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 8px;">Content Plan Ready</h1>
      <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin: 0 0 24px;">
        ${clientName} · ${planTitle}
      </p>
      
      <div style="background: #1a1b23; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; gap: 16px; text-align: center;">
          <div style="flex: 1;">
            <div style="font-size: 28px; font-weight: 800; color: #7c3aed;">${pieceCount}</div>
            <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Content Pieces</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">What To Do</h3>
        <div style="font-size: 14px; line-height: 2;">
          1. Review each content topic and description<br>
          2. Approve topics you'd like us to write<br>
          3. Reject or request changes on any that don't fit<br>
          4. We'll start drafting once you approve
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${reviewUrl}" 
           style="display: inline-block; background: #7c3aed; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
          Review Content Plan →
        </a>
      </div>
      
      <p style="font-size: 11px; color: #52525b; text-align: center; margin-top: 24px;">
        KNGO SEO Platform · KangoMedia
      </p>
    </div>
  `;
  return { subject, html };
}

export function contentReviewEmail(
  clientName: string,
  pieceCount: number,
  reviewUrl: string,
) {
  const subject = `✍️ ${pieceCount} content draft${pieceCount !== 1 ? "s" : ""} ready for review — ${clientName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f1117; color: #e4e4e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: rgba(16,185,129,0.15); border-radius: 12px; line-height: 48px; font-size: 24px;">✍️</div>
      </div>
      
      <h1 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 8px;">Content Drafts Ready</h1>
      <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin: 0 0 24px;">
        ${clientName}
      </p>
      
      <div style="background: #1a1b23; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; gap: 16px; text-align: center;">
          <div style="flex: 1;">
            <div style="font-size: 28px; font-weight: 800; color: #10b981;">${pieceCount}</div>
            <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Drafts For Review</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">What To Do</h3>
        <div style="font-size: 14px; line-height: 2;">
          1. Read each content draft carefully<br>
          2. Approve drafts that are ready to publish<br>
          3. Request revisions with specific feedback<br>
          4. Approved drafts will be scheduled for publishing
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${reviewUrl}" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
          Review Drafts →
        </a>
      </div>
      
      <p style="font-size: 11px; color: #52525b; text-align: center; margin-top: 24px;">
        KNGO SEO Platform · KangoMedia
      </p>
    </div>
  `;
  return { subject, html };
}

export function auditCompleteEmail(
  clientName: string,
  domain: string | null,
  pageCount: number,
  healthScore: number | null,
  clientId: string,
  auditId: string,
  baseUrl: string,
) {
  const subject = `🔍 Site audit complete for ${clientName}`;
  const scoreDisplay = healthScore !== null ? Math.round(healthScore) : "—";
  const scoreColor = healthScore === null ? "#a1a1aa" : healthScore >= 80 ? "#10b981" : healthScore >= 50 ? "#f59e0b" : "#ef4444";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f1117; color: #e4e4e7; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: rgba(99,102,241,0.15); border-radius: 12px; line-height: 48px; font-size: 24px;">🔍</div>
      </div>
      
      <h1 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0 0 8px;">Site Audit Complete</h1>
      <p style="font-size: 14px; color: #a1a1aa; text-align: center; margin: 0 0 24px;">
        ${clientName}${domain ? ` · ${domain}` : ""}
      </p>
      
      <div style="background: #1a1b23; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; gap: 16px; text-align: center;">
          <div style="flex: 1;">
            <div style="font-size: 36px; font-weight: 800; color: ${scoreColor};">${scoreDisplay}</div>
            <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Health Score</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 36px; font-weight: 800; color: #6366f1;">${pageCount}</div>
            <div style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Pages Analyzed</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">What's Ready</h3>
        <div style="font-size: 14px; line-height: 2;">
          ✅ Full site crawl completed<br>
          ✅ ${pageCount} pages analyzed for SEO issues<br>
          ✅ On-page checks categorized by severity<br>
          ⏳ Generate AI recommendations for each page
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${baseUrl}/agency/clients/${clientId}/audit" 
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
          View Audit Results →
        </a>
      </div>
      
      <p style="font-size: 11px; color: #52525b; text-align: center; margin-top: 24px;">
        KNGO SEO Platform · KangoMedia
      </p>
    </div>
  `;
  return { subject, html };
}
