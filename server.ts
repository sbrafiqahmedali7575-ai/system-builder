import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  verifyPrivilegedFirestoreAccess,
} from './server/db';
import { verifyConfirmationToken } from './server/tokenService';
import {
  getEmailProviderStatus,
  getAppBaseUrl,
  sendDailyConfirmationEmail,
  sanitizeError,
} from './server/emailService';
import {
  getNotificationSettings,
  saveNotificationSettings,
  findTodayTaskOrRecord,
  getKolkataTimeInfo,
  triggerDailyReminder,
  finalizeDayIfNoResponse,
  startBackgroundScheduler,
} from './server/scheduler';
import {
  fetchAllProjectData,
  generateAllCsvFiles,
} from './server/backupService';

const OWNER_SESSION_COOKIE = 'system_builder_owner';
const OWNER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const OWNER_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const OWNER_LOGIN_MAX_FAILURES = 5;

type OwnerLoginAttempt = {
  failures: number;
  resetAt: number;
};

const ownerLoginAttempts = new Map<string, OwnerLoginAttempt>();

function getOwnerAccessToken(): string {
  return (process.env.OWNER_ACCESS_TOKEN || '').trim();
}

function ownerAuthConfigured(): boolean {
  return getOwnerAccessToken().length >= 32;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return (
    left.length === right.length &&
    crypto.timingSafeEqual(left, right)
  );
}

function getCookieValue(req: express.Request, name: string): string {
  const cookieHeader = String(req.headers.cookie || '');
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return '';
}

const DAILY_REVIEW_CAPABILITY_COOKIE = 'system_builder_review_cap';
const TASK_CONFIRM_CAPABILITY_COOKIE = 'system_builder_confirm_cap';
const CAPABILITY_SESSION_SECONDS = 30 * 60;

function setCapabilityCookie(
  res: express.Response,
  name: string,
  token: string,
  routePath: string
): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${name}=${encodeURIComponent(
      token
    )}; Path=${routePath}; HttpOnly; SameSite=Lax; Max-Age=${CAPABILITY_SESSION_SECONDS}${secure}`
  );
}

function clearCapabilityCookie(
  res: express.Response,
  name: string,
  routePath: string
): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${name}=; Path=${routePath}; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}

function createOwnerSession(): string {
  const secret = getOwnerAccessToken();
  if (!ownerAuthConfigured()) {
    throw new Error('OWNER_ACCESS_TOKEN must be configured with at least 32 characters.');
  }

  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + OWNER_SESSION_TTL_MS,
      nonce: crypto.randomBytes(16).toString('hex'),
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function isValidOwnerSession(session: string): boolean {
  if (!ownerAuthConfigured() || !session) return false;

  const [payloadB64, signature, extra] = session.split('.');
  if (!payloadB64 || !signature || extra) return false;

  const expected = crypto
    .createHmac('sha256', getOwnerAccessToken())
    .update(payloadB64)
    .digest('base64url');

  if (!constantTimeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as { exp?: number };

    return Number.isFinite(payload.exp) && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function isOwnerAuthenticated(req: express.Request): boolean {
  if (!ownerAuthConfigured()) return false;

  const bearer = getBearerToken(req.headers.authorization);
  if (bearer && constantTimeEqual(bearer, getOwnerAccessToken())) {
    return true;
  }

  return isValidOwnerSession(getCookieValue(req, OWNER_SESSION_COOKIE));
}

function ownerAttemptKey(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function requireOwner(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  res.setHeader('Cache-Control', 'no-store');

  if (!ownerAuthConfigured()) {
    res.status(503).json({
      error:
        'Owner authentication is not configured. Set OWNER_ACCESS_TOKEN to a random value of at least 32 characters.',
    });
    return;
  }

  if (!isOwnerAuthenticated(req)) {
    res.status(401).json({ error: 'Owner authentication required.' });
    return;
  }

  next();
}

const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_OIDC_AUDIENCE = 'systembuilder08.ai.studio';
const GITHUB_REPOSITORY = 'sbrafiqahmedali7575-ai/system-builder';
const GITHUB_MAIN_REF = 'refs/heads/main';
const GITHUB_SCHEDULER_WORKFLOWS = new Set([
  `${GITHUB_REPOSITORY}/.github/workflows/daily-reminder.yml@${GITHUB_MAIN_REF}`,
  `${GITHUB_REPOSITORY}/.github/workflows/daily-finalize.yml@${GITHUB_MAIN_REF}`,
]);

type GithubOidcJwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
};

let githubOidcJwksCache:
  | {
      fetchedAt: number;
      keys: GithubOidcJwk[];
    }
  | null = null;

function getBearerToken(authHeader: string | undefined): string {
  const raw = String(authHeader || '').trim();
  if (!raw.startsWith('Bearer ')) return '';
  return raw.slice(7).trim();
}

async function getGithubOidcJwks(): Promise<GithubOidcJwk[]> {
  const now = Date.now();
  if (
    githubOidcJwksCache &&
    now - githubOidcJwksCache.fetchedAt < 60 * 60 * 1000
  ) {
    return githubOidcJwksCache.keys;
  }

  const response = await fetch(
    `${GITHUB_OIDC_ISSUER}/.well-known/jwks`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load GitHub Actions OIDC signing keys (${response.status}).`
    );
  }

  const body = (await response.json()) as { keys?: GithubOidcJwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];

  if (keys.length === 0) {
    throw new Error('GitHub Actions OIDC signing keys are unavailable.');
  }

  githubOidcJwksCache = {
    fetchedAt: now,
    keys,
  };

  return keys;
}

function decodeJwtJson(segment: string): Record<string, unknown> | null {
  try {
    return JSON.parse(
      Buffer.from(segment, 'base64url').toString('utf8')
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function isValidGithubActionsOidcToken(token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtJson(encodedHeader);
  const payload = decodeJwtJson(encodedPayload);

  if (!header || !payload) return false;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  const nbf = payload.nbf === undefined ? null : Number(payload.nbf);
  const iat = payload.iat === undefined ? null : Number(payload.iat);

  if (!Number.isFinite(exp) || exp <= nowSeconds) return false;
  if (nbf !== null && Number.isFinite(nbf) && nbf > nowSeconds + 30) {
    return false;
  }
  if (iat !== null && Number.isFinite(iat) && iat > nowSeconds + 30) {
    return false;
  }

  if (payload.iss !== GITHUB_OIDC_ISSUER) return false;

  const audience = payload.aud;
  const hasExpectedAudience =
    audience === GITHUB_OIDC_AUDIENCE ||
    (Array.isArray(audience) && audience.includes(GITHUB_OIDC_AUDIENCE));

  if (!hasExpectedAudience) return false;
  if (payload.repository !== GITHUB_REPOSITORY) return false;
  if (payload.ref !== GITHUB_MAIN_REF) return false;

  const workflowRef =
    typeof payload.workflow_ref === 'string'
      ? payload.workflow_ref
      : typeof payload.job_workflow_ref === 'string'
      ? payload.job_workflow_ref
      : '';

  if (!GITHUB_SCHEDULER_WORKFLOWS.has(workflowRef)) return false;

  const keys = await getGithubOidcJwks();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) return false;

  const publicKey = crypto.createPublicKey({
    key: jwk as any,
    format: 'jwk',
  });

  return crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, 'base64url')
  );
}

