import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
} from './db';
import { sendDailyConfirmationEmail, EmailTaskDetails, sanitizeError } from './emailService';

export interface NotificationSettingsData {
  id: string;
  enabled: boolean;
  recipientEmail: string;
  recipientName: string;
  scheduledTime: string; // "21:00"
  timezone: string; // "Asia/Kolkata"
  lastSentDate?: string; // "2026-09-08"
  updatedAt?: string;
}

const SETTINGS_COLLECTION = 'notification_settings';
const SETTINGS_DOC_ID = 'daily-settings';
const DAILY_REMINDERS_SENT_COLLECTION = 'daily_reminders_sent';

export const DEFAULT_SETTINGS: NotificationSettingsData = {
  id: SETTINGS_DOC_ID,
  enabled: true,
  recipientEmail: 'sbrafiqahmedali7575@gmail.com',
  recipientName: 'Rafiq Ahmed',
  scheduledTime: '21:00', // 09:00 PM IST
  timezone: 'Asia/Kolkata',
  lastSentDate: '',
  updatedAt: new Date().toISOString(),
};

/**
 * Get current notification settings from Firestore
 */
export async function getNotificationSettings(): Promise<NotificationSettingsData> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as NotificationSettingsData;
    }
    // Initialize default if not existing
    await setDoc(docRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.error('Error reading notification settings:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save notification settings to Firestore
 */
export async function saveNotificationSettings(
  updates: Partial<NotificationSettingsData>
): Promise<NotificationSettingsData> {
  const current = await getNotificationSettings();
  const updated: NotificationSettingsData = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  await setDoc(docRef, updated, { merge: true });
  return updated;
}

/**
 * Helper to get current Date string and Time string in Asia/Kolkata
 */
export function getKolkataTimeInfo(date = new Date()): {
  timeStr: string; // "22:00"
  dateKey: string; // "2026-09-08"
  formattedDate: string; // "8-Sep-2026"
} {
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', // returns YYYY-MM-DD
  });

  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timeStr = timeFormatter.format(date);
  const dateKey = dateFormatter.format(date);
  // Convert "Sep 8, 2026" to "08-Sep-2026"
  const parts = partsFormatter.formatToParts(date);
  const rawDay = parts.find((p) => p.type === 'day')?.value || '';
  const day = rawDay.padStart(2, '0');
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const formattedDate = `${day}-${month}-${year}`;

  return { timeStr, dateKey, formattedDate };
}

/**
 * Find today's task or daily record from Firestore
 */
export async function findTodayTaskOrRecord(): Promise<{
  record?: any;
  task?: any;
  tasks?: any[];
  taskDetails?: EmailTaskDetails;
} | null> {
  const { dateKey, formattedDate } = getKolkataTimeInfo();

  try {
    const tasksSnap = await getDocs(collection(db, 'tasks'));
    const matchedTasks: any[] = [];
    tasksSnap.forEach((d) => {
      const t = d.data();
      const taskKey = String(t.taskKey || t.date || '').trim();
      if (taskKey === dateKey || taskKey === formattedDate) {
        matchedTasks.push({ id: d.id, ...t });
      }
    });
    matchedTasks.sort((x, y) =>
      String(x.updatedAt || x.id).localeCompare(String(y.updatedAt || y.id))
    );

    const recordsSnap = await getDocs(collection(db, 'records'));
    let matchedRecord: any = null;
    let highestDay = -1;

    recordsSnap.forEach((d) => {
      const r = d.data();
      const rec = { id: d.id, ...r };
      const rDate = String(r.date || '').toLowerCase().trim();
      const targetDate = formattedDate.toLowerCase();
      const normRDate = rDate.replace(/^0(\d)/, '$1');
      const normTargetDate = targetDate.replace(/^0(\d)/, '$1');

      if (
        rDate === targetDate ||
        normRDate === normTargetDate ||
        rDate.replace(/-20(\d\d)$/, '-$1') === targetDate.replace(/-20(\d\d)$/, '-$1')
      ) {
        matchedRecord = rec;
      }

      const dayNum = Number(r.day || 0);
      if (dayNum > highestDay) highestDay = dayNum;
    });

    const nextDayNum = highestDay > 0 ? highestDay + 1 : 1;
    const primaryTask = matchedTasks[0];
    const taskName =
      matchedTasks.length > 1
        ? `${matchedTasks.length} tasks scheduled`
        : primaryTask?.taskOfTheDay ||
          matchedRecord?.summary ||
          `Day ${matchedRecord?.day || nextDayNum} Daily Task`;

    const allTasksCompleted =
      matchedTasks.length > 0 && matchedTasks.every((task) => Boolean(task.isCompleted));

    return {
      record: matchedRecord,
      task: primaryTask,
      tasks: matchedTasks,
      taskDetails: {
        recordId: matchedRecord?.id || `rec-${dateKey}`,
        taskId: primaryTask?.id || `review-${dateKey}`,
        taskDate: formattedDate,
        taskName,
        isCompleted: matchedTasks.length > 0 ? allTasksCompleted : Boolean(matchedRecord?.isCompleted),
        tasks: matchedTasks.map((task) => ({
          id: task.id,
          title: String(task.taskOfTheDay || 'Daily Task'),
          isCompleted: Boolean(task.isCompleted),
        })),
      },
    };
  } catch (err) {
    console.error('Error finding today tasks or record:', sanitizeError(err));
    return null;
  }
}

