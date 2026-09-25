import { roleInvitePhrase } from "./rbac.ts";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Invite email copy. Role value stays `employee`; the sentence uses roleInvitePhrase. */
export function buildInvitationEmail(args: { orgName: string; role: string; link: string }): {
  subject: string;
  html: string;
} {
  const orgName = args.orgName.trim() || "your organization";
  const phrase = roleInvitePhrase(args.role);
  const subject = `You're invited to join ${orgName} on Provider Interface`;
  const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#243040">
        <p>Hello,</p>
        <p>You've been invited to join <strong>${escapeHtml(orgName)}</strong> as ${escapeHtml(phrase)}.</p>
        <p style="margin:28px 0">
          <a href="${args.link}"
             style="display:inline-block;background:#c9a227;color:#243040;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
            Accept invitation
          </a>
        </p>
        <p style="color:#666;font-size:12px">If the button doesn't work, copy and paste this link into your browser:<br/>
          <span style="word-break:break-all">${args.link}</span>
        </p>
        <p style="color:#666;font-size:12px;margin-top:24px">This invitation link expires in 14 days.</p>
      </div>
    `;
  return { subject, html };
}
