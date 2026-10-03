import type { NextFunction, Request, Response } from 'express';
import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { db, doc, getDoc, setDoc } from './db';

const USER_COLLECTION = 'users';
const DEFAULT_USER_ID = 'default-user';
const SESSION_COOKIE = 'system_builder_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 210_000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_BLOCK_MS = 5 * 60 * 1000;
const failedLogins = new Map<string, { count: number; blockedUntil: number }>();

type UserProfile = {
  userId: string;
  name: string;
  userName: string;
  password: string;
  IsLoginRequired: number | boolean;
};

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const digest = pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    32,
    'sha256'
  ).toString('hex');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${digest}`;
}

function verifyPassword(
  password: string,
  stored: string
): { valid: boolean; needsUpgrade: boolean } {
  if (stored.startsWith('pbkdf2$')) {
    const [, iterationsRaw, salt, expected] = stored.split('$');
    const iterations = Number(iterationsRaw);
    if (!iterations || !salt || !expected) {
      return { valid: false, needsUpgrade: false };
    }
    const actual = pbkdf2Sync(
      password,
      salt,
      iterations,
      32,
      'sha256'
    ).toString('hex');
    return {
      valid: constantTimeEqual(actual, expected),
      needsUpgrade: iterations < PBKDF2_ITERATIONS,
    };
  }

  if (stored.startsWith('sha256:')) {
    return {
      valid: constantTimeEqual(sha256(password), stored.slice('sha256:'.length)),
      needsUpgrade: true,
    };
  }

  // Compatibility for older/imported user rows. A successful login upgrades it.
  return {
    valid: constantTimeEqual(password, stored),
    needsUpgrade: true,
  };
}

function parseCookies(req: Request): Record<string, string> {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        if (separator < 0) return [part, ''];
        return [
          decodeURIComponent(part.slice(0, separator)),
          decodeURIComponent(part.slice(separator + 1)),
        ];
      })
  );
}

function sessionSigningKey(profile: UserProfile): Buffer {
  const configuredSecret = String(
    process.env.SYSTEM_BUILDER_SESSION_SECRET || ''
  ).trim();
  const baseSecret = configuredSecret || profile.password;

  return createHmac('sha256', baseSecret)
    .update(
      `system-builder-session:v1:${profile.userId}:${profile.password}`
    )
    .digest();
}

function signSession(profile: UserProfile): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${profile.userId}.${expiresAt}`;
  const signature = createHmac('sha256', sessionSigningKey(profile))
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function verifySessionToken(token: string, profile: UserProfile): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [userId, expiresRaw, providedSignature] = parts;
  if (userId !== profile.userId || userId !== DEFAULT_USER_ID) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000) {
    return false;
  }

  const payload = `${userId}.${expiresAt}`;
  const expectedSignature = createHmac('sha256', sessionSigningKey(profile))
    .update(payload)
    .digest('base64url');
  return constantTimeEqual(providedSignature, expectedSignature);
}

function hasValidSession(req: Request, profile: UserProfile): boolean {
  const token = parseCookies(req)[SESSION_COOKIE] || '';
  return Boolean(token && verifySessionToken(token, profile));
}

function loginRequired(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.IsLoginRequired === true ||
    Number(profile.IsLoginRequired) === 1
  );
}

async function readProfile(): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, USER_COLLECTION, DEFAULT_USER_ID));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    userId: String(data.userId || DEFAULT_USER_ID),
    name: String(data.name || ''),
    userName: String(data.userName || ''),
    password: String(data.password || ''),
    IsLoginRequired: data.IsLoginRequired ?? 0,
  };
}