async function isValidSchedulerBearer(
  authHeader: string | undefined
): Promise<boolean> {
  const token = getBearerToken(authHeader);
  if (!token) return false;

  try {
    return await isValidGithubActionsOidcToken(token);
  } catch (error) {
    console.warn(
      'GitHub Actions OIDC validation warning:',
      sanitizeError(error)
    );
    return false;
  }
}

function escapeHtml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeDateKey(value: string): string {
  const raw = String(value || '').trim();

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const named = raw.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/);
  if (named) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthIndex = months.indexOf(named[2].slice(0, 3).toLowerCase());
    if (monthIndex >= 0) {
      const year = named[3].length === 2 ? `20${named[3]}` : named[3];
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
    }
  }

  return raw.toLowerCase();
}

function renderErrorPage(res: express.Response, message: string, status: number = 400) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Error • System Builder</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background-color: #161f30;
      border: 1px solid #334155;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 36px 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .error-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      margin: 0 auto 20px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      background-color: rgba(244, 63, 94, 0.15);
      color: #fb7185;
      border: 2px solid #f43f5e;
    }
    .headline {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 12px;
      color: #ffffff;
    }
    .desc {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .app-btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #334155;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      border-radius: 8px;
      transition: background 0.15s ease;
    }
    .app-btn:hover {
      background-color: #475569;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">✕</div>
    <h1 class="headline">Invalid or Expired Link</h1>
    <p class="desc">${escapeHtml(message)}</p>
    <a href="/" class="app-btn">Return to System Builder</a>
  </div>
</body>
</html>`;
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
}

async function startServer() {
  // Fail closed when privileged IAM credentials are unavailable. The browser
  // no longer has direct Firestore access, so server identity is mandatory.
  await verifyPrivilegedFirestoreAccess();

  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Never expose backend source/config files through Vite development serving
  // or future static-server changes.
  app.use(
    [
      '/.env',
      '/.env.local',
      '/.git',
      '/package.json',
      '/tsconfig.json',
      '/vite.config.ts',
      '/metadata.json',
      '/firebase-applet-config.json',
      '/firestore.rules',
      '/firebase-blueprint.json',
      '/bun.lock',
      '/server.ts',
      '/server',
      '/scripts',
    ],
    (_req, res) => {
      res.status(404).end();
    }
  );

  // Baseline browser hardening for the SPA and JSON APIs.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );

    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
      );
    }

    next();
  });

  // Signed email capability links contain sensitive bearer material in the URL.
  // Prevent caching, framing, and referrer leakage from these pages.
  app.use(
    ['/api/daily-review', '/api/task-confirmation', '/confirm'],
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
      );
      next();
    }
  );

  // 1. Minimal public health check. Do not expose SMTP/provider configuration.
  app.get('/api/health', (_req, res) => {
    const kolkata = getKolkataTimeInfo();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      timezone: 'Asia/Kolkata',
      timeKolkata: kolkata.timeStr,
      dateKolkata: kolkata.formattedDate,
    });
  });

  // Owner authentication bootstrap. These routes only create/read/clear the
  // caller's HttpOnly owner session; they do not expose application data.
  app.get('/api/owner/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      configured: ownerAuthConfigured(),
      authenticated: isOwnerAuthenticated(req),
    });
  });

  app.post('/api/owner/login', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    if (!ownerAuthConfigured()) {
      return res.status(503).json({
        success: false,
        error:
          'Owner authentication is not configured. Set OWNER_ACCESS_TOKEN to a random value of at least 32 characters.',
      });
    }

    const key = ownerAttemptKey(req);
    const now = Date.now();
    const currentAttempt = ownerLoginAttempts.get(key);

    if (currentAttempt && currentAttempt.resetAt > now && currentAttempt.failures >= OWNER_LOGIN_MAX_FAILURES) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed owner login attempts. Try again later.',
      });
    }

    const supplied = String(req.body?.token || '');
    if (!constantTimeEqual(supplied, getOwnerAccessToken())) {
      const active =
        currentAttempt && currentAttempt.resetAt > now
          ? currentAttempt
          : { failures: 0, resetAt: now + OWNER_LOGIN_WINDOW_MS };
      active.failures += 1;
      ownerLoginAttempts.set(key, active);

      return res.status(401).json({
        success: false,
        error: 'Invalid owner access token.',
      });
    }

    ownerLoginAttempts.delete(key);

    const session = createOwnerSession();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const maxAgeSeconds = Math.floor(OWNER_SESSION_TTL_MS / 1000);
    res.setHeader(
      'Set-Cookie',
      `${OWNER_SESSION_COOKIE}=${encodeURIComponent(
        session
      )}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`
    );

    return res.json({ success: true });
  });

  app.post('/api/owner/logout', (_req, res) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Set-Cookie',
      `${OWNER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
    );
    res.json({ success: true });
  });

  // Owner-only application data API. Browser code must use these routes rather
  // than connecting to Firestore directly.
  app.get('/api/data/records', requireOwner, async (_req, res) => {
    try {
      const snapshot = await getDocs(collection(db, 'records'));
      const records = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) => (Number(a.day) || 0) - (Number(b.day) || 0));
      res.json({ records });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put('/api/data/records/:id', requireOwner, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const body = req.body || {};
      const day = Number(body.day);
      const date = String(body.date || '').trim();

      if (!id || !Number.isFinite(day) || day <= 0 || !date) {
        return res.status(400).json({ error: 'Record id, positive day, and date are required.' });
      }

      const existing = await getDocs(collection(db, 'records'));
      const normalizedDate = normalizeDateKey(date);
      const duplicate = existing.docs.find((item) => {
        if (item.id === id) return false;
        const data = item.data();
        return (
          Number(data.day) === day ||
          normalizeDateKey(String(data.date || '')) === normalizedDate
        );
      });

      if (duplicate) {
        return res.status(409).json({
          error: 'Another record already uses this day number or date.',
        });
      }

      const payload = {
        id,
        day,
        date,
        isCompleted: Boolean(body.isCompleted),
        result: body.isCompleted ? 'TRUE' : 'FALSE',
        change: Number.isFinite(Number(body.change)) ? Number(body.change) : 0,
        skill: String(body.skill || '').slice(0, 120),
        summary: String(body.summary || '').slice(0, 500),
        notes: String(body.notes || '').slice(0, 4000),
        ...(body.responseSubmittedAt
          ? { responseSubmittedAt: String(body.responseSubmittedAt).slice(0, 80) }
          : {}),
        ...(body.responseSource
          ? { responseSource: String(body.responseSource).slice(0, 40) }
          : {}),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'records', id), payload);
      res.json({ success: true, record: payload });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete('/api/data/records/:id', requireOwner, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Record id is required.' });
      await deleteDoc(doc(db, 'records', id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.get('/api/data/tasks', requireOwner, async (_req, res) => {
    try {
      const snapshot = await getDocs(collection(db, 'tasks'));
      const tasks = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) =>
          String(b.taskKey || '').localeCompare(String(a.taskKey || ''))
        );
      res.json({ tasks });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put('/api/data/tasks/:id', requireOwner, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const body = req.body || {};
      const taskKey = String(body.taskKey || '').trim();
      const taskOfTheDay = String(body.taskOfTheDay || '').trim();

      if (
        !id ||
        !/^\d{4}-\d{2}-\d{2}$/.test(taskKey) ||
        !taskOfTheDay ||
        taskOfTheDay.length > 500
      ) {
        return res.status(400).json({
          error: 'Task id, YYYY-MM-DD date, and a task title up to 500 characters are required.',
        });
      }

      const existing = await getDocs(collection(db, 'tasks'));
      const duplicate = existing.docs.find((item) => {
        if (item.id === id) return false;
        const data = item.data();
        return (
          String(data.taskKey || '') === taskKey &&
          String(data.taskOfTheDay || '').trim().toLowerCase() ===
            taskOfTheDay.toLowerCase()
        );
      });

      if (duplicate) {
        return res.status(409).json({
          error: 'Another task with this title already exists for the selected date.',
        });
      }

      const allowedPriorities = new Set(['High', 'Medium', 'Normal']);
      const allowedQuadrants = new Set([
        'urgent-important',
        'important',
        'urgent',
        'neither',
      ]);

      const payload = {
        id,
        taskKey,
        taskOfTheDay,
        isCompleted: Boolean(body.isCompleted),
        priority: allowedPriorities.has(String(body.priority))
          ? String(body.priority)
          : 'Normal',
        timeEstimate: String(body.timeEstimate || '').slice(0, 80),
        category: String(body.category || 'General').slice(0, 120),
        notes: String(body.notes || '').slice(0, 4000),
        updatedAt: new Date().toISOString(),
        completedAt: body.completedAt ? String(body.completedAt).slice(0, 80) : null,
        matrixQuadrant: allowedQuadrants.has(String(body.matrixQuadrant))
          ? String(body.matrixQuadrant)
          : null,
      };

      await setDoc(doc(db, 'tasks', id), payload);
      res.json({ success: true, task: payload });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete('/api/data/tasks/:id', requireOwner, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Task id is required.' });
      await deleteDoc(doc(db, 'tasks', id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.get('/api/data/habits', requireOwner, async (_req, res) => {
    try {
      const snapshot = await getDocs(collection(db, 'habits'));
      const habits = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) =>
          String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
        );
      res.json({ habits });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put('/api/data/habits/:id', requireOwner, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const allowedFrequencies = new Set(['daily', 'weekdays', 'custom']);
      const allowedColors = new Set(['blue', 'emerald', 'amber', 'rose', 'violet']);

      if (!id || !name || name.length > 200) {
        return res.status(400).json({
          error: 'Habit id and a name up to 200 characters are required.',
        });
      }

      const normalizeDateList = (value: unknown): string[] =>
        Array.isArray(value)
          ? Array.from(
              new Set(
                value
                  .map((item) => String(item))
                  .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
              )
            ).slice(0, 5000)
          : [];

      const repeatDays = Array.isArray(body.repeatDays)
        ? Array.from(
            new Set(
              body.repeatDays
                .map((item: unknown) => Number(item))
                .filter(
                  (item: number) =>
                    Number.isInteger(item) && item >= 0 && item <= 6
                )
            )
          )
        : [];

      const payload = {
        id,
        name,
        emoji: String(body.emoji || '✓').slice(0, 16),
        frequency: allowedFrequencies.has(String(body.frequency))
          ? String(body.frequency)
          : 'daily',
        repeatDays,
        skippedDates: normalizeDateList(body.skippedDates),
        extraDates: normalizeDateList(body.extraDates),
        color: allowedColors.has(String(body.color))
          ? String(body.color)
          : 'blue',
        checkIns: normalizeDateList(body.checkIns),
        createdAt: String(body.createdAt || new Date().toISOString()).slice(0, 80),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'habits', id), payload);
      res.json({ success: true, habit: payload });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete('/api/data/habits/:id', requireOwner, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Habit id is required.' });
      await deleteDoc(doc(db, 'habits', id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.get('/api/data/countdown', requireOwner, async (_req, res) => {
    try {
      const snapshot = await getDoc(
        doc(db, 'notification_settings', 'system_builder_countdown')
      );
      res.json({ settings: snapshot.exists() ? snapshot.data() : null });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put('/api/data/countdown', requireOwner, async (req, res) => {
    try {
      const targetDate = String(req.body?.targetDate || '').trim();
      const reason = String(req.body?.reason || '').trim();

      if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        return res.status(400).json({
          error: 'Countdown target date must use YYYY-MM-DD format.',
        });
      }

      if (reason.length > 160) {
        return res.status(400).json({
          error: 'Countdown reason must be 160 characters or fewer.',
        });
      }

      const payload = {
        targetDate,
        reason,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(
        doc(db, 'notification_settings', 'system_builder_countdown'),
        payload,
        { merge: true }
      );
      res.json({ success: true, settings: payload });
    } catch (error) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // 2. Owner-only notification settings API
  app.get('/api/notifications/settings', requireOwner, async (req, res) => {
    try {
      const settings = await getNotificationSettings();
      const provider = getEmailProviderStatus();
      res.json({
        settings,
        provider,
        kolkataTime: getKolkataTimeInfo(),
        appBaseUrl: getAppBaseUrl(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notifications/settings', requireOwner, async (req, res) => {
    try {
      const updated = await saveNotificationSettings(req.body);
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Send test confirmation email directly via Gmail SMTP (Admin test action)
  app.post('/api/notifications/send-test', requireOwner, async (_req, res) => {
    try {
      const result = await triggerDailyReminder({ force: true });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: sanitizeError(result.error || 'Failed to send test email'),
          date: result.date,
          recipient: result.recipient,
          taskId: result.taskId,
        });
      }

      res.json({
        success: true,
        date: result.date,
        taskId: result.taskId,
        recipient: result.recipient,
        messageId: result.messageId,
        taskName: result.taskName,
        status: result.status,
        result: {
          status: result.status,
          messageId: result.messageId,
        },
      });
    } catch (err: any) {
      const safeErr = sanitizeError(err);
      console.error('Error sending test email:', safeErr);
      res.status(500).json({ error: safeErr });
    }
  });

  // 4. Production endpoint for external scheduler: GET/POST /api/send-daily-reminder
  // Protected with a short-lived GitHub Actions OIDC bearer token from an
  // approved scheduler workflow on this repository's main branch.
  // Sends daily commitment reminder to sbrafiqahmedali7575@gmail.com.
  // Retrieves today's task in Asia/Kolkata timezone with Completed & Not Completed buttons.
  // Enforces persistent deduplication preventing double-sends for the same IST date.
  app.post('/api/send-daily-reminder', async (req, res) => {
    if (!(await isValidSchedulerBearer(req.headers.authorization))) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid scheduler authentication.',
      });
    }

    try {
      // Scheduler callers may trigger the configured reminder only. Recipient
      // selection and forced duplicate sends are reserved for owner-only code paths.
      const result = await triggerDailyReminder();

      // If already sent for this IST date and not forced
      if (result.alreadySent) {
        return res.status(200).json({
          success: true,
          alreadySent: true,
          message: result.message || `Daily reminder already sent for IST date ${result.date}. Duplicate skipped.`,
          date: result.date,
          taskId: result.taskId,
          recipient: result.recipient,
          messageId: result.messageId || null,
          taskName: result.taskName,
          sentAt: result.sentAt,
        });
      }

      if (!result.success) {
        return res.status(500).json({
          success: false,
          date: result.date,
          taskId: result.taskId,
          recipient: result.recipient,
          error: sanitizeError(result.error || 'Failed to dispatch daily reminder email.'),
        });
      }

      return res.status(200).json({
        success: true,
        alreadySent: false,
        date: result.date,
        taskId: result.taskId,
        recipient: result.recipient,
        messageId: result.messageId,
        taskName: result.taskName,
        status: result.status,
        sentAt: result.sentAt,
      });
    } catch (err: any) {
      const safeError = sanitizeError(err);
      console.error('Unhandled failure in /api/send-daily-reminder:', safeError);
      return res.status(500).json({
        success: false,
        error: safeError,
      });
    }
  });

  // End-of-day fallback: no task creation or no explicit app/email response => Not Completed.
  app.post('/api/finalize-day', async (req, res) => {
    if (!(await isValidSchedulerBearer(req.headers.authorization))) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid scheduler authentication.',
      });
    }

    try {
      const usePreviousDay =
        req.body?.previousDay === true ||
        String(req.query?.target || '').toLowerCase() === 'previous';

      const targetDate = usePreviousDay
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date();

      const result = await finalizeDayIfNoResponse(targetDate);
      return res.status(200).json({ success: true, target: usePreviousDay ? 'previous' : 'current', ...result });
    } catch (err: any) {
      const safeError = sanitizeError(err);
      console.error('Unhandled failure in /api/finalize-day:', safeError);
      return res.status(500).json({ success: false, error: safeError });
    }
  });

  // 4. Delivery logs audit history
  app.get('/api/notifications/logs', requireOwner, async (req, res) => {
    try {
      const snap = await getDocs(collection(db, 'delivery_logs'));
      const logs: any[] = [];
      snap.forEach((d) => {
        logs.push({ id: d.id, ...d.data() });
      });

      logs.sort((a, b) => {
        const tA = new Date(a.sentAt || 0).getTime();
        const tB = new Date(b.sentAt || 0).getTime();
        return tB - tA;
      });

      res.json({ logs: logs.slice(0, 30) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. One-Click Records CSV Backup & Export Endpoint (records.csv ONLY)
  // Cleaned columns: id, day, date, isCompleted, notes
  app.get('/api/backup/export', requireOwner, async (req, res) => {
    try {
      const format = String(req.query.format || 'csv').toLowerCase();

      const data = await fetchAllProjectData();
      const csvFiles = generateAllCsvFiles(data);
      const recordsCsv = csvFiles['records.csv'] || '';

      if (format === 'json') {
        return res.json({
          success: true,
          timestamp: data.timestamp,
          counts: {
            records: data.records.length,
          },
          folderPath: 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB',
          defaultSubfolder: 'csv_files',
          targetPath: 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB\\csv_files\\records.csv',
          columns: [
            'id',
            'day',
            'date',
            'skill',
            'summary',
            'result',
            'isCompleted',
            'change',
            'notes',
            'updatedAt',
          ],
          csvFiles: {
            'records.csv': recordsCsv,
          },
        });
      }

      // Add UTF-8 Byte Order Mark (BOM) so Excel and SQL Loaders on Windows parse UTF-8 accurately
      const bom = '\uFEFF';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="records.csv"');
      return res.status(200).send(bom + recordsCsv);
    } catch (err: any) {
      console.error('Failed to generate backup export:', err);
      res.status(500).json({ success: false, error: err.message || 'Backup generation failed' });
    }
  });

  // Windows batch sync script generator for automated replacement of records.csv
  // Hardcoded default target: D:\My Projects\SQL\DataSet\RafiqCommitDB\csv_files
  app.get('/api/backup/sync-script', requireOwner, (req, res) => {
    const baseUrl = getAppBaseUrl();
    const rootDir = 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB';
    const targetDir = 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB\\csv_files';
    const batchContent = `@echo off
chcp 65001 >nul
echo ======================================================================
echo  System Builder (RafiqCommitDB) - Records CSV Auto-Replacer
echo  Folder Path: ${rootDir}
echo  Default Subfolder: csv_files
echo  Target File: ${targetDir}\\records.csv
echo ======================================================================

set "ROOT_DIR=${rootDir}"
set "TARGET_DIR=${targetDir}"

if not exist "%ROOT_DIR%" (
  echo [Info] Root project directory does not exist. Creating "%ROOT_DIR%"...
  mkdir "%ROOT_DIR%"
)

if not exist "%TARGET_DIR%" (
  echo [Info] Target folder "csv_files" does not exist. Creating "%TARGET_DIR%"...
  mkdir "%TARGET_DIR%"
)

echo.
echo [1/2] Deleting previous records CSV in "%TARGET_DIR%"...
if exist "%TARGET_DIR%\\records.csv" del /F /Q "%TARGET_DIR%\\records.csv"
del /F /Q "%TARGET_DIR%\\*.csv" 2>nul
echo       Previous records files deleted cleanly with zero folder prompt.

echo.
if "%SYSTEM_BUILDER_OWNER_TOKEN%"=="" (
  echo [Error] SYSTEM_BUILDER_OWNER_TOKEN is not set.
  echo         Set it to the same value as the server OWNER_ACCESS_TOKEN.
  exit /b 1
)

echo [2/2] Downloading fresh records.csv directly into csv_files...
curl -s -H "Authorization: Bearer %SYSTEM_BUILDER_OWNER_TOKEN%" "${baseUrl}/api/backup/export?table=records" -o "%TARGET_DIR%\\records.csv"

echo.
echo Verification:
dir "%TARGET_DIR%\\records.csv"

echo.
echo ======================================================================
echo  SUCCESS! records.csv replaced in "%TARGET_DIR%".
echo  Columns: id, day, date, isCompleted, notes
echo  Ready for SQL Server / Power BI reload.
echo ======================================================================
pause
`;

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sync_rafiq_commit_db.bat"');
    res.send(batchContent);
  });

  // 6. Daily email checklist review.
  // GET is read-only and renders real checkboxes. POST saves each task independently,
  // then marks the records row Completed only when every task is checked.
  app.get('/api/daily-review', async (req, res) => {
    try {
      const queryToken = String(req.query.token || '');
      const token =
        queryToken ||
        getCookieValue(req, DAILY_REVIEW_CAPABILITY_COOKIE);
      const verification = verifyConfirmationToken(token);

      if (!verification.valid || !verification.payload) {
        clearCapabilityCookie(
          res,
          DAILY_REVIEW_CAPABILITY_COOKIE,
          '/api/daily-review'
        );
        return renderErrorPage(res, verification.error || 'Invalid or expired daily review link.');
      }

      const { payload } = verification;

      if (queryToken) {
        setCapabilityCookie(
          res,
          DAILY_REVIEW_CAPABILITY_COOKIE,
          token,
          '/api/daily-review'
        );
        return res.redirect(303, '/api/daily-review');
      }
      if (payload.action !== 'review') {
        return renderErrorPage(res, 'This link is not a daily checklist review link.');
      }

      const currentDateKey = normalizeDateKey(getKolkataTimeInfo().dateKey);
      const targetDateKey = normalizeDateKey(payload.taskDate);
      if (targetDateKey !== currentDateKey) {
        return renderErrorPage(
          res,
          'Only the current day can be reviewed or submitted. This daily checklist is now closed.'
        );
      }
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      const dayTasks: any[] = [];

      tasksSnap.forEach((d) => {
        const task = { id: d.id, ...(d.data() as any) };
        if (normalizeDateKey(task.taskKey || task.date || '') === targetDateKey) {
          dayTasks.push(task);
        }
      });

      dayTasks.sort((a, b) =>
        String(a.updatedAt || a.id).localeCompare(String(b.updatedAt || b.id))
      );

      const taskMarkup =
        dayTasks.length > 0
          ? dayTasks
              .map(
                (task) => `
                  <label class="task-row">
                    <input
                      type="checkbox"
                      name="completedTaskIds"
                      value="${escapeHtml(task.id)}"
                      ${task.isCompleted ? 'checked' : ''}
                    />
                    <span>${escapeHtml(task.taskOfTheDay || 'Daily Task')}</span>
                  </label>`
              )
              .join('')
          : '<div class="empty">No tasks were found for today.</div>';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mark Current Day</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:rgba(15,23,42,.58);color:#000000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;min-height:100vh;padding:16px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)}
    .card{position:relative;width:100%;max-width:430px;background:#ffffff;border:1px solid #dbe3ee;border-radius:22px;padding:24px;box-shadow:0 28px 90px rgba(15,23,42,.38)}
    .close-btn{position:absolute;top:12px;right:12px;width:38px;height:38px;border:0;border-radius:999px;background:#f1f5f9;color:#000000;font-size:24px;line-height:1;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s ease,transform .15s ease}
    .close-btn:hover{background:#e2e8f0;transform:scale(1.04)}
    .close-btn:active{transform:scale(.97)}
    .eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;color:#2563eb;margin-bottom:6px}
    h1{font-size:24px;line-height:1.2;margin:0 0 6px;color:#000000;font-weight:900}
    .date{font-family:monospace;color:#000000;margin-bottom:16px;font-size:14px;font-weight:800}
    .help{font-size:14px;color:#000000;line-height:1.55;margin:0 0 16px;font-weight:700}
    .tasks{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff}
    .task-row{display:flex;gap:12px;align-items:center;padding:14px;border-bottom:1px solid #e2e8f0;cursor:pointer;background:#ffffff;min-height:54px}
    .task-row:hover{background:#f8fafc}
    .task-row:last-child{border-bottom:0}
    .task-row input{width:22px;height:22px;min-width:22px;margin:0;accent-color:#2563eb;cursor:pointer}
    .task-row span{font-size:16px;line-height:1.45;font-weight:800;color:#000000}
    .empty{padding:18px;color:#000000;font-size:15px;font-weight:800}
    .submit{width:100%;margin-top:18px;border:1px solid #1d4ed8;border-radius:12px;background:#2563eb;color:white;padding:16px 20px;font-size:17px;font-weight:900;letter-spacing:.2px;cursor:pointer;box-shadow:0 8px 20px rgba(37,99,235,.22)}
    .submit:hover{background:#1d4ed8}
    .submit:active{transform:translateY(1px)}
    .submit:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
    .rule{margin-top:12px;text-align:center;color:#000000;font-size:12px;line-height:1.45;font-weight:700}
    @media (max-width:520px){
      html,body{width:100%;max-width:100%;overflow-x:hidden}
      body{padding:8px;align-items:center;justify-content:center}
      .card{
        margin:0;
        width:100%;
        max-width:100%;
        padding:16px 12px 14px;
        border-radius:16px;
        overflow:hidden;
      }
      .close-btn{
        top:8px;
        right:8px;
        width:44px;
        height:44px;
        font-size:26px;
        touch-action:manipulation;
      }
      .eyebrow{
        font-size:10px;
        line-height:1.2;
        margin-bottom:4px;
        padding-right:48px;
      }
      h1{
        font-size:23px;
        line-height:1.15;
        margin-bottom:4px;
        padding-right:48px;
        overflow-wrap:anywhere;
      }
      .date{
        font-size:14px;
        margin-bottom:12px;
        overflow-wrap:anywhere;
      }
      .help{
        font-size:14px;
        line-height:1.45;
        margin-bottom:12px;
      }
      .tasks{
        width:100%;
        max-width:100%;
        overflow:hidden;
      }
      .task-row{
        width:100%;
        max-width:100%;
        gap:12px;
        padding:13px 10px;
        min-height:58px;
        align-items:center;
      }
      .task-row input{
        width:28px;
        height:28px;
        min-width:28px;
        flex:0 0 28px;
        margin:0;
        touch-action:manipulation;
      }
      .task-row span{
        min-width:0;
        max-width:100%;
        font-size:16px;
        line-height:1.4;
        font-weight:900;
        overflow-wrap:anywhere;
        word-break:break-word;
      }
      .submit{
        width:100%;
        min-height:52px;
        margin-top:14px;
        padding:15px 16px;
        font-size:18px;
        border-radius:12px;
        touch-action:manipulation;
      }
      .rule{
        font-size:12px;
        line-height:1.4;
        margin-top:10px;
        padding:0 2px;
      }
    }

    @media (max-width:360px){
      body{padding:6px}
      .card{padding:14px 10px 12px}
      .close-btn{width:42px;height:42px}
      h1{font-size:21px}
      .help{font-size:13px}
      .task-row{padding:12px 9px}
      .task-row span{font-size:15px}
      .submit{font-size:17px;min-height:50px}
    }  </style>
</head>
<body>
  <main class="card" role="dialog" aria-modal="true" aria-labelledby="mark-day-title">
    <button
      type="button"
      class="close-btn"
      aria-label="Close Mark Day"
      title="Close"
      onclick="if (window.opener) { window.close(); } else if (history.length > 1) { history.back(); } else { window.location.href = '/'; }"
    >
      ×
    </button>
    <div class="eyebrow">Current Day Tasks</div>
    <h1 id="mark-day-title">Mark Current Day</h1>
    <div class="date">${escapeHtml(payload.taskDate)}</div>
    <p class="help">Check the tasks you completed. When finished, press <strong>Mark Day</strong>.</p>

    <form method="POST" action="/api/daily-review">
      <div class="tasks">${taskMarkup}</div>
      <button class="submit" type="submit" ${dayTasks.length === 0 ? 'disabled' : ''}>
        Mark Day
      </button>
      <div class="rule">
        All tasks checked = Completed. Any task unchecked = Not Completed.
      </div>
    </form>
  </main>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (err: any) {
      console.error('Daily review page error:', sanitizeError(err));
      renderErrorPage(res, 'Unable to load today’s task checklist.', 500);
    }
  });

  app.post('/api/daily-review', async (req, res) => {
    try {
      const token =
        String(req.body.token || '') ||
        getCookieValue(req, DAILY_REVIEW_CAPABILITY_COOKIE);
      const verification = verifyConfirmationToken(token);

      if (!verification.valid || !verification.payload) {
        return renderErrorPage(res, verification.error || 'Invalid or expired daily review link.');
      }

      const { payload } = verification;
      if (payload.action !== 'review') {
        return renderErrorPage(res, 'This link is not a daily checklist review link.');
      }

      const currentDateKey = normalizeDateKey(getKolkataTimeInfo().dateKey);
      const submittedDateKey = normalizeDateKey(payload.taskDate);
      if (submittedDateKey !== currentDateKey) {
        return renderErrorPage(
          res,
          'Only the current day can be submitted. This daily checklist is now closed.'
        );
      }

      const selectedRaw = req.body.completedTaskIds;
      const selectedIds = new Set<string>(
        (Array.isArray(selectedRaw) ? selectedRaw : selectedRaw ? [selectedRaw] : []).map(String)
      );

      const targetDateKey = normalizeDateKey(payload.taskDate);
      const nowIso = new Date().toISOString();

      // Load every task for the signed date.
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      const dayTasks: any[] = [];

      tasksSnap.forEach((d) => {
        const task = { id: d.id, ...(d.data() as any) };
        if (normalizeDateKey(task.taskKey || task.date || '') === targetDateKey) {
          dayTasks.push(task);
        }
      });

      if (dayTasks.length === 0) {
        return renderErrorPage(res, 'No tasks were found for this date, so the day was not submitted.');
      }

      // Save each checkbox independently.
      await Promise.all(
        dayTasks.map((task) => {
          const completed = selectedIds.has(task.id);
          return updateDoc(doc(db, 'tasks', task.id), {
            isCompleted: completed,
            completedAt: completed ? (task.completedAt || nowIso) : null,
            updatedAt: nowIso,
          });
        })
      );

      const completedCount = dayTasks.filter((task) => selectedIds.has(task.id)).length;
      const allCompleted = completedCount === dayTasks.length;

      // Find the records row for the same date and update it, or create one when absent.
      const recordsSnap = await getDocs(collection(db, 'records'));
      const allRecords: any[] = [];
      let matchedRecord: any = null;

      recordsSnap.forEach((d) => {
        const record = { id: d.id, ...(d.data() as any) };
        allRecords.push(record);
        if (normalizeDateKey(record.date || '') === targetDateKey) {
          matchedRecord = record;
        }
      });

      if (matchedRecord) {
        await updateDoc(doc(db, 'records', matchedRecord.id), {
          isCompleted: allCompleted,
          result: allCompleted ? 'TRUE' : 'FALSE',
          change: 0,
          summary: `${completedCount}/${dayTasks.length} tasks completed`,
          responseSubmittedAt: nowIso,
          responseSource: 'EMAIL',
          updatedAt: nowIso,
        });
      } else {
        const highestDay = allRecords.reduce(
          (maxDay, record) => Math.max(maxDay, Number(record.day) || 0),
          0
        );
        const recordId =
          payload.recordId && !payload.recordId.startsWith('review-')
            ? payload.recordId
            : `record-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        await setDoc(doc(db, 'records', recordId), {
          id: recordId,
          day: highestDay + 1,
          date: payload.taskDate,
          isCompleted: allCompleted,
          result: allCompleted ? 'TRUE' : 'FALSE',
          change: 0,
          skill: 'Daily Tasks',
          summary: `${completedCount}/${dayTasks.length} tasks completed`,
          notes: 'Submitted from daily email checklist',
          responseSubmittedAt: nowIso,
          responseSource: 'EMAIL',
          updatedAt: nowIso,
        });
      }

      const statusLabel = allCompleted ? 'Completed' : 'Not Completed';
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusLabel} • System Builder</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#0b0f19;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{max-width:500px;width:100%;background:#161f30;border:1px solid #283548;border-radius:18px;padding:30px;text-align:center}
    .icon{font-size:40px;margin-bottom:12px}h1{font-size:23px;margin:0 0 10px}
    p{color:#94a3b8;line-height:1.55}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}
    .btn{display:block;width:100%;border:0;color:#fff;text-decoration:none;padding:14px 12px;border-radius:10px;font-weight:900;font-size:15px;font-family:inherit;cursor:pointer;text-align:center}
    .exit-btn{background:#0f172a;border:1px solid #475569}
    .open-btn{background:#2563eb}
    @media(max-width:420px){.actions{grid-template-columns:1fr}.btn{min-height:48px}}
  </style>
</head>
<body>
  <main class="card">
    <div class="icon">${allCompleted ? '✓' : '◐'}</div>
    <h1>Day marked ${statusLabel}</h1>
    <p>${completedCount} of ${dayTasks.length} tasks were submitted as completed for ${escapeHtml(payload.taskDate)}.</p>
    <div class="actions">
      <button
        class="btn exit-btn"
        type="button"
        onclick="window.close(); setTimeout(function(){ if (history.length > 1) { history.back(); } else { window.location.replace('about:blank'); } }, 120);"
      >
        Exit
      </button>
      <a class="btn open-btn" href="/">Go to Dashboard</a>
    </div>
  </main>
</body>
</html>`;

      clearCapabilityCookie(
        res,
        DAILY_REVIEW_CAPABILITY_COOKIE,
        '/api/daily-review'
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (err: any) {
      console.error('Daily review submission error:', sanitizeError(err));
      renderErrorPage(res, 'Unable to save today’s task response.', 500);
    }
  });

  // 6. Public production Task Confirmation GET endpoint & Landing Page
  // Required format: /api/task-confirmation?taskId=...&taskDate=...&status=completed|pending&token=...
  // Safe against email link scanners: GET only renders confirmation page, NO database mutation.
  app.get('/api/task-confirmation', async (req, res) => {
    try {
      const queryToken = (req.query.token as string) || '';
      const token =
        queryToken ||
        getCookieValue(req, TASK_CONFIRM_CAPABILITY_COOKIE);
      const taskId = (req.query.taskId as string) || '';
      const taskDate = (req.query.taskDate as string) || '';
      const rawStatus = (req.query.status as string) || (req.query.action as string) || '';

      if (!token) {
        return renderErrorPage(res, 'Missing cryptographic confirmation token in link.');
      }

      // Validate HMAC signature & expiration using CONFIRMATION_SECRET
      const verification = verifyConfirmationToken(token);
      if (!verification.valid || !verification.payload) {
        return renderErrorPage(res, verification.error || 'Confirmation link is invalid or has expired.');
      }

      const { payload } = verification;

      // Validate taskDate if provided in query
      if (taskDate && payload.taskDate !== taskDate) {
        return renderErrorPage(res, 'Task date in confirmation link does not match signed token.');
      }

      const effectiveDate = payload.taskDate;
      const effectiveStatus: 'completed' | 'pending' =
        payload.status || (payload.action === 'completed' ? 'completed' : 'pending');

      // Check status alignment if explicitly provided in query
      if (rawStatus && rawStatus !== effectiveStatus && rawStatus !== (effectiveStatus === 'completed' ? 'completed' : 'not_completed')) {
        return renderErrorPage(res, 'Requested status does not match the signed token.');
      }

      if (queryToken) {
        setCapabilityCookie(
          res,
          TASK_CONFIRM_CAPABILITY_COOKIE,
          token,
          '/api/task-confirmation'
        );
        return res.redirect(303, '/api/task-confirmation');
      }

      // Fetch the specific task/record from Firestore strictly for effectiveDate
      let taskName = 'Daily Commitment';
      let currentStatus = false;

      // Check records collection
      try {
        if (payload.recordId) {
          const recSnap = await getDoc(doc(db, 'records', payload.recordId));
          if (recSnap.exists()) {
            const r = recSnap.data();
            taskName = r.summary || `Day ${r.day || 1} Commitment`;
            currentStatus = Boolean(r.isCompleted);
          }
        }
      } catch (e) {
        console.warn('Record lookup error:', e);
      }

      // Check tasks collection
      try {
        if (payload.taskId) {
          const tSnap = await getDoc(doc(db, 'tasks', payload.taskId));
          if (tSnap.exists()) {
            const t = tSnap.data();
            taskName = t.taskOfTheDay || taskName;
            currentStatus = Boolean(t.isCompleted);
          }
        }
      } catch (e) {
        console.warn('Task lookup error:', e);
      }

      const isMarkingCompleted = effectiveStatus === 'completed';

      // Render server-side confirmation landing page
      const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Commitment • System Builder</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background-color: #161f30;
      border: 1px solid #283548;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 32px 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #283548;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand {
      font-weight: 900;
      font-size: 18px;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .badge-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background-color: #0d9488;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .headline {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .subtext {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .task-box {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 20px;
    }
    .label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .task-title {
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 10px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
    }
    .status-badge-completed {
      background-color: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-badge-pending {
      background-color: rgba(244, 63, 94, 0.15);
      color: #fb7185;
      border: 1px solid rgba(244, 63, 94, 0.3);
    }
    .scanner-shield {
      background-color: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 24px;
      font-size: 12px;
      line-height: 1.5;
      color: #cbd5e1;
    }
    .scanner-shield strong {
      color: #fbbf24;
    }
    .submit-btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 800;
      border: none;
      cursor: pointer;
      text-align: center;
      transition: opacity 0.15s ease, transform 0.1s ease;
    }
    .submit-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .btn-completed {
      background-color: #0d9488;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4);
    }
    .btn-pending {
      background-color: #334155;
      color: #f8fafc;
      box-shadow: 0 4px 14px rgba(51, 65, 85, 0.4);
    }
    .cancel-link {
      display: block;
      margin-top: 16px;
      text-align: center;
      font-size: 13px;
      color: #64748b;
      text-decoration: none;
    }
    .cancel-link:hover {
      color: #94a3b8;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">System Builder</div>
      <div class="badge-tag">Commitment Confirmation</div>
    </div>

    <h1 class="headline">Confirm Commitment Status</h1>
    <p class="subtext">
      Please tap the confirmation button below to record your response for this day.
    </p>

    <div class="task-box">
      <div class="label">Date: ${escapeHtml(effectiveDate)}</div>
      <div class="task-title">${escapeHtml(taskName)}</div>
      <div class="label" style="margin-top: 8px;">Action to Record</div>
      <div class="status-badge ${isMarkingCompleted ? 'status-badge-completed' : 'status-badge-pending'}">
        ${isMarkingCompleted ? '✓ Mark as Completed' : '✕ Mark as Not Completed'}
      </div>
    </div>

    <div class="scanner-shield">
      🛡️ <strong>Anti-Scanner Protection:</strong> Your task status has <strong>not</strong> been modified yet. Automatic email scanners that pre-scanned this link cannot alter your database. Tap below to confirm your response.
    </div>

    <form method="POST" action="/api/task-confirmation">
      <input type="hidden" name="taskId" value="${escapeHtml(payload.taskId || taskId)}" />
      <input type="hidden" name="recordId" value="${escapeHtml(payload.recordId)}" />
      <input type="hidden" name="taskDate" value="${escapeHtml(effectiveDate)}" />
      <input type="hidden" name="status" value="${escapeHtml(effectiveStatus)}" />
      <button type="submit" class="submit-btn ${isMarkingCompleted ? 'btn-completed' : 'btn-pending'}">
        ${isMarkingCompleted ? '✓ Confirm Completed' : '✕ Confirm Not Completed'}
      </button>
    </form>

    <a href="/" class="cancel-link">Return to System Builder Dashboard</a>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8').send(landingHtml);
    } catch (err: any) {
      console.error('Error handling task confirmation landing page:', err);
      renderErrorPage(res, err.message || 'Server error loading confirmation landing page', 500);
    }
  });

  // 6. Public production Task Confirmation POST endpoint (State Mutation)
  // Ensures an older email updates ONLY its original task and date—not today's task.
  app.post('/api/task-confirmation', async (req, res) => {
    try {
      const token =
        (req.body.token as string) ||
        getCookieValue(req, TASK_CONFIRM_CAPABILITY_COOKIE);
      const formTaskDate = (req.body.taskDate as string) || '';
      const formStatus = (req.body.status as string) || '';

      if (!token) {
        return renderErrorPage(res, 'Missing confirmation token.');
      }

      // Cryptographically verify token
      const verification = verifyConfirmationToken(token);
      if (!verification.valid || !verification.payload) {
        return renderErrorPage(res, verification.error || 'Invalid or expired confirmation token.');
      }

      const { payload } = verification;

      // Validate date match
      if (formTaskDate && formTaskDate !== payload.taskDate) {
        return renderErrorPage(res, 'Task date does not match cryptographic signature.');
      }

      // Target strictly based on signed token data
      const targetDate = payload.taskDate;
      const targetStatus: 'completed' | 'pending' =
        payload.status || (payload.action === 'completed' ? 'completed' : 'pending');
      const isCompleted = targetStatus === 'completed';
      const targetRecordId = payload.recordId || payload.taskId;
      const targetTaskId = payload.taskId;
      const nowIso = new Date().toISOString();

      let targetTaskName = 'Daily Commitment';

      // Update only objects explicitly named by the signed capability token.
      // A token for one task/date must never gain authority over sibling tasks
      // merely because they share the same date.
      let recordUpdated = false;
      if (targetRecordId) {
        const recRef = doc(db, 'records', targetRecordId);
        const recSnap = await getDoc(recRef);

        if (recSnap.exists()) {
          const record = recSnap.data();
          if (normalizeDateKey(record.date || '') !== normalizeDateKey(targetDate)) {
            return renderErrorPage(
              res,
              'The signed record no longer matches the confirmation date.'
            );
          }

          targetTaskName = record.summary || targetTaskName;
          await updateDoc(recRef, {
            isCompleted,
            result: isCompleted ? 'TRUE' : 'FALSE',
            change: 0,
            updatedAt: nowIso,
          });
          recordUpdated = true;
        }
      }

      if (!recordUpdated) {
        const recordsSnap = await getDocs(collection(db, 'records'));
        const matchingRecords = recordsSnap.docs.filter((item) => {
          const record = item.data();
          return normalizeDateKey(record.date || '') === normalizeDateKey(targetDate);
        });

        // Preserve legacy email links only when the date identifies exactly one
        // existing record. Never fan out a capability across multiple records.
        if (matchingRecords.length === 1) {
          const match = matchingRecords[0];
          const record = match.data();
          targetTaskName = record.summary || targetTaskName;
          await updateDoc(doc(db, 'records', match.id), {
            isCompleted,
            result: isCompleted ? 'TRUE' : 'FALSE',
            change: 0,
            updatedAt: nowIso,
          });
          recordUpdated = true;
        } else if (matchingRecords.length > 1) {
          return renderErrorPage(
            res,
            'This legacy confirmation link is ambiguous and cannot be applied safely.'
          );
        }
      }

      if (!recordUpdated) {
        return renderErrorPage(
          res,
          'The record referenced by this confirmation link no longer exists.'
        );
      }

      if (targetTaskId && !targetTaskId.startsWith('review-')) {
        const taskRef = doc(db, 'tasks', targetTaskId);
        const taskSnap = await getDoc(taskRef);

        if (taskSnap.exists()) {
          const task = taskSnap.data();
          if (
            normalizeDateKey(task.taskKey || task.date || '') !==
            normalizeDateKey(targetDate)
          ) {
            return renderErrorPage(
              res,
              'The signed task no longer matches the confirmation date.'
            );
          }

          targetTaskName = task.taskOfTheDay || targetTaskName;
          await updateDoc(taskRef, {
            isCompleted,
            completedAt: isCompleted ? nowIso : null,
            updatedAt: nowIso,
          });
        }
      }

      // Exact prompt requirements:
      // “Today’s commitment marked as completed,” or
      // “Today’s commitment marked as not completed.”
      const confirmationHeading = isCompleted
        ? 'Today’s commitment marked as completed'
        : 'Today’s commitment marked as not completed';

      // If client asked for JSON (e.g. fetch call)
      const acceptsJson = req.is('json') || req.headers['accept']?.includes('application/json');
      if (acceptsJson && req.body.format === 'json') {
        clearCapabilityCookie(
          res,
          TASK_CONFIRM_CAPABILITY_COOKIE,
          '/api/task-confirmation'
        );
        return res.json({
          success: true,
          message: confirmationHeading,
          targetDate,
          isCompleted,
          status: targetStatus,
        });
      }

      // Render server-side confirmation success landing page
      const successHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Status Confirmed • System Builder</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background-color: #161f30;
      border: 1px solid #283548;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 36px 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 20px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      font-weight: 900;
    }
    .icon-completed {
      background-color: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 2px solid #10b981;
    }
    .icon-pending {
      background-color: rgba(148, 163, 184, 0.15);
      color: #cbd5e1;
      border: 2px solid #64748b;
    }
    .headline {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.35;
      margin-bottom: 12px;
      color: #ffffff;
    }
    .subtext {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .meta-box {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 28px;
      font-size: 13px;
      text-align: left;
    }
    .meta-item {
      margin-bottom: 10px;
    }
    .meta-item:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .meta-val {
      font-weight: 700;
      color: #f1f5f9;
    }
    .app-btn {
      display: inline-block;
      width: 100%;
      padding: 14px 20px;
      background-color: #0d9488;
      color: #ffffff;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(13, 148, 136, 0.35);
      transition: opacity 0.15s ease;
    }
    .app-btn:hover {
      opacity: 0.95;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle ${isCompleted ? 'icon-completed' : 'icon-pending'}">
      ${isCompleted ? '✓' : '✕'}
    </div>
    
    <h1 class="headline">
      ${escapeHtml(confirmationHeading)}
    </h1>
    
    <p class="subtext">
      Your commitment record has been securely confirmed and saved to the database.
    </p>

    <div class="meta-box">
      <div class="meta-item">
        <div class="meta-label">Date</div>
        <div class="meta-val" style="font-family: monospace;">${escapeHtml(targetDate)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Commitment</div>
        <div class="meta-val">${escapeHtml(targetTaskName)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Recorded Status</div>
        <div class="meta-val" style="color: ${isCompleted ? '#34d399' : '#f87171'};">
          ${isCompleted ? 'Completed (TRUE)' : 'Not Completed (FALSE)'}
        </div>
      </div>
    </div>

    <a href="/" class="app-btn">Open System Builder Dashboard</a>
  </div>
</body>
</html>`;

      clearCapabilityCookie(
        res,
        TASK_CONFIRM_CAPABILITY_COOKIE,
        '/api/task-confirmation'
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8').send(successHtml);
    } catch (err: any) {
      console.error('Error confirming task status:', err);
      renderErrorPage(res, err.message || 'Failed to submit confirmation', 500);
    }
  });

  // 7. Backward compatibility for /confirm path: redirect to /api/task-confirmation
  app.get('/confirm', (req, res) => {
    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(302, `/api/task-confirmation${qs}`);
  });

  // Vite middleware for development or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    startBackgroundScheduler();
  });
}

startServer();
