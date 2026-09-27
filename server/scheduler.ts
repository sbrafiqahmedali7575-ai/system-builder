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
const SMTP_RETRY_BACKOFF_MS = 2 * 60 * 1000;

export function parseScheduledMinutes(value: string | undefined): number {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 21 * 60;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return 21 * 60;
  }

  return hour * 60 + minute;
}

const defaultNotificationEmail = String(
  process.env.DEFAULT_NOTIFICATION_EMAIL || ''
).trim();

export const DEFAULT_SETTINGS: NotificationSettingsData = {
  id: SETTINGS_DOC_ID,
  enabled: Boolean(defaultNotificationEmail),
  recipientEmail: defaultNotificationEmail,
  recipientName: String(process.env.DEFAULT_NOTIFICATION_NAME || 'Owner').trim() || 'Owner',
  scheduledTime: '21:00', // 09:00 PM IST
  timezone: 'Asia/Kolkata',
  lastSentDate: '',
  updatedAt: new Date().toISOString(),
};

/**
 * Get current notification settings from Firestore
 */
export async function getNotificationSettings(): Promise<NotificationSettingsData> {
  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as NotificationSettingsData;
    }

    // Missing settings are initialized explicitly. Transport/IAM/Firestore
    // errors are never converted into enabled defaults because that could
    // send mail against stale or unintended configuration.
    await setDoc(docRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.error(
      'Error reading notification settings; refusing to fail open:',
      sanitizeError(err)
    );
    throw err;
  }
}

/**
 * Save notification settings to Firestore
 */
export async function saveNotificationSettings(
  updates: Partial<NotificationSettingsData>
): Promise<NotificationSettingsData> {
  const current = await getNotificationSettings();

  const recipientEmail =
    typeof updates.recipientEmail === 'string'
      ? updates.recipientEmail.trim()
      : current.recipientEmail;
  const recipientName =
    typeof updates.recipientName === 'string'
      ? updates.recipientName.trim()
      : current.recipientName;
  const scheduledTime =
    typeof updates.scheduledTime === 'string'
      ? updates.scheduledTime.trim()
      : current.scheduledTime;
  const enabled =
    typeof updates.enabled === 'boolean' ? updates.enabled : current.enabled;

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) ||
    recipientEmail.length > 254
  ) {
    throw new Error('A valid recipient email address is required.');
  }

  if (!recipientName || recipientName.length > 120) {
    throw new Error('Recipient name must be between 1 and 120 characters.');
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) {
    throw new Error('Scheduled time must use 24-hour HH:MM format.');
  }

  const updated: NotificationSettingsData = {
    ...current,
    id: SETTINGS_DOC_ID,
    enabled,
    recipientEmail,
    recipientName,
    scheduledTime,
    timezone: 'Asia/Kolkata',
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  await setDoc(docRef, updated, { merge: true });
  return updated;
}

