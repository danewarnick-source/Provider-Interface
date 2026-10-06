import { levelInvitePhrase } from "./access/levels.ts";
import { PROVIDER_INTERFACE_ORIGIN } from "./auth-redirect.ts";

/** @2x of the 30px header mark. Footer uses the same file at 22px. */
export const INVITE_EMAIL_LOGO_URL = `${PROVIDER_INTERFACE_ORIGIN}/email/pi-mark.png`;

const BG = "#0a0f1c";
const CARD = "#0f182b";
const BORDER = "#1f2b44";
const TEXT = "#f4efe3";
const MUTED = "#aeb7c9";
const FINE = "#7a8599";
const GOLD = "#c4a35a";
const GOLD_LIGHT = "#d9c284";
const SERIF = "'Iowan Old Style','Palatino Linotype','Book Antiqua',Georgia,serif";
const SANS = "Inter,Arial,'Segoe UI',sans-serif";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanLabel(raw: string, fallback: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  return text || fallback;
}

export function inviteEmailInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase();
}

function logoTable(size: number): string {
  const wordSize = size >= 28 ? 11 : 10;
  const piSize = size >= 28 ? 13 : 12;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:11px;vertical-align:middle;">
          <img src="${INVITE_EMAIL_LOGO_URL}" width="${size}" height="${size}" alt="Provider Interface" style="display:block;border:0;outline:none;text-decoration:none;width:${size}px;height:${size}px;">
        </td>
        <td style="vertical-align:middle;font-family:${SANS};">
          <div style="font-size:${piSize}px;font-weight:700;letter-spacing:.22em;color:${TEXT};line-height:1;">PI</div>
          <div style="font-size:${wordSize}px;font-weight:400;letter-spacing:.2em;color:${FINE};line-height:1;margin-top:4px;text-transform:uppercase;">Provider Interface</div>
        </td>
      </tr>
    </table>`;
}

function acceptButton(link: string): string {
  const href = escapeHtml(link);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>
        <td align="center" bgcolor="${GOLD}" style="border-radius:14px;background-color:${GOLD};background-image:linear-gradient(180deg,${GOLD_LIGHT},${GOLD});">
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1.2;color:${BG};text-decoration:none;border-radius:14px;">Accept invitation</a>
        </td>
      </tr>
    </table>`;
}

function featureBlock(kicker: string, title: string, body: string): string {
  return `
    <tr>
      <td class="px" style="padding:26px 40px 0 40px;border-top:1px solid ${BORDER};">
        <div style="font-family:${SANS};font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};">${kicker}</div>
        <div class="feature-title" style="font-family:${SERIF};font-size:24px;line-height:1.2;color:${TEXT};margin:6px 0 8px;letter-spacing:-.3px;">${title}</div>
        <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${MUTED};">${body}</p>
      </td>
    </tr>`;
}

