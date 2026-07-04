// Central email sender. Uses SMTP when configured (Nodemailer), otherwise falls
// back to logging the message to the console so the app runs without credentials
// in development. sendMail() never throws into the request path — email is a
// side effect and must not break the operation that triggered it.
import nodemailer from 'nodemailer';

const {
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_NAME,
} = process.env;

export const APP = APP_NAME || 'WasteCoord Nairobi';
const FROM = SMTP_FROM || `${APP} <no-reply@wastecoord.ke>`;

let transport = null;
let mode = 'log';

if (SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  mode = 'smtp';
  console.log(`[mail] SMTP transport ready (${SMTP_HOST}:${Number(SMTP_PORT) || 587})`);
} else {
  console.log('[mail] SMTP_HOST not set — emails will be logged to the console (dev fallback).');
}

async function deliver({ to, subject, text, html }) {
  if (mode === 'smtp') {
    return transport.sendMail({ from: FROM, to, subject, text, html });
  }
  // Dev fallback: print the message so codes/links are usable without SMTP.
  console.log(`\n──────── EMAIL (dev fallback — not actually sent) ────────`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log((text || html || '').trim());
  console.log(`──────────────────────────────────────────────────────────\n`);
  return { dev: true };
}

/**
 * Send an email. Resolves even on failure (logs the error) so callers can
 * fire-and-forget without risking an unhandled rejection or a broken request.
 */
export async function sendMail(opts) {
  try {
    return await deliver(opts);
  } catch (err) {
    console.error(`[mail] failed to send "${opts.subject}" to ${opts.to}:`, err.message);
    return { error: err.message };
  }
}
