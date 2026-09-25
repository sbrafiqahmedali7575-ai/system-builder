import crypto from 'crypto';

function getSecretKey(): string {
  const secret = (process.env.CONFIRMATION_SECRET || '').trim();
  if (secret.length < 32) {
    throw new Error('CONFIRMATION_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

export interface ConfirmationTokenPayload {
  userId: string;
  taskId: string;
  recordId: string;
  taskDate: string;
  status?: 'completed' | 'pending';
  action?: 'completed' | 'not_completed' | 'pending' | 'review';
  taskIds?: string[];
  exp: number;
  nonce: string;
}

function signPayload(payload: ConfirmationTokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(payloadB64);
  const signature = hmac.digest('base64url');
  return `${payloadB64}.${signature}`;
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
  const payload: ConfirmationTokenPayload = {
    userId: params.userId || 'rafiq',
    taskId: params.taskId,
    recordId: params.recordId || params.taskId,
    taskDate: params.taskDate,
    status: params.status,
    action: params.status === 'completed' ? 'completed' : 'not_completed',
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  return signPayload(payload);
}

export function generateDailyReviewToken(
  params: {
    userId?: string;
    taskDate: string;
    recordId?: string;
    taskIds?: string[];
  },
  expiresInDays: number = 7
): string {
  const taskIds = Array.from(new Set(params.taskIds || [])).filter(Boolean);
  const reviewId = `review-${params.taskDate}`;
  const payload: ConfirmationTokenPayload = {
    userId: params.userId || 'rafiq',
    taskId: reviewId,
    recordId: params.recordId || reviewId,
    taskDate: params.taskDate,
    action: 'review',
    taskIds,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  return signPayload(payload);
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

    if (payload.action !== 'review' && !payload.status && payload.action) {
      payload.status = payload.action === 'completed' ? 'completed' : 'pending';
    }

    if (!payload.taskDate || !payload.exp) {
      return { valid: false, error: 'Confirmation token is missing required fields' };
    }

    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Confirmation link has expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Token verification failed' };
  }
}
