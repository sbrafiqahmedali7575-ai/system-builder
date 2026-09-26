import nodemailer from 'nodemailer';
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
  const reviewUrl = `${baseUrl}/?review=1`;
  const tasks = details.tasks || [];
  const completedCount = tasks.filter((task) => task.isCompleted).length;
  const progressPercent =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const subject = 'System Builder • Today’s task status';

  const taskRows =
    tasks.length > 0
      ? tasks
          .map(
            (task) => `
              <tr>
                <td class="email-task" style="padding:14px 14px;border-bottom:1px solid #e2e8f0;font-size:16px;line-height:1.5;color:#000000;font-weight:800;">
                  ${escapeHtml(task.title)}
                </td>
                <td class="email-status" style="padding:14px 14px;border-bottom:1px solid #e2e8f0;width:132px;text-align:right;vertical-align:middle;">
                  <span style="display:inline-block;padding:6px 9px;border-radius:999px;font-size:12px;line-height:1;font-weight:900;color:#000000;background:${task.isCompleted ? '#bbf7d0' : '#fde68a'};">
                    ${task.isCompleted ? 'Completed' : 'Not Completed'}
                  </span>
                </td>
              </tr>`
          )
          .join('')
      : `
        <tr>
          <td colspan="2" class="email-task" style="padding:16px;color:#000000;font-size:15px;font-weight:800;">
            No tasks are scheduled for today.
          </td>
        </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style>
    html,body{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}
    @media only screen and (max-width:520px){
      .email-shell{padding:12px 6px!important}
      .email-card{border-radius:12px!important}
      .email-head{padding:16px!important}
      .email-body{padding:20px 16px!important}
      .email-title{font-size:23px!important;line-height:1.25!important}
      .email-copy{font-size:15px!important;line-height:1.55!important}
      .email-section-title{font-size:15px!important}
      .email-task{font-size:15px!important;line-height:1.5!important}
      .email-status{font-size:13px!important}
      .email-footer{font-size:12px!important;padding:14px 16px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table class="email-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe3ee;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
          <tr>
            <td class="email-head" style="padding:18px 22px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <a href="${baseUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#0f172a;">
                            <span style="display:inline-flex;width:36px;height:36px;border-radius:11px;background:#2563eb;color:#ffffff;align-items:center;justify-content:center;font-size:18px;font-weight:900;line-height:36px;text-align:center;">S</span>
                            <span style="font-size:18px;font-weight:900;color:#0f172a;">System Builder</span>
                          </a>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <a href="${reviewUrl}" target="_blank" title="Review current day" style="display:inline-flex;align-items:center;gap:5px;text-decoration:none;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 10px;color:#1d4ed8;font-size:12px;font-weight:900;">
                            <span style="font-size:16px;line-height:1;">☑</span>
                            <span>Review</span>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;font-size:12px;color:#64748b;font-family:monospace;">
                    ${escapeHtml(details.taskDate)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-body" style="padding:24px 26px;">
              <h1 class="email-title" style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:900;">Today’s Tasks</h1>
              <p class="email-copy" style="margin:0 0 16px;color:#000000;font-size:15px;line-height:1.6;font-weight:800;">
                ${completedCount} of ${tasks.length} tasks currently completed.
              </p>

              <div style="margin:0 0 20px;padding:14px;border:1px solid #dbeafe;border-radius:12px;background:#eff6ff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="font-size:13px;font-weight:900;color:#0f172a;">Overall Status</td>
                    <td align="right" style="font-size:13px;font-weight:900;color:#2563eb;font-family:monospace;">${progressPercent}%</td>
                  </tr>
                </table>
                <div style="width:100%;height:10px;border-radius:999px;background:#dbeafe;overflow:hidden;">
                  <div style="width:${progressPercent}%;height:10px;border-radius:999px;background:#2563eb;"></div>
                </div>
                <div style="margin-top:7px;font-size:12px;font-weight:800;color:#475569;">
                  ${completedCount} / ${tasks.length} completed
                </div>
              </div>

              <div class="email-section-title" style="margin:0 0 8px;color:#000000;font-size:15px;font-weight:900;">
                Current Day Tasks &amp; Status
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${taskRows}
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-footer" style="padding:16px 26px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;color:#475569;font-size:13px;font-weight:800;">
              Open System Builder to review and mark the current day.
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
      ? tasks
          .map((task) => `${task.title} — ${task.isCompleted ? 'Completed' : 'Not Completed'}`)
          .join('\n')
      : 'No tasks are scheduled for today.';

  const text = `System Builder — Today’s Task Status

Date: ${details.taskDate}
Overall Status: ${progressPercent}% (${completedCount}/${tasks.length} completed)

${taskText}

Open System Builder:
${baseUrl}
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