async function saveNotificationLastSentDate(dateKey: string): Promise<void> {
  const normalized = normalizeSchedulerDateKey(dateKey);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Refusing to persist an invalid last-sent date.');
  }

  await setDoc(
    doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID),
    {
      lastSentDate: normalized,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
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

function normalizeSchedulerDateKey(value: string): string {
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

function dateKeyFromUnknown(value: any): string {
  if (!value) return '';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function isHabitDueForDate(habit: any, dateKey: string): boolean {
  const startKey = dateKeyFromUnknown(habit?.createdAt);
  if (startKey && dateKey < startKey) return false;

  const skippedDates = new Set(
    Array.isArray(habit?.skippedDates) ? habit.skippedDates.map(String) : []
  );
  const extraDates = new Set(
    Array.isArray(habit?.extraDates) ? habit.extraDates.map(String) : []
  );

  if (extraDates.has(dateKey)) return true;
  if (skippedDates.has(dateKey)) return false;

  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const frequency = String(habit?.frequency || 'daily');

  if (frequency === 'daily') return true;
  if (frequency === 'weekdays') return weekday >= 1 && weekday <= 5;

  if (frequency === 'custom') {
    const repeatDays = Array.isArray(habit?.repeatDays)
      ? habit.repeatDays.map(Number).filter((value: number) => value >= 0 && value <= 6)
      : [];
    return repeatDays.includes(weekday);
  }

  return false;
}
export async function finalizeDayIfNoResponse(targetDate = new Date()): Promise<{
  finalized: boolean;
  dateKey: string;
  formattedDate: string;
  recordId?: string;
  reason: string;
}> {
  const { dateKey, formattedDate } = getKolkataTimeInfo(targetDate);
  const targetKey = normalizeSchedulerDateKey(dateKey);
  const nowIso = new Date().toISOString();

  const recordsSnap = await getDocs(collection(db, 'records'));
  const records: any[] = [];
  let matchedRecord: any = null;
  let highestDay = 0;

  recordsSnap.forEach((d) => {
    const record: any = { id: d.id, ...d.data() };
    records.push(record);
    highestDay = Math.max(highestDay, Number(record.day) || 0);

    if (normalizeSchedulerDateKey(record.date || '') === targetKey) {
      matchedRecord = record;
    }
  });

  if (matchedRecord?.responseSubmittedAt) {
    return {
      finalized: false,
      dateKey,
      formattedDate,
      recordId: matchedRecord.id,
      reason:
        matchedRecord.responseSource === 'AUTO_DEFAULT'
          ? 'already_auto_finalized'
          : 'explicit_response_already_submitted',
    };
  }

  const tasksSnap = await getDocs(collection(db, 'tasks'));
  let totalTasks = 0;
  let completedTasks = 0;

  tasksSnap.forEach((d) => {
    const task = d.data();
    if (normalizeSchedulerDateKey(task.taskKey || task.date || '') === targetKey) {
      totalTasks += 1;
      if (Boolean(task.isCompleted)) completedTasks += 1;
    }
  });

  const recordId = matchedRecord?.id || `record-${dateKey}`;
  const payload = {
    id: recordId,
    day: matchedRecord?.day || highestDay + 1,
    date: matchedRecord?.date || formattedDate,
    isCompleted: false,
    result: 'FALSE',
    change: 0,
    skill: matchedRecord?.skill || 'Daily Tasks',
    summary:
      totalTasks > 0
        ? `${completedTasks}/${totalTasks} tasks completed — no daily response submitted`
        : 'No tasks created — no daily response submitted',
    notes: 'Auto-marked Not Completed because no explicit app/email response was submitted for the day.',
    responseSubmittedAt: nowIso,
    responseSource: 'AUTO_DEFAULT',
    updatedAt: nowIso,
  };

  await setDoc(doc(db, 'records', recordId), payload, { merge: true });

  return {
    finalized: true,
    dateKey,
    formattedDate,
    recordId,
    reason: totalTasks === 0 ? 'no_tasks_created' : 'no_response_submitted',
  };
}

/**
 * Find today's task or daily record from Firestore
 */
export async function findTodayTaskOrRecord(): Promise<{
  record?: any;
  task?: any;
  tasks?: any[];
  habits?: any[];
  taskDetails?: EmailTaskDetails;
} | null> {
  const { dateKey, formattedDate } = getKolkataTimeInfo();

  try {
    const tasksSnap = await getDocs(collection(db, 'tasks'));
    const matchedTasks: any[] = [];

    tasksSnap.forEach((d) => {
      const t = d.data();
      if (t.taskKey === dateKey || t.taskKey === formattedDate) {
        matchedTasks.push({ id: d.id, ...t });
      }
    });

    matchedTasks.sort((x, y) =>
      String(x.updatedAt || x.id).localeCompare(String(y.updatedAt || y.id))
    );

    const habitsSnap = await getDocs(collection(db, 'habits'));
    const matchedHabits: any[] = [];

    habitsSnap.forEach((d) => {
      const habit = { id: d.id, ...d.data() } as any;
      if (isHabitDueForDate(habit, dateKey)) matchedHabits.push(habit);
    });

    matchedHabits.sort((a, b) =>
      String(a.name || a.id).localeCompare(String(b.name || b.id))
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
    const allTasksCompleted =
      matchedTasks.length > 0 && matchedTasks.every((task) => Boolean(task.isCompleted));

    const taskName =
      matchedTasks.length > 1
        ? `${matchedTasks.length} tasks scheduled`
        : primaryTask?.taskOfTheDay ||
          matchedRecord?.summary ||
          `Day ${matchedRecord?.day || nextDayNum} Daily Tasks`;

    return {
      record: matchedRecord,
      task: primaryTask,
      tasks: matchedTasks,
      habits: matchedHabits,
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
        habits: matchedHabits.map((habit) => ({
          id: habit.id,
          name: String(habit.name || 'Habit'),
          emoji: String(habit.emoji || '✓'),
          isCheckedIn: Array.isArray(habit.checkIns) && habit.checkIns.includes(dateKey),
        })),
      },
    };
  } catch (err) {
    console.error('Error finding today tasks or record:', sanitizeError(err));
    throw err;
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
}): Promise<TriggerDailyReminderResult> {
  const { timeStr, dateKey, formattedDate } = getKolkataTimeInfo();
  const settings = await getNotificationSettings();
  const targetRecipient =
    options?.recipientOverride || String(settings.recipientEmail || '').trim();
  const force = Boolean(options?.force);

  if (!targetRecipient) {
    return {
      success: false,
      alreadySent: false,
      date: formattedDate,
      taskId: '',
      recipient: '',
      status: 'pending_configuration',
      error: 'Notification recipient is not configured.',
      message: 'Configure a recipient email before sending reminders.',
    };
  }

  // Every non-forced caller must obey the same notification switch and scheduled time.
  // This includes the in-process timer, GitHub Actions, shell scripts, and external schedulers.
  if (!force) {
    if (!settings.enabled) {
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

    const [currentHour, currentMinute] = timeStr.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    const scheduledMinutes = parseScheduledMinutes(settings.scheduledTime);

    if (currentMinutes < scheduledMinutes) {
      return {
        success: true,
        alreadySent: false,
        date: formattedDate,
        taskId: '',
        recipient: targetRecipient,
        status: 'not_due',
        message: `Reminder is scheduled for ${settings.scheduledTime || '21:00'} Asia/Kolkata.`,
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
            if (data.status === 'failed' && data.retryAfter) {
              const retryAfterMs = new Date(data.retryAfter).getTime();
              if (Number.isFinite(retryAfterMs) && retryAfterMs > Date.now()) {
                return {
                  acquired: false,
                  alreadySent: false,
                  retryPending: true,
                  data,
                };
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

          if (lockResult.retryPending) {
            const retryAfter = existing.retryAfter || '';
            console.log(
              `[Scheduler] SMTP retry for ${formattedDate} is cooling down until ${retryAfter}.`
            );
            return {
              success: false,
              alreadySent: false,
              message: `SMTP retry is scheduled for ${retryAfter}.`,
              date: formattedDate,
              taskId: existing.taskId || '',
              recipient: existing.recipient || targetRecipient,
              messageId: existing.messageId || '',
              taskName: existing.taskName,
              sentAt: existing.sentAt || existing.lockedAt,
              status: 'retry_pending',
              error: existing.error || 'Previous SMTP attempt failed.',
            };
          }

          const confirmedSent =
            existing.status === 'delivered' ||
            existing.status === 'sent' ||
            lockResult.reason === 'settings_already_sent';

          console.log(
            confirmedSent
              ? `[Scheduler] Reminder for ${formattedDate} (${dateKey}) is already delivered. Skipping duplicate email.`
              : `[Scheduler] Reminder for ${formattedDate} (${dateKey}) is currently in-flight. Skipping duplicate email.`
          );

          return {
            success: true,
            alreadySent: true,
            message: confirmedSent
              ? `Daily reminder has already been delivered for IST date ${formattedDate}. Duplicate skipped.`
              : `Daily reminder is already in-flight for IST date ${formattedDate}. Duplicate skipped.`,
            date: formattedDate,
            taskId: existing.taskId || '',
            recipient: existing.recipient || targetRecipient,
            messageId: existing.messageId || '',
            taskName: existing.taskName,
            sentAt: existing.sentAt || existing.lockedAt,
            status: confirmedSent
              ? 'delivered'
              : existing.status || 'in_progress',
          };
        }
      } catch (err) {
        const cleanError = sanitizeError(err);
        console.warn(
          'Unable to acquire distributed reminder lock; refusing to send without deduplication:',
          cleanError
        );
        return {
          success: false,
          alreadySent: false,
          date: formattedDate,
          taskId: '',
          recipient: targetRecipient,
          status: 'lock_unavailable',
          error: cleanError,
          message: 'Reminder was not sent because the distributed deduplication lock was unavailable.',
        };
      }
    }

    // 3. Retrieve today's task using Asia/Kolkata timezone
    const todayData = await findTodayTaskOrRecord();

    const taskDetails: EmailTaskDetails = todayData?.taskDetails || {
      recordId: `rec-${dateKey}`,
      taskId: `review-${dateKey}`,
      taskDate: formattedDate,
      taskName: 'Today’s Tasks',
      isCompleted: false,
      tasks: [],
      habits: [],
      recipientEmail: targetRecipient,
      recipientName: settings.recipientName || DEFAULT_SETTINGS.recipientName,
    };

    // Ensure recipient is set correctly
    taskDetails.recipientEmail = targetRecipient;
    if (settings.recipientName) {
      taskDetails.recipientName = settings.recipientName;
    }

    // 4. Send daily confirmation email
    const sendResult = await sendDailyConfirmationEmail(taskDetails, undefined, targetRecipient);

    // 5. Any result other than confirmed SMTP delivery is a failed attempt.
    // Never advance lastSentDate or seal the deduplication record in this branch.
    if (!sendResult.success || sendResult.status !== 'delivered') {
      const cleanError = sanitizeError(
        sendResult.error ||
          `Email provider did not confirm delivery (status: ${sendResult.status}).`
      );
      const failedAt = new Date();
      const retryAfter = new Date(
        failedAt.getTime() + SMTP_RETRY_BACKOFF_MS
      ).toISOString();

      try {
        await setDoc(
          doc(db, DAILY_REMINDERS_SENT_COLLECTION, dateKey),
          {
            status: 'failed',
            providerStatus: sendResult.status,
            error: cleanError,
            lastAttemptAt: failedAt.toISOString(),
            retryAfter,
            updatedAt: failedAt.toISOString(),
          },
          { merge: true }
        );
      } catch (lockReleaseErr) {
        console.warn(
          'Failed to persist retry state after email failure:',
          sanitizeError(lockReleaseErr)
        );
      }

      return {
        success: false,
        alreadySent: false,
        date: formattedDate,
        taskId: taskDetails.taskId || taskDetails.recordId,
        recipient: targetRecipient,
        taskName: taskDetails.taskName,
        status: sendResult.status === 'pending_configuration'
          ? 'pending_configuration'
          : 'failed',
        error: cleanError,
        message: `Retry available after ${retryAfter}.`,
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
        saveNotificationLastSentDate(dateKey),
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
      sentAt: nowIso,
    };
  })();

  if (!force) {
    activeDispatchPromises.set(dateKey, dispatchPromise);
    dispatchPromise.then(
      (result) => {
        if (!result.success) {
          // Failure retry timing is controlled by the Firestore retryAfter value.
          activeDispatchPromises.delete(dateKey);
          return;
        }

        // Keep successful/in-flight results briefly cached to collapse duplicate triggers.
        setTimeout(() => {
          activeDispatchPromises.delete(dateKey);
        }, 120000);
      },
      () => {
        activeDispatchPromises.delete(dateKey);
      }
    );
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
  let localLastFinalizedPreviousDate = '';

  const runCheck = async () => {
    if (isChecking) return;
    isChecking = true;
    try {
      const { timeStr, dateKey, formattedDate } = getKolkataTimeInfo();

      // Catch a missed previous-day close once per server process/day.
      // This makes the default Not Completed rule resilient to restarts/sleep
      // without repeatedly scanning Firestore every 30 seconds.
      const previousDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const previousDateKey = getKolkataTimeInfo(previousDate).dateKey;
      if (localLastFinalizedPreviousDate !== previousDateKey) {
        try {
          await finalizeDayIfNoResponse(previousDate);
          localLastFinalizedPreviousDate = previousDateKey;
        } catch (finalizeErr) {
          console.warn('[Background Scheduler] Previous-day finalization warning:', sanitizeError(finalizeErr));
        }
      }

      const [currentHour, currentMinute] = timeStr.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;

      // At 23:59 IST or later, close the current day if there was no explicit response.
      if (currentMinutes >= 23 * 60 + 59) {
        try {
          const finalization = await finalizeDayIfNoResponse();
          if (finalization.finalized) {
            console.log(
              `[Background Scheduler] Auto-marked ${finalization.formattedDate} Not Completed (${finalization.reason}).`
            );
          }
        } catch (finalizeErr) {
          console.warn('[Background Scheduler] Current-day finalization warning:', sanitizeError(finalizeErr));
        }
      }

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
      const [curH, curM] = timeStr.split(':').map(Number);

      const schedMins = parseScheduledMinutes(scheduled);
      const curMins = curH * 60 + curM;

      // Only run if current time is at or past scheduled time.
      // Mark the local date complete only after a confirmed delivery; failures remain retryable.
      if (curMins >= schedMins) {
        const result = await triggerDailyReminder({ force: false });

        if (
          result.success &&
          (result.status === 'delivered' || result.status === 'sent')
        ) {
          localLastDispatchedDate = dateKey;

          if (!result.alreadySent) {
            console.log(
              `[Background Scheduler] Auto-dispatched daily reminder for ${formattedDate} (${timeStr} IST) to ${result.recipient}`
            );
          }
        } else if (!result.success) {
          console.warn(
            `[Background Scheduler] Reminder attempt failed for ${formattedDate}; retry remains enabled. ${sanitizeError(
              result.error || result.message || 'Unknown SMTP failure'
            )}`
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

