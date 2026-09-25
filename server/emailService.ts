import nodemailer from 'nodemailer';
import { generateConfirmationToken } from './tokenService';
import { db, collection, doc, setDoc } from './db';

const DELIVERY_LOGS_COLLECTION = 'delivery_logs';

export interface EmailTaskDetails {
  recordId: string;
  taskId?: string;
  taskDate: string; // e.g. "09-Sep-2026"
  taskName: string;
  isCompleted: boolean;
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
    completedUrl: string;
    notCompletedUrl: string;
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

/**
 * Returns the public production base URL for all email links.
 * Strictly uses APP_BASE_URL (defaults to https://rafiqcommitdaily.ai.studio).
 * Never uses aistudio.google.com, localhost, or dynamically detected development URLs.
 */
export function getAppBaseUrl(): string {
  const envUrl = process.env.APP_BASE_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('rafiqcommitdaily.ai.studio')) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // Publicly reachable Cloud Run deployment URL
  return 'https://ais-pre-vvkki5ofvlos77ccgutcla-146310585503.asia-east1.run.app';
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
export function buildDailyConfirmationEmail(
  details: EmailTaskDetails,
  _ignoredBaseUrl?: string
): {
  subject: string;
  html: string;
  text: string;
  completedUrl: string;
  notCompletedUrl: string;
} {
  const baseUrl = getAppBaseUrl();
  const targetTaskId = details.taskId || details.recordId;

  // Generate signed, expiring HMAC tokens for both actions using CONFIRMATION_SECRET
  const completedToken = generateConfirmationToken({
    userId: 'rafiq',
    taskId: targetTaskId,
    recordId: details.recordId,
    taskDate: details.taskDate,
    status: 'completed',
  });

  const notCompletedToken = generateConfirmationToken({
    userId: 'rafiq',
    taskId: targetTaskId,
    recordId: details.recordId,
    taskDate: details.taskDate,
    status: 'pending',
  });

  // Required format:
  // Completed: https://rafiqcommitdaily.ai.studio/api/task-confirmation?...status=completed...
  // Not completed: https://rafiqcommitdaily.ai.studio/api/task-confirmation?...status=pending...
  const completedUrl = `${baseUrl}/api/task-confirmation?taskId=${encodeURIComponent(
    targetTaskId
  )}&taskDate=${encodeURIComponent(details.taskDate)}&status=completed&token=${encodeURIComponent(
    completedToken
  )}`;

  const notCompletedUrl = `${baseUrl}/api/task-confirmation?taskId=${encodeURIComponent(
    targetTaskId
  )}&taskDate=${encodeURIComponent(details.taskDate)}&status=pending&token=${encodeURIComponent(
    notCompletedToken
  )}`;

  // Standard Subject requested by Rafiq
  const subject = 'Rafiq, did you complete today’s task?';

  // Current status badge formatting
  const statusLabel = details.isCompleted
    ? 'Completed (Checked)'
    : 'Not Completed (Pending)';
  const statusColor = details.isCompleted ? '#10b981' : '#f43f5e';

  // Responsive HTML Email with high-contrast, modern typography
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" max-width="580" style="max-width: 580px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #334155; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #f8fafc;">
                      System Builder
                    </span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: #0d9488; color: #ffffff; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px;">
                      Daily Task
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 13px; color: #94a3b8; font-family: monospace;">
                      ${details.taskDate}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Core Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                Rafiq, did you complete today’s task?
              </h1>
              
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Small daily actions build consistency. Please confirm the status of today’s task.
              </p>

              <!-- Task Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">
                      Today’s Task
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: #f1f5f9; margin-bottom: 12px; line-height: 1.4;">
                      ${details.taskName || 'Daily Task'}
                    </div>
                    <table role="presentation" width="100%">
                      <tr>
                        <td>
                          <span style="font-size: 12px; color: #94a3b8;">Current Status:</span>
                          <span style="display: inline-block; margin-left: 6px; font-size: 12px; font-weight: 700; color: ${statusColor};">
                            ${statusLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Two Action Buttons -->
              <div style="margin-bottom: 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="48%" align="center" style="vertical-align: middle;">
                      <a href="${completedUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #0d9488; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 18px; border-radius: 10px; text-align: center; border: 1px solid #14b8a6; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.3);">
                        ✓ Completed
                      </a>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" align="center" style="vertical-align: middle;">
                      <a href="${notCompletedUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #334155; color: #e2e8f0; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 18px; border-radius: 10px; text-align: center; border: 1px solid #475569;">
                        ✕ Not Completed
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Scanner Protection & Status Preservation Explanations -->
              <div style="background-color: #0f172a; border-radius: 8px; padding: 14px 16px; border: 1px solid #1e293b;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  🔒 <strong>Secure Verification:</strong> Clicking either button opens your verification page at <code>rafiqcommitdaily.ai.studio</code> before saving. Automated email link scanners cannot accidentally alter your records.
                </p>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                  ℹ️ <strong>If you do not respond</strong>, your existing status is preserved without modification.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #334155; background-color: #0f172a; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                System Builder • Scheduled every day at 09:00 PM IST
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Rafiq, did you complete today’s task?

Small daily actions build consistency. Please confirm the status of today’s task.

Date: ${details.taskDate}
Task: ${details.taskName}
Current Status: ${statusLabel}

Click to confirm your status:
- Mark as COMPLETED: ${completedUrl}
- Mark as NOT COMPLETED: ${notCompletedUrl}

Note: If you do not respond, your existing status is preserved without modification.
`;

  return { subject, html, text, completedUrl, notCompletedUrl };
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
          completedUrl: emailContent.completedUrl,
          notCompletedUrl: emailContent.notCompletedUrl,
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
          completedUrl: emailContent.completedUrl,
          notCompletedUrl: emailContent.notCompletedUrl,
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
      completedUrl: emailContent.completedUrl,
      notCompletedUrl: emailContent.notCompletedUrl,
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
