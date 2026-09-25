import crypto from 'crypto';

function getSecretKey(): string {
  return (
    process.env.CONFIRMATION_SECRET ||
    'commit-daily-rafiq-secure-token-secret-2026-auth-sign'
  );
}

export interface ConfirmationTokenPayload {
  userId: string;
  taskId: string;
  recordId: string;
  taskDate: string;
  status: 'completed' | 'pending';
  action?: 'completed' | 'not_completed' | 'pending';
  exp: number; // Unix timestamp ms
  nonce: string;
}

export function generateConfirmationToken(
  params: {
    userId?: string;
    taskId: string;
    recordId?: string;
    taskDate: string;
    status: 'completed' | 'pending';
  },
  expiresInDays: number = 30
): string {
  const exp = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload: ConfirmationTokenPayload = {
    userId: params.userId || 'rafiq',
    taskId: params.taskId,
    recordId: params.recordId || params.taskId,
    taskDate: params.taskDate,
    status: params.status,
    action: params.status === 'completed' ? 'completed' : 'not_completed',
    exp,
    nonce,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(payloadB64);
  const signature = hmac.digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyConfirmationToken(token: string): {
  valid: boolean;
  payload?: ConfirmationTokenPayload;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [payloadB64, signature] = parts;

  try {
    const hmac = crypto.createHmac('sha256', getSecretKey());
    hmac.update(payloadB64);
    const expectedSignature = hmac.digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload: ConfirmationTokenPayload = JSON.parse(payloadJson);

    // Normalize status if older token format
    if (!payload.status && payload.action) {
      payload.status = payload.action === 'completed' ? 'completed' : 'pending';
    }

    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Confirmation link has expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Token verification failed' };
  }
}