function stepRow(n: string, title: string, detail: string, when: string, gold: boolean): string {
  const pillBg = gold ? "#2e2716" : "#1b2740";
  const pillColor = gold ? GOLD_LIGHT : FINE;
  return `
    <tr>
      <td class="px" style="padding:0 40px 10px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:12px;">
          <tr>
            <td width="34" valign="middle" style="padding:14px 0 14px 16px;font-family:${SERIF};font-size:20px;line-height:1;color:${GOLD};width:34px;">${n}</td>
            <td valign="middle" style="padding:14px 8px;font-family:${SANS};">
              <div style="font-size:14px;font-weight:600;color:${TEXT};line-height:1.3;">${title}</div>
              <div style="font-size:13px;color:${MUTED};line-height:1.4;">${detail}</div>
            </td>
            <td align="right" valign="middle" style="padding:14px 16px 14px 8px;white-space:nowrap;">
              <span style="display:inline-block;padding:3px 9px;border-radius:999px;background-color:${pillBg};font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.02em;color:${pillColor};">${when}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export type InvitationEmail = { subject: string; html: string; text: string };

/** Centered-card invite. Access level stays stored; the sentence uses levelInvitePhrase. */
export function buildInvitationEmail(args: {
  orgName: string;
  role: string;
  link: string;
  inviterName: string;
}): InvitationEmail {
  const orgName = cleanLabel(args.orgName, "your organization");
  const inviterName = cleanLabel(args.inviterName, "A teammate");
  const phrase = levelInvitePhrase(args.role);
  const link = args.link.trim();
  const subject = `${inviterName} invited you to join ${orgName}`;
  const initials = inviteEmailInitials(inviterName);
  const safeOrg = escapeHtml(orgName);
  const safeInviter = escapeHtml(inviterName);
  const safePhrase = escapeHtml(phrase);
  const safeLink = escapeHtml(link);
  const safeInitials = escapeHtml(initials);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin:0; padding:0; background:${BG}; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; }
  a { color:${MUTED}; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; max-width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .hero-pad { padding:24px 20px 32px 20px !important; }
    .headline { font-size:32px !important; }
    .invite-card { width:100% !important; max-width:100% !important; }
    .feature-title { font-size:22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${safeInviter} invited you to join ${safeOrg} as ${safePhrase}.&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background-color:${BG};">
  <tr>
    <td align="center" style="padding:0;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="width:600px;max-width:600px;background-color:${BG};">
        <tr>
          <td class="hero-pad px" align="center" bgcolor="${BG}" style="padding:26px 40px 44px 40px;background-color:${BG};background-image:radial-gradient(420px 260px at 50% 30%,rgba(196,163,90,.10),transparent 70%),radial-gradient(700px 460px at 50% 0%,#132038 0%,${BG} 65%);">
            ${logoTable(30)}
            <div style="height:40px;line-height:40px;font-size:40px;">&nbsp;</div>
            <div style="font-family:${SANS};font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};">Invitation</div>
            <div class="headline" style="font-family:${SERIF};font-size:38px;line-height:1.12;letter-spacing:-.8px;color:${TEXT};margin:12px 0;">One team.<br>Whole platform.</div>
            <div style="font-family:${SANS};font-size:16px;line-height:1.6;color:${MUTED};max-width:420px;margin:0 auto;">Your schedule, notes, credentials and trainings, in one place from the day you sign in.</div>
            <table role="presentation" class="invite-card" width="420" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${CARD}" style="width:420px;max-width:420px;margin-top:30px;background-color:${CARD};border:1px solid ${BORDER};border-radius:16px;">
              <tr>
                <td class="card-pad" align="center" style="padding:30px 32px 28px 32px;">
                  <div style="font-family:${SANS};font-size:14px;line-height:26px;color:${MUTED};">
                    <span style="display:inline-block;width:26px;height:26px;border-radius:13px;background-color:#1b2740;color:${TEXT};font-size:10px;font-weight:700;line-height:26px;text-align:center;vertical-align:middle;">${safeInitials}</span>
                    &nbsp;<b style="color:${TEXT};font-weight:700;">${safeInviter}</b> invited you to join
                  </div>
                  <div style="font-family:${SERIF};font-size:30px;line-height:1.15;color:${GOLD_LIGHT};letter-spacing:-.4px;margin:8px 0 6px;">${safeOrg}</div>
                  <div style="font-family:${SANS};font-size:13px;color:${FINE};margin-bottom:22px;">as ${safePhrase}</div>
                  ${acceptButton(link)}
                  <div style="font-family:${SANS};font-size:13px;color:${FINE};margin-top:14px;">Expires in 14 days &middot; About 5 minutes to set up</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${featureBlock("Schedule", "Your week, already on your phone.", "See every shift and client visit, and clock in right where the work happens.")}
        ${featureBlock("Notes", "Notes checked before you clock out.", "Nectar reviews your shift note on the spot, so it&#39;s done right the first time.")}
        ${featureBlock("Training", "Credentials in the room.", "CPR, First Aid and your trainings in one place, with a heads-up before anything expires.")}
        <tr>
          <td class="px" style="padding:34px 40px 6px 40px;border-top:1px solid ${BORDER};">
            <div style="font-family:${SANS};font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};margin-bottom:16px;">What happens next</div>
          </td>
        </tr>
        ${stepRow("1", "Accept the invitation", "Use the gold button above", "Now", true)}
        ${stepRow("2", "Set your password", "For your phone and computer", "Next", false)}
        ${stepRow("3", "Finish your profile", "Details and credentials", "Then", false)}
        <tr>
          <td class="px" style="padding:16px 40px 30px 40px;border-top:1px solid ${BORDER};font-family:${SANS};font-size:12px;line-height:1.7;color:${FINE};">
            ${logoTable(22)}
            <p style="margin:16px 0 0;">Button not working? Paste this link into your browser:<br>
              <a href="${safeLink}" target="_blank" style="color:${MUTED};word-break:break-all;text-decoration:underline;">${safeLink}</a>
            </p>
            <p style="margin:12px 0 0;">This invitation expires in 14 days. Didn&#39;t expect this? You can ignore it.</p>
            <p style="margin:12px 0 0;">Operations software for home and community-based services (HCBS) providers.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    `${inviterName} invited you to join ${orgName} as ${phrase}.`,
    "",
    "One team. Whole platform.",
    "Your schedule, notes, credentials and trainings, in one place from the day you sign in.",
    "",
    `Accept invitation: ${link}`,
    "",
    "Expires in 14 days. About 5 minutes to set up.",
    "",
    "Schedule. Your week, already on your phone.",
    "See every shift and client visit, and clock in right where the work happens.",
    "",
    "Notes. Notes checked before you clock out.",
    "Nectar reviews your shift note on the spot, so it's done right the first time.",
    "",
    "Training. Credentials in the room.",
    "CPR, First Aid and your trainings in one place, with a heads-up before anything expires.",
    "",
    "What happens next",
    "1. Accept the invitation (Now). Use the gold button above.",
    "2. Set your password (Next). For your phone and computer.",
    "3. Finish your profile (Then). Details and credentials.",
    "",
    "Button not working? Paste this link into your browser:",
    link,
    "",
    "This invitation expires in 14 days. Didn't expect this? You can ignore it.",
    "",
    "Operations software for home and community-based services (HCBS) providers.",
  ].join("\n");

  return { subject, html, text };
}
