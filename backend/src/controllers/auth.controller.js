// Handles user registration, login (with email-OTP 2FA), and current-user lookup.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as UserModel from '../models/user.model.js';
import * as ZoneModel from '../models/zone.model.js';
import * as ZoneCollectorModel from '../models/zoneCollector.model.js';
import * as LoginCodeModel from '../models/loginCode.model.js';
import * as Notifications from '../services/notifications.js';
import { sendMail, APP } from '../utils/mailer.js';

const SALT_ROUNDS = 12;

// Two-factor auth is on by default; set MFA_ENABLED=false for single-step login
// (used by the automated test suite, or to disable 2FA in an environment).
const MFA_ENABLED      = process.env.MFA_ENABLED !== 'false';
const OTP_TTL_MINUTES  = 10;
const MAX_OTP_ATTEMPTS = 5;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function generateCode() {
  // Cryptographically-random 6-digit code, zero-padded.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Creates a fresh login code for the user and emails it. */
async function issueLoginCode(user) {
  const code = generateCode();
  await LoginCodeModel.create(user.id, code, OTP_TTL_MINUTES);
  await sendMail({
    to: user.email,
    subject: `${APP} — your sign-in code`,
    text: `Your ${APP} verification code is ${code}\n\n`
        + `It expires in ${OTP_TTL_MINUTES} minutes. If you didn't try to sign in, you can ignore this email.`,
  });
}

export async function register(req, res) {
  const { name, email, password, zone_id, contact_phone, collector_id } = req.body;

  // zone_id shape is validated by registerRules; confirm it references a real zone
  // so we return a clean 400 rather than a raw foreign-key violation.
  const zone = await ZoneModel.findById(Number(zone_id));
  if (!zone) return res.status(400).json({ error: { message: 'Selected zone does not exist' } });

  // Collector choice — never trust a supplied id; it must be approved+active for
  // the selected zone (THE INVARIANT). When the resident doesn't choose one, we
  // AUTO-ASSIGN a collector serving that zone (default first, else any eligible).
  let chosenCollectorId;
  if (collector_id !== undefined && collector_id !== null && collector_id !== '') {
    const ok = await ZoneCollectorModel.isApprovedActive(Number(zone_id), Number(collector_id));
    if (!ok) return res.status(400).json({ error: { message: 'Chosen collector is not approved for the selected zone' } });
    chosenCollectorId = Number(collector_id);
  } else {
    chosenCollectorId = await ZoneCollectorModel.pickForZone(Number(zone_id));
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  // Role is always 'resident' for public registration — privilege escalation prevented here.
  // Officials are created by existing officials via POST /api/users/officials.
  // Collectors are created by officials via POST /api/collectors.
  // Duplicate email is caught by the DB unique constraint → 409 via error handler
  const user = await UserModel.create({
    name, email, password_hash, role: 'resident',
    zone_id: Number(zone_id),
    contact_phone,
    collector_id: chosenCollectorId,
  });

  // New account created in-person → issue the session directly (no OTP round-trip),
  // and welcome them by email. Subsequent sign-ins go through 2FA below.
  Notifications.registrationWelcome(user);
  const token = signToken(user);
  res.status(201).json({ token, user });
}

/**
 * Step 1 of login: verify email + password. With 2FA on, this does NOT return a
 * token — it emails a one-time code and asks the client to call /verify-otp.
 */
export async function login(req, res) {
  const { email, password } = req.body;
  const record = await UserModel.findByEmail(email);
  if (!record) {
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }
  const match = await bcrypt.compare(password, record.password_hash);
  if (!match) {
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }

  const user = UserModel.sanitizeUser(record);

  if (!MFA_ENABLED) {
    const token = signToken(user);
    return res.status(200).json({ token, user });
  }

  await issueLoginCode(user);
  return res.status(200).json({
    mfaRequired: true,
    email: user.email,
    message: 'A verification code has been sent to your email.',
  });
}

/**
 * Step 2 of login: verify the emailed one-time code and issue the session token.
 * Errors are intentionally generic to avoid revealing whether an email exists.
 */
export async function verifyOtp(req, res) {
  const { email, code } = req.body;
  const invalid = () => res.status(401).json({ error: { message: 'Invalid or expired code' } });

  const record = await UserModel.findByEmail(email);
  if (!record) return invalid();

  const active = await LoginCodeModel.findActive(record.id);
  if (!active) return invalid();

  if (active.attempts >= MAX_OTP_ATTEMPTS) {
    return res.status(429).json({ error: { message: 'Too many incorrect attempts. Request a new code.' } });
  }

  const submitted = LoginCodeModel.hashCode(code);
  const ok = submitted.length === active.code_hash.length &&
    crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(active.code_hash));

  if (!ok) {
    await LoginCodeModel.incrementAttempts(active.id);
    return invalid();
  }

  await LoginCodeModel.consume(active.id);
  const user = UserModel.sanitizeUser(record);
  const token = signToken(user);
  return res.status(200).json({ token, user });
}

/**
 * Re-send a login code. Always responds 200 (no user enumeration); only sends
 * when the account exists and 2FA is enabled.
 */
export async function resendOtp(req, res) {
  const { email } = req.body;
  const record = await UserModel.findByEmail(email);
  if (record && MFA_ENABLED) {
    await issueLoginCode(UserModel.sanitizeUser(record));
  }
  return res.status(200).json({ ok: true, message: 'If the account exists, a new code has been sent.' });
}

export async function me(req, res) {
  const user = await UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.status(200).json({ user });
}
