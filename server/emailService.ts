import nodemailer from 'nodemailer';
import { generateDailyReviewToken } from './tokenService';
import { db, collection, doc, setDoc } from './db';

const DELIVERY_LOGS_COLLECTION = 'delivery_logs';

export interface EmailTaskDetails {
  recordId: string;
  taskId?: string;
  taskDate: string; // e.g. "09-Sep-2026"
  taskName: string;
  isCompleted: boolean;
  tasks?: Array<{
    id: string;
    title: string;
    isCompleted: boolean;
  }>;
  recipientEmail?: string;
  recipientName?: string;
}

export interface SendEmailResult {
  success: boolean;
  status: 'delivered' | 'failed' | 'pending_configuration' | 'simulated';
  provider: 'smtp' | 'simulator';
  messageId?: string;
  error?: string;
  previewLinks?: {
    reviewUrl?: string;
    completedUrl?: string;
    notCompletedUrl?: string;
  };
  emailHtml?: string;
}

export function sanitizeError(rawMessage: any): string {
  if (!rawMessage) return 'Unknown delivery error';
  let sanitized = typeof rawMessage === 'string' ? rawMessage : (rawMessage?.message || String(rawMessage));

  const secrets = [
    process.env.SMTP_PASS,
    process.env.CONFIRMATION_SECRET,
    process.env.SCHEDULER_SECRET,
    process.env.GEMINI_API_KEY,
  ].filter((s): s is string => Boolean(s && s.trim().length > 0));

  for (const s of secrets) {
    if (s.length >= 3) {
      sanitized = sanitized.split(s).join('***REDACTED***');
      const noSpace = s.replace(/\s+/g, '');
      if (noSpace !== s && noSpace.length >= 3) {
        sanitized = sanitized.split(noSpace).join('***REDACTED***');
      }
    }
  }

  // Redact any password or secret assignment in SMTP debug output
  sanitized = sanitized.replace(/(password|pass|auth|secret|token)\s*[:=]\s*["']?([^\s"',;]+)["']?/gi, '$1: "***REDACTED***"');

  return sanitized;
}

const CURRENT_APP_BASE_URL = 'https://systembuilder08.ai.studio';

/**
 * Returns the canonical public production URL for all email links.
 * Keep this authoritative so a stale APP_BASE_URL deployment variable cannot
 * send users to the retired rafiqcommitdaily.ai.studio domain.
 */
export function getAppBaseUrl(): string {
  return CURRENT_APP_BASE_URL;
}

/**
 * Check whether Gmail SMTP is configured via environment variables.
 * Never exposes passwords or sensitive credentials.
 */
export function getEmailProviderStatus(): {
  isConfigured: boolean;
  provider: 'smtp' | 'none';
  fromEmail: string;
  smtpConfigured: boolean;
  smtpDetails: {
    hostSet: boolean;
    userSet: boolean;
    passSet: boolean;
    port: number;
    hostName?: string;
  };
} {
  const rawHost = process.env.SMTP_HOST;
  const smtpHost = rawHost ? rawHost.replace(/gamil/i, 'gmail').trim() : '';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  const hostSet = Boolean(smtpHost && smtpHost.trim().length > 0);
  const userSet = Boolean(smtpUser && smtpUser.trim().length > 0);
  const passSet = Boolean(smtpPass && smtpPass.trim().length > 0);
  const smtpConfigured = hostSet && userSet && passSet;

  const provider: 'smtp' | 'none' = smtpConfigured ? 'smtp' : 'none';

  let fromEmail = process.env.EMAIL_FROM;
  if (!fromEmail || !fromEmail.trim()) {
    if (smtpUser && smtpUser.includes('@')) {
      fromEmail = `System Builder <${smtpUser}>`;
    } else {
      fromEmail = 'System Builder <sbrafiqahmedali7575@gmail.com>';
    }
  }

  return {
    isConfigured: smtpConfigured,
    provider,
    fromEmail,
    smtpConfigured,
    smtpDetails: {
      hostSet,
      userSet,
      passSet,
      port: smtpPort,
      hostName: smtpHost || undefined,
    },
  };
}

/**
 * Generate full HTML email for Rafiq's daily task confirmation.
 * Strictly uses public production base URL and server-side /api/task-confirmation endpoint.
 */