export interface TriggerDailyReminderResult {
  success: boolean;
  alreadySent?: boolean;
  date: string;
  taskId: string;
  recipient: string;
  messageId?: string;
  taskName?: string;
  status?: string;
  previewLinks?: {
    completedUrl: string;
    notCompletedUrl: string;
  };
  error?: string;
  message?: string;
  sentAt?: string;
}

// Process-level cache of active in-flight dispatch promises to prevent concurrent double sends
const activeDispatchPromises = new Map<string, Promise<TriggerDailyReminderResult>>();

/**
 * Executes the daily reminder dispatch with persistent deduplication for Asia/Kolkata date.
 * Uses atomic Firestore transactions and in-process locking so that even if triggered
 * simultaneously by GitHub Actions and background timers, only ONE email will ever be sent.
 */
export async function triggerDailyReminder(options?: {
  force?: boolean;
  recipientOverride?: string;
  respectSchedule?: boolean;
}): Promise<TriggerDailyReminderResult> {
  const { timeStr, dateKey, formattedDate } = getKolkataTimeInfo();
  const settings = await getNotificationSettings();
  const targetRecipient =
    options?.recipientOverride || settings.recipientEmail || 'sbrafiqahmedali7575@gmail.com';
  const force = Boolean(options?.force);
  const respectSchedule = Boolean(options?.respectSchedule);

  if (!force && !settings.enabled) {
    return {
      success: true,
      alreadySent: false,
      date: formattedDate,
      taskId: '',
      recipient: targetRecipient,
      status: 'disabled',
      message: 'Daily confirmation emails are disabled in notification settings.',
    };
  }

  if (!force && respectSchedule) {
    const scheduled = settings.scheduledTime || '21:00';
    const [schedH, schedM] = scheduled.split(':').map(Number);
    const [curH, curM] = timeStr.split(':').map(Number);
    const schedMins = schedH * 60 + schedM;
    const curMins = curH * 60 + curM;

    if (curMins < schedMins) {
      return {
        success: true,
        alreadySent: false,
        date: formattedDate,
        taskId: '',
        recipient: targetRecipient,
        status: 'not_due',
        message: `Reminder is scheduled for ${scheduled} IST and is not due yet.`,
      };
    }
  }

  // 1. In-process mutex: If a dispatch is currently running for this dateKey in this Node process, join it
  if (!force && activeDispatchPromises.has(dateKey)) {
    console.log(`[Scheduler] In-flight dispatch already running for ${dateKey}, awaiting existing promise.`);
    return await activeDispatchPromises.get(dateKey)!;
  }

  const dispatchPromise = (async (): Promise<TriggerDailyReminderResult> => {
    // 2. Check persistent record in Firestore and acquire distributed atomic lock
    if (!force) {
      try {
        const lockRef = doc(db, DAILY_REMINDERS_SENT_COLLECTION, dateKey);
        const lockResult = await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(lockRef);
          if (snap.exists()) {
            const data = snap.data();
            // If already sent or delivered
            if (data.status === 'delivered' || data.status === 'sent') {
              return { acquired: false, alreadySent: true, data };
            }
            // If another worker/process is currently in the middle of sending
            if (data.status === 'in_progress' || data.status === 'sending') {
              const lockedAt = new Date(data.lockedAt || data.sentAt || 0).getTime();
              const elapsedMs = Date.now() - lockedAt;
              // If lock was acquired less than 5 minutes ago, respect the lock
              if (elapsedMs < 5 * 60 * 1000) {
                return { acquired: false, alreadySent: true, inProgress: true, data };
              }
            }
          }

          // Also check settings.lastSentDate
          if (settings.lastSentDate === dateKey || settings.lastSentDate === formattedDate) {
            return { acquired: false, alreadySent: true, reason: 'settings_already_sent' };
          }

          // Atomically acquire the lock BEFORE sending the email
          transaction.set(
            lockRef,
            {
              id: dateKey,
              dateKey,
              formattedDate,
              recipient: targetRecipient,
              status: 'in_progress',
              lockedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          return { acquired: true };
        });

        if (!lockResult.acquired) {
          const existing = lockResult.data || {};
          console.log(
            `[Scheduler] Reminder for ${formattedDate} (${dateKey}) is already sent or in-flight. Skipping duplicate email.`
          );
          return {
            success: true,
            alreadySent: true,
            message: `Daily reminder has already been sent (or is in-flight) for IST date ${formattedDate}. Duplicate skipped.`,
            date: formattedDate,
            taskId: existing.taskId || '',
            recipient: existing.recipient || targetRecipient,
            messageId: existing.messageId || '',
            taskName: existing.taskName,
            sentAt: existing.sentAt || existing.lockedAt,
            status: existing.status || 'delivered',
          };
        }
      } catch (err) {
        console.warn('Warning acquiring distributed atomic lock in Firestore:', sanitizeError(err));
      }
    }

    // 3. Retrieve today's task using Asia/Kolkata timezone
    const todayData = await findTodayTaskOrRecord();

    const taskDetails: EmailTaskDetails = todayData?.taskDetails || {
      recordId: `rec-${dateKey}`,
      taskId: `task-${dateKey}`,
      taskDate: formattedDate,
      taskName: 'Daily Task: Show up every day to build lasting consistency',
      isCompleted: false,
      recipientEmail: targetRecipient,
      recipientName: settings.recipientName || 'Rafiq Ahmed',
    };

    // Ensure recipient is set correctly
    taskDetails.recipientEmail = targetRecipient;
    if (settings.recipientName) {
      taskDetails.recipientName = settings.recipientName;
    }

    // 4. Send daily confirmation email
    const sendResult = await sendDailyConfirmationEmail(taskDetails, undefined, targetRecipient);

    // 5. Only a real SMTP delivery may seal the reminder as sent.
    if (!sendResult.success || sendResult.status !== 'delivered') {
      const cleanError = sanitizeError(
        sendResult.error ||
          (sendResult.status === 'pending_configuration'
            ? 'Email provider is not configured.'
            : 'Failed to dispatch email via SMTP provider.')
      );

      try {
        await setDoc(
          doc(db, DAILY_REMINDERS_SENT_COLLECTION, dateKey),
          {
            status: sendResult.status === 'pending_configuration' ? 'pending_configuration' : 'failed',
            error: cleanError,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (lockReleaseErr) {
        console.warn('Failed to release reminder lock after email failure:', lockReleaseErr);
      }

      return {
        success: false,
        date: formattedDate,
        taskId: taskDetails.taskId || taskDetails.recordId,
        recipient: targetRecipient,
        taskName: taskDetails.taskName,
        status: sendResult.status,
        error: cleanError,
        previewLinks: sendResult.previewLinks,
      };
    }

    // 6. If sent successfully, seal persistent records marking it delivered and preventing any duplicates
    const nowIso = new Date().toISOString();
    const reminderRecord = {
      id: formattedDate,
      dateKey,
      formattedDate,
      recipient: targetRecipient,
      taskId: taskDetails.taskId || taskDetails.recordId,
      taskName: taskDetails.taskName,
      status: 'delivered',
      messageId: sendResult.messageId || '',
      sentAt: nowIso,
    };

    try {
      await Promise.all([
        setDoc(doc(db, DAILY_REMINDERS_SENT_COLLECTION, formattedDate), reminderRecord, { merge: true }),
        setDoc(doc(db, DAILY_REMINDERS_SENT_COLLECTION, dateKey), { ...reminderRecord, id: dateKey }, { merge: true }),
        saveNotificationSettings({ lastSentDate: dateKey }),
      ]);
    } catch (err) {
      console.error('Failed to store persistent deduplication record in Firestore:', sanitizeError(err));
    }

    return {
      success: true,
      alreadySent: false,
      date: formattedDate,
      taskId: taskDetails.taskId || taskDetails.recordId,
      recipient: targetRecipient,
      messageId: sendResult.messageId || '',
      taskName: taskDetails.taskName,
      status: 'delivered',
      previewLinks: sendResult.previewLinks,
      sentAt: nowIso,
    };
  })();

  if (!force) {
    activeDispatchPromises.set(dateKey, dispatchPromise);
    dispatchPromise.finally(() => {
      // Keep in cache for 2 minutes to prevent rapid successive double calls
      setTimeout(() => {
        activeDispatchPromises.delete(dateKey);
      }, 120000);
    });
  }

  return await dispatchPromise;
}

/**
 * Starts an in-memory background runner that checks the time every 30 seconds.
 * Strictly verifies whether today's reminder has already been sent before triggering,
 * preventing multiple emails from being dispatched around 9:00 PM IST.
 */
export function startBackgroundScheduler(): void {
  console.log('[Background Scheduler] Started: monitoring Asia/Kolkata daily reminder triggers.');

  let isChecking = false;
  let localLastDispatchedDate = '';

  const runCheck = async () => {
    if (isChecking) return;
    isChecking = true;
    try {
      const { timeStr, dateKey, formattedDate } = getKolkataTimeInfo();

      // If already dispatched today by this local instance, skip immediately
      if (localLastDispatchedDate === dateKey || localLastDispatchedDate === formattedDate) {
        return;
      }

      const settings = await getNotificationSettings();

      if (!settings.enabled) {
        return;
      }

      // If settings indicate today's reminder was already sent, update local cache and skip
      if (settings.lastSentDate === dateKey || settings.lastSentDate === formattedDate) {
        localLastDispatchedDate = dateKey;
        return;
      }

      const scheduled = settings.scheduledTime || '21:00';
      const [schedH, schedM] = scheduled.split(':').map(Number);
      const [curH, curM] = timeStr.split(':').map(Number);

      const schedMins = schedH * 60 + schedM;
      const curMins = curH * 60 + curM;

      // Only run if current time is at or past scheduled time
      if (curMins >= schedMins) {
        // Record date immediately to prevent repeating checks during async execution
        localLastDispatchedDate = dateKey;
        const result = await triggerDailyReminder({ force: false, respectSchedule: false });
        if (result.success && !result.alreadySent) {
          console.log(
            `[Background Scheduler] Auto-dispatched daily reminder for ${formattedDate} (${timeStr} IST) to ${result.recipient}`
          );
        }
      }
    } catch (err) {
      console.warn('[Background Scheduler] Check error:', sanitizeError(err));
    } finally {
      isChecking = false;
    }
  };

  // Run initial check after 3 seconds
  setTimeout(runCheck, 3000);
  // Then run periodically every 30 seconds
  setInterval(runCheck, 30000);
}