function setSessionCookie(res: Response, profile: UserProfile): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(
      signSession(profile)
    )}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`
  );
}

function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
  );
}

export const authInternalsForTests = {
  hashPassword,
  verifyPassword,
  signSession,
  verifySessionToken,
};

export function registerAuthRoutes(app: import('express').Express): void {
  app.get('/api/auth/status', async (req, res) => {
    try {
      const profile = await readProfile();
      const required = loginRequired(profile);
      const authenticated = !required || Boolean(profile && hasValidSession(req, profile));
      return res.json({
        loginRequired: required,
        authenticated,
        userName: authenticated ? profile?.userName || '' : '',
        profileReady: Boolean(profile),
      });
    } catch (error) {
      console.error('Auth status failed:', error);
      return res.status(500).json({ error: 'Unable to check login status.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const clientKey = String(req.ip || req.socket.remoteAddress || 'unknown');
      const attempt = failedLogins.get(clientKey);
      if (attempt && attempt.blockedUntil > Date.now()) {
        const retryAfterSeconds = Math.ceil((attempt.blockedUntil - Date.now()) / 1000);
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          error: 'Too many failed attempts. Try again in a few minutes.',
        });
      }

      const profile = await readProfile();
      if (!profile) {
        return res.status(503).json({
          error: 'User profile is not ready yet. Reload the app once.',
        });
      }

      if (!loginRequired(profile)) {
        setSessionCookie(res, profile);
        return res.json({ success: true, userName: profile.userName });
      }

      const userName = String(req.body?.userName || '').trim();
      const password = String(req.body?.password || '');
      const passwordCheck = verifyPassword(password, profile.password);

      if (
        !constantTimeEqual(userName, profile.userName) ||
        !passwordCheck.valid
      ) {
        const previous = failedLogins.get(clientKey);
        const nextCount = (previous?.count || 0) + 1;
        failedLogins.set(clientKey, {
          count: nextCount,
          blockedUntil:
            nextCount >= LOGIN_FAILURE_LIMIT ? Date.now() + LOGIN_BLOCK_MS : 0,
        });
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      failedLogins.delete(clientKey);

      let sessionProfile = profile;
      if (passwordCheck.needsUpgrade) {
        const upgradedPassword = hashPassword(password);
        await setDoc(
          doc(db, USER_COLLECTION, DEFAULT_USER_ID),
          { password: upgradedPassword },
          { merge: true }
        );
        sessionProfile = { ...profile, password: upgradedPassword };
      }

      setSessionCookie(res, sessionProfile);
      return res.json({ success: true, userName: profile.userName });
    } catch (error) {
      console.error('Login failed:', error);
      return res.status(500).json({ error: 'Unable to sign in.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ success: true });
  });

  app.post('/api/auth/credentials', async (req, res) => {
    try {
      const profile = await readProfile();
      if (!profile) {
        return res.status(404).json({ error: 'Default user was not found.' });
      }

      if (loginRequired(profile) && !hasValidSession(req, profile)) {
        return res.status(401).json({ error: 'Sign in again to update account settings.' });
      }

      const currentPassword = String(req.body?.currentPassword || '');
      const currentCheck = verifyPassword(currentPassword, profile.password);
      if (!currentCheck.valid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const nextUserName = String(req.body?.userName || profile.userName).trim();
      const nextPassword = String(req.body?.newPassword || '');

      if (nextUserName.length < 2 || nextUserName.length > 64) {
        return res.status(400).json({ error: 'Username must be 2 to 64 characters.' });
      }
      if (nextPassword && nextPassword.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters.' });
      }

      const update: Record<string, unknown> = {
        userName: nextUserName,
      };
      let sessionPassword = profile.password;
      if (nextPassword) {
        sessionPassword = hashPassword(nextPassword);
        update.password = sessionPassword;
      } else if (currentCheck.needsUpgrade) {
        sessionPassword = hashPassword(currentPassword);
        update.password = sessionPassword;
      }

      await setDoc(
        doc(db, USER_COLLECTION, DEFAULT_USER_ID),
        update,
        { merge: true }
      );

      setSessionCookie(res, {
        ...profile,
        userName: nextUserName,
        password: sessionPassword,
      });
      return res.json({ success: true, userName: nextUserName });
    } catch (error) {
      console.error('Credential update failed:', error);
      return res.status(500).json({ error: 'Unable to update account settings.' });
    }
  });
}

export async function requireAppSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const profile = await readProfile();
    if (!loginRequired(profile) || Boolean(profile && hasValidSession(req, profile))) {
      return next();
    }
    return res.status(401).json({ error: 'Authentication required.' });
  } catch (error) {
    console.error('Session verification failed:', error);
    return res.status(500).json({ error: 'Unable to verify session.' });
  }
}