function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildDailyConfirmationEmail(
  details: EmailTaskDetails,
  _ignoredBaseUrl?: string
): {
  subject: string;
  html: string;
  text: string;
  reviewUrl: string;
} {
  const baseUrl = getAppBaseUrl();
  const tasks = details.tasks || [];

  const reviewToken = generateDailyReviewToken({
    userId: 'rafiq',
    taskDate: details.taskDate,
    recordId: details.recordId,
    taskIds: tasks.map((task) => task.id),
  });

  const reviewUrl = `${baseUrl}/api/daily-review?token=${encodeURIComponent(reviewToken)}`;
  const completedCount = tasks.filter((task) => task.isCompleted).length;
  const subject = `System Builder • Review today’s tasks`;

  const taskRows =
    tasks.length > 0
      ? tasks
          .map(
            (task) => `
              <tr>
                <td style="padding:11px 12px;border-bottom:1px solid #273449;width:30px;vertical-align:top;font-size:19px;color:#e2e8f0;">
                  ${task.isCompleted ? '☑' : '☐'}
                </td>
                <td style="padding:11px 12px;border-bottom:1px solid #273449;color:#f1f5f9;font-size:14px;line-height:1.45;">
                  ${escapeHtml(task.title)}
                </td>
              </tr>`
          )
          .join('')
      : `
        <tr>
          <td style="padding:16px;color:#94a3b8;font-size:14px;">
            No tasks are scheduled for today.
          </td>
        </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:22px 26px;border-bottom:1px solid #334155;">
              <div style="font-size:20px;font-weight:900;color:#fff;">System Builder</div>
              <div style="margin-top:5px;font-size:12px;color:#94a3b8;font-family:monospace;">${escapeHtml(details.taskDate)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 26px;">
              <h1 style="margin:0 0 8px;font-size:21px;line-height:1.3;color:#fff;">Today’s Tasks</h1>
              <p style="margin:0 0 18px;color:#cbd5e1;font-size:14px;line-height:1.55;">
                ${completedCount} of ${tasks.length} currently checked. Open the checklist, update any boxes, then submit your response for the day.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:22px;">
                ${taskRows}
              </table>

              <a href="${reviewUrl}" target="_blank" style="display:block;background:#2563eb;color:#fff;text-decoration:none;text-align:center;font-size:14px;font-weight:800;padding:14px 18px;border-radius:10px;">
                Review Checkboxes &amp; Submit
              </a>

              <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
                If all tasks are checked when you submit, the day is marked Completed. If any task is unchecked, the day is marked Not Completed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 26px;border-top:1px solid #334155;background:#0f172a;text-align:center;color:#64748b;font-size:12px;">
              System Builder • Daily task response
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const taskText =
    tasks.length > 0
      ? tasks.map((task) => `${task.isCompleted ? '[x]' : '[ ]'} ${task.title}`).join('\n')
      : 'No tasks are scheduled for today.';

  const text = `System Builder — Today’s Tasks

Date: ${details.taskDate}

${taskText}

Review checkboxes and submit:
${reviewUrl}

All checked = Completed.
Any unchecked = Not Completed.
`;

  return { subject, html, text, reviewUrl };
}

/**
 * Send the daily task confirmation email using Gmail SMTP with STARTTLS (port 587)
 */
export async function sendDailyConfirmationEmail(
  details: EmailTaskDetails,
  _ignoredBaseUrl?: string,
  recipientOverride?: string
): Promise<SendEmailResult> {
  const providerInfo = getEmailProviderStatus();
  const recipient = recipientOverride || details.recipientEmail || 'sbrafiqahmedali7575@gmail.com';
  const emailContent = buildDailyConfirmationEmail(details);

  const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  // If Gmail SMTP is configured
  if (providerInfo.provider === 'smtp') {
    try {
      const rawHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const host = rawHost.replace(/gamil/i, 'gmail').trim();
      const user = (process.env.SMTP_USER || '').trim();
      const rawPass = process.env.SMTP_PASS || '';
      // Gmail app passwords usually come with spaces; strip whitespace for authentication
      const cleanPass = host.includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass.trim();
      const port = Number(process.env.SMTP_PORT || 587);

      // Explicitly configure SMTP port 587 with STARTTLS
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false, // port 587 begins in plaintext and upgrades via STARTTLS
        requireTLS: true, // enforce STARTTLS encryption before sending credentials
        auth: {
          user,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      let senderAddress = providerInfo.fromEmail;
      if (senderAddress && !senderAddress.includes('<')) {
        senderAddress = `System Builder <${senderAddress}>`;
      }

      const info = await transporter.sendMail({
        from: senderAddress,
        to: recipient,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      await logDeliveryToCloud({
        id: logId,
        recipient,
        subject: emailContent.subject,
        date: details.taskDate,
        taskTitle: details.taskName,
        status: 'delivered',
        provider: 'smtp',
        sentAt: nowIso,
      });

      return {
        success: true,
        status: 'delivered',
        provider: 'smtp',
        messageId: info.messageId,
        previewLinks: {
          reviewUrl: emailContent.reviewUrl,
        },
      };
    } catch (err: any) {
      const safeErrorMessage = sanitizeError(err?.message || err);
      await logDeliveryToCloud({
        id: logId,
        recipient,
        subject: emailContent.subject,
        date: details.taskDate,
        taskTitle: details.taskName,
        status: 'failed',
        provider: 'smtp',
        error: safeErrorMessage,
        sentAt: nowIso,
      });

      return {
        success: false,
        status: 'failed',
        provider: 'smtp',
        error: safeErrorMessage,
        previewLinks: {
          reviewUrl: emailContent.reviewUrl,
        },
      };
    }
  }

  // Not configured: Log as pending_configuration and return preview
  await logDeliveryToCloud({
    id: logId,
    recipient,
    subject: emailContent.subject,
    date: details.taskDate,
    taskTitle: details.taskName,
    status: 'pending_configuration',
    provider: 'simulator',
    error: 'Gmail SMTP credentials awaiting configuration in server environment settings.',
    sentAt: nowIso,
  });

  return {
    success: true,
    status: 'pending_configuration',
    provider: 'simulator',
    error: 'Awaiting Gmail SMTP credentials in Settings',
    previewLinks: {
      reviewUrl: emailContent.reviewUrl,
    },
    emailHtml: emailContent.html,
  };
}

async function logDeliveryToCloud(logEntry: {
  id: string;
  recipient: string;
  subject: string;
  date: string;
  taskTitle?: string;
  status: string;
  provider: string;
  error?: string;
  sentAt: string;
}) {
  try {
    const docRef = doc(db, DELIVERY_LOGS_COLLECTION, logEntry.id);
    await setDoc(docRef, logEntry);
  } catch (err) {
    console.error('Failed to log email delivery to Firestore:', err);
  }
}
