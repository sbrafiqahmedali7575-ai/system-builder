import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fetchAllProjectData, generateAllCsvFiles } from './server/backupService';
import { db, collection, getDocs, doc, getDoc } from './server/db';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/analytics/chat', async (req, res) => {
    try {
      const question = String(req.body?.question || '').trim();
      const pageContext = req.body?.context || {};
      const history = Array.isArray(req.body?.history)
        ? req.body.history
            .slice(-16)
            .map((item: any) => ({
              role: item?.role === 'assistant' ? 'assistant' : 'user',
              text: String(item?.text || '').slice(0, 4000),
            }))
            .filter((item: any) => item.text.trim())
        : [];

      if (!question) {
        return res.status(400).json({ error: 'Question is required.' });
      }

      const apiKey = String(
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.API_KEY ||
        ''
      ).trim();

      if (!apiKey) {
        return res.status(503).json({
          error: 'AI analyst is not configured on the server.',
          fallback: true,
        });
      }

      // Fetch the canonical source-of-truth on every question so the analyst can
      // answer questions beyond the currently selected dashboard period.
      const [daysSnap, tasksSnap, habitsSnap, habitLogsSnap, countdownsSnap, usersSnap] =
        await Promise.all([
          getDocs(collection(db, 'days')),
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'habits')),
          getDocs(collection(db, 'habitLogs')),
          getDocs(collection(db, 'countdowns')),
          getDocs(collection(db, 'users')),
        ]);

      const jsonSafe = (value: any): any => {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) return value.map(jsonSafe);
        if (typeof value === 'object') {
          if (typeof value.toDate === 'function') {
            try {
              return value.toDate().toISOString();
            } catch {
              return String(value);
            }
          }
          return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, jsonSafe(child)])
          );
        }
        return value;
      };

      const rows = (snapshot: any) =>
        snapshot.docs.map((item: any) => ({
          __documentId: item.id,
          ...jsonSafe(item.data()),
        }));

      const days = rows(daysSnap)
        .map((day: any) => {
          const taskCompletionRate = Number(day.taskCompletionRate || 0);
          const habitCompletionRate = Number(day.habitCompletionRate || 0);
          const DayCompletion =
            Math.round((taskCompletionRate * 0.67 + habitCompletionRate * 0.33) * 10) / 10;
          return {
            ...day,
            DayCompletion,
            IsdayCompleted: DayCompletion >= 80,
          };
        })
        .sort((a: any, b: any) =>
          String(a.dateKey || a.__documentId).localeCompare(String(b.dateKey || b.__documentId))
        );

      const tasks = rows(tasksSnap).sort((a: any, b: any) =>
        String(a.scheduledDate || a.taskKey || '').localeCompare(
          String(b.scheduledDate || b.taskKey || '')
        ) ||
        Number(a.taskOrder || a.sortOrder || 0) - Number(b.taskOrder || b.sortOrder || 0)
      );

      const habits = rows(habitsSnap).sort((a: any, b: any) =>
        String(a.activeFrom || a.createdAt || '').localeCompare(
          String(b.activeFrom || b.createdAt || '')
        )
      );

      const habitLogs = rows(habitLogsSnap).sort((a: any, b: any) =>
        String(a.dateKey || '').localeCompare(String(b.dateKey || '')) ||
        String(a.habitId || '').localeCompare(String(b.habitId || ''))
      );

      const countdowns = rows(countdownsSnap);
      const users = rows(usersSnap).map((user: any) => {
        // Keep the analytical identity fields, but never send credentials or
        // unrelated secret-like values if any were accidentally stored.
        const {
          password,
          passwordHash,
          token,
          accessToken,
          refreshToken,
          apiKey,
          ...safeUser
        } = user;
        return safeUser;
      });

      const parseDurationMinutes = (value: any): number => {
        const input = String(value || '').trim().toLowerCase();
        if (!input) return 0;
        const clock = input.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
        if (clock) {
          if (clock[3] !== undefined) {
            return Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3]) / 60;
          }
          return Number(clock[1]) * 60 + Number(clock[2]);
        }
        const hours = Number(input.match(/([\d.]+)\s*h/)?.[1] || 0);
        const minutes = Number(input.match(/([\d.]+)\s*m/)?.[1] || 0);
        return Math.round((hours * 60 + minutes) * 100) / 100;
      };

      const normalizeDateKey = (value: any): string => {
        const raw = String(value || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : raw;
      };

      const mondayOf = (value: string): string => {
        const ms = Date.parse(value + 'T00:00:00.000Z');
        if (!Number.isFinite(ms)) return value;
        const date = new Date(ms);
        const weekday = date.getUTCDay();
        const offset = weekday === 0 ? -6 : 1 - weekday;
        return new Date(ms + offset * 86_400_000).toISOString().slice(0, 10);
      };

      const normalizedTasks = tasks.map((task: any) => {
        const scheduledDate = normalizeDateKey(task.scheduledDate || task.taskKey);
        const completed = task.Iscompleted === true || task.isCompleted === true;
        const estimationMinutes = parseDurationMinutes(task.EstimationTime || task.timeEstimate);
        const actualMinutes = parseDurationMinutes(task.ActualTime);
        const varianceMinutes =
          estimationMinutes > 0 && actualMinutes > 0
            ? Math.round((actualMinutes - estimationMinutes) * 100) / 100
            : null;
        const variancePercent =
          estimationMinutes > 0 && actualMinutes > 0
            ? Math.round(((actualMinutes - estimationMinutes) / estimationMinutes) * 1000) / 10
            : null;

        return {
          taskId: String(task.taskId || task.id || task.__documentId || ''),
          title: String(task.title || task.taskOfTheDay || ''),
          scheduledDate,
          completed,
          quadrant: String(task.quadrant || task.matrixQuadrant || 'unassigned'),
          priority: String(task.priority || 'Normal'),
          category: task.category ? String(task.category) : '',
          taskOrder: Number(task.taskOrder || task.sortOrder || 0),
          estimationMinutes,
          actualMinutes,
          varianceMinutes,
          variancePercent,
          completedAt: task.completedAt || null,
          notes: task.notes ? String(task.notes) : '',
        };
      });

      const dayFacts = days.map((day: any) => {
        const key = normalizeDateKey(day.dateKey || day.__documentId);
        const ms = Date.parse(key + 'T00:00:00.000Z');
        const dayTasks = normalizedTasks.filter((task: any) => task.scheduledDate === key);
        const actualMinutes = dayTasks.reduce(
          (sum: number, task: any) => sum + Number(task.actualMinutes || 0),
          0
        );
        const estimationMinutes = dayTasks.reduce(
          (sum: number, task: any) => sum + Number(task.estimationMinutes || 0),
          0
        );

        return {
          dateKey: key,
          weekday: Number.isFinite(ms)
            ? new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(ms))
            : '',
          month: /^\d{4}-\d{2}/.test(key) ? key.slice(0, 7) : '',
          weekStart: mondayOf(key),
          tasksCompleted: Number(day.tasksCompleted || 0),
          taskTotal: Number(day.taskTotal || 0),
          taskCompletionRate: Number(day.taskCompletionRate || 0),
          habitsCompleted: Number(day.habitsCompleted || 0),
          habitTotal: Number(day.habitTotal || 0),
          habitCompletionRate: Number(day.habitCompletionRate || 0),
          DayCompletion: Number(day.DayCompletion || 0),
          IsdayCompleted: day.IsdayCompleted === true,
          workloadTasks: dayTasks.length,
          estimatedMinutes: Math.round(estimationMinutes * 100) / 100,
          actualMinutes: Math.round(actualMinutes * 100) / 100,
        };
      });

      const aggregateRows = (
        rowsToAggregate: any[],
        keyOf: (row: any) => string
      ) => {
        const groups = new Map<string, any[]>();
        rowsToAggregate.forEach((row: any) => {
          const key = keyOf(row);
          if (!key) return;
          const group = groups.get(key) || [];
          group.push(row);
          groups.set(key, group);
        });
        return [...groups.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, group]) => {
            const mean = (field: string) =>
              group.length
                ? Math.round(
                    (group.reduce((sum, row) => sum + Number(row[field] || 0), 0) / group.length) *
                      10
                  ) / 10
                : 0;
            return {
              key,
              recordedDays: group.length,
              averageDayCompletion: mean('DayCompletion'),
              averageTaskCompletionRate: mean('taskCompletionRate'),
              averageHabitCompletionRate: mean('habitCompletionRate'),
              successfulDays: group.filter((row) => row.IsdayCompleted === true).length,
              taskTotal: group.reduce((sum, row) => sum + Number(row.taskTotal || 0), 0),
              tasksCompleted: group.reduce((sum, row) => sum + Number(row.tasksCompleted || 0), 0),
              estimatedMinutes: Math.round(
                group.reduce((sum, row) => sum + Number(row.estimatedMinutes || 0), 0) * 100
              ) / 100,
              actualMinutes: Math.round(
                group.reduce((sum, row) => sum + Number(row.actualMinutes || 0), 0) * 100
              ) / 100,
            };
          });
      };

      const weeklyFacts = aggregateRows(dayFacts, (row) => row.weekStart).map((week: any) => ({
        ...week,
        sevenDayAverageForAchievedWeek:
          Math.round(((week.averageDayCompletion * week.recordedDays) / 7) * 10) / 10,
        isAchievedWeek:
          week.recordedDays <= 7 &&
          Math.round(((week.averageDayCompletion * week.recordedDays) / 7) * 10) / 10 > 80,
        note:
          'sevenDayAverageForAchievedWeek treats unrecorded/missing dates in the Monday-Sunday week as 0; averageDayCompletion averages recorded Days rows only.',
      }));

      const monthlyFacts = aggregateRows(dayFacts, (row) => row.month);

      const habitNameById = new Map(
        habits.map((habit: any) => [
          String(habit.habitId || habit.id || habit.__documentId || ''),
          String(habit.name || ''),
        ])
      );
      const habitFacts = [...habitNameById.entries()].map(([habitId, name]) => {
        const logs = habitLogs.filter((log: any) => String(log.habitId || '') === habitId);
        const completedLogs = logs.filter((log: any) => log.Iscompleted === true).length;
        return {
          habitId,
          name,
          logRows: logs.length,
          completedLogs,
          incompleteLogs: logs.length - completedLogs,
          completionLogRate:
            logs.length > 0 ? Math.round((completedLogs / logs.length) * 1000) / 10 : null,
          firstLogDate: logs.length ? normalizeDateKey(logs[0].dateKey) : null,
          lastLogDate: logs.length ? normalizeDateKey(logs[logs.length - 1].dateKey) : null,
        };
      });

      const taskDimension = (field: 'quadrant' | 'priority' | 'category') => {
        const groups = new Map<string, any[]>();
        normalizedTasks.forEach((task: any) => {
          const key = String(task[field] || 'Unassigned');
          const group = groups.get(key) || [];
          group.push(task);
          groups.set(key, group);
        });
        return [...groups.entries()]
          .map(([key, group]) => ({
            key,
            total: group.length,
            completed: group.filter((task) => task.completed).length,
            completionRate: group.length
              ? Math.round(
                  (group.filter((task) => task.completed).length / group.length) * 1000
                ) / 10
              : 0,
            estimatedMinutes: Math.round(
              group.reduce((sum, task) => sum + Number(task.estimationMinutes || 0), 0) * 100
            ) / 100,
            actualMinutes: Math.round(
              group.reduce((sum, task) => sum + Number(task.actualMinutes || 0), 0) * 100
            ) / 100,
          }))
          .sort((a, b) => b.total - a.total);
      };

      const dataQuality = {
        daysWithoutStoredDateKey: days.filter((day: any) => !day.dateKey).length,
        tasksWithoutScheduledDate: normalizedTasks.filter((task: any) => !task.scheduledDate).length,
        tasksWithoutTitle: normalizedTasks.filter((task: any) => !task.title).length,
        tasksWithEstimate: normalizedTasks.filter((task: any) => task.estimationMinutes > 0).length,
        tasksWithActualTime: normalizedTasks.filter((task: any) => task.actualMinutes > 0).length,
        tasksWithBothEstimateAndActual: normalizedTasks.filter(
          (task: any) => task.estimationMinutes > 0 && task.actualMinutes > 0
        ).length,
        habitLogsWithoutHabitId: habitLogs.filter((log: any) => !log.habitId).length,
        habitLogsWithoutDateKey: habitLogs.filter((log: any) => !log.dateKey).length,
      };

      const semanticLayer = {
        metricCatalog: {
          DayCompletion: {
            formula: 'taskCompletionRate * 0.67 + habitCompletionRate * 0.33',
            grain: 'day',
            range: '0-100',
          },
          SuccessfulDay: {
            formula: 'DayCompletion >= 80',
            grain: 'day',
          },
          AchievedWeek: {
            formula:
              'completed Monday-Sunday 7-calendar-day average DayCompletion > 80; missing dates count as 0',
            grain: 'week',
          },
          TaskCompletionRate: {
            formula: 'completed tasks / total tasks * 100',
            grain: 'requested grouping',
          },
          HabitCompletionRate: {
            formula: 'completed due habits / due habits * 100',
            grain: 'day or requested grouping when due counts are available',
          },
          TimeVariancePercent: {
            formula: '(ActualTimeMinutes - EstimationTimeMinutes) / EstimationTimeMinutes * 100',
            grain: 'task; only when both values are present',
          },
        },
        aliases: {
          day: ['date', 'dateKey', 'Days'],
          task: ['Tasks', 'taskOfTheDay', 'title'],
          completion: ['Iscompleted', 'isCompleted', 'completed'],
          quadrant: ['quadrant', 'matrixQuadrant'],
          scheduledDate: ['scheduledDate', 'taskKey'],
          taskOrder: ['taskOrder', 'sortOrder'],
          estimate: ['EstimationTime', 'timeEstimate', 'estimationMinutes'],
          actualTime: ['ActualTime', 'actualMinutes'],
        },
        dayFacts,
        weeklyFacts,
        monthlyFacts,
        normalizedTasks,
        habitFacts,
        taskBreakdowns: {
          byQuadrant: taskDimension('quadrant'),
          byPriority: taskDimension('priority'),
          byCategory: taskDimension('category'),
        },
        dataQuality,
      };

      const dataset = {
        source: 'live Firestore canonical collections',
        fetchedAt: new Date().toISOString(),
        businessRules: {
          DayCompletion: 'taskCompletionRate * 0.67 + habitCompletionRate * 0.33',
          IsdayCompleted: 'DayCompletion >= 80',
          achievedWeek:
            'a completed Monday-Sunday week whose seven calendar-day average DayCompletion is > 80; missing days count as 0',
        },
        collectionCounts: {
          days: days.length,
          tasks: tasks.length,
          habits: habits.length,
          habitLogs: habitLogs.length,
          countdowns: countdowns.length,
          users: users.length,
        },
        schemaHints: {
          days:
            'dateKey, tasksCompleted, taskTotal, taskCompletionRate, habitsCompleted, habitTotal, habitCompletionRate, DayCompletion, IsdayCompleted',
          tasks:
            'taskId/id, title/taskOfTheDay, quadrant/matrixQuadrant, scheduledDate/taskKey, taskOrder/sortOrder, priority, category, EstimationTime/timeEstimate, ActualTime, notes, Iscompleted/isCompleted, completedAt',
          habits:
            'habitId/id, name, repeatDays/frequency, activeFrom/createdAt, isActive, inactivePeriods, checkIns',
          habitLogs:
            'habitLogId, habitId, dateKey, Iscompleted',
          countdowns:
            'countdownId, title/reason, targetDate, isActive',
          users:
            'userId, name, email when present',
        },
        semanticLayer,
        data: {
          days,
          tasks,
          habits,
          habitLogs,
          countdowns,
          users,
        },
      };

      const complexQuestion =
        /why|root cause|correlat|regress|forecast|predict|trend|anomal|outlier|what[- ]?if|scenario|compare|relationship|impact|driver|variance|percentile|distribution|statistic|month over month|week over week/i.test(
          question
        );
      const selectedModel =
        complexQuestion && process.env.SYSTEM_BUILDER_ANALYTICS_DEEP_MODEL
          ? process.env.SYSTEM_BUILDER_ANALYTICS_DEEP_MODEL
          : process.env.SYSTEM_BUILDER_ANALYTICS_MODEL || 'gemini-2.5-flash';

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'You are the System Builder principal data analyst, BI engineer, statistician, and decision-support copilot.',
                  'Your job is to answer ANY question that can be answered from the supplied System Builder data, from a one-row lookup to multi-period statistical analysis.',
                  'Supported work includes exact row retrieval, search over task titles/notes, counts, sums, averages, medians, percentiles, distributions, rankings, top/bottom N, date arithmetic, period-over-period comparisons, moving averages, streaks, cohorts, task/habit segmentation, quadrant/priority/category analysis, workload analysis, time-estimation accuracy, variance, efficiency, correlations, anomaly/outlier detection, trend estimation, descriptive forecasting, what-if simulation, goal pacing, root-cause decomposition, and data-quality diagnostics.',
                  '',
                  'GROUNDING RULES:',
                  '1. Use only the supplied dataset and page context. Never invent a row, value, date, task, habit, or cause.',
                  '2. The live Firestore dataset is the source of truth. The page context is only a convenience for the currently selected dashboard view.',
                  '3. If a question is not answerable from available fields, say exactly what data is missing.',
                  '4. Respect the current business rules in dataset.businessRules even if an older stored field disagrees.',
                  '5. Distinguish facts from interpretation. For root-cause claims, name the measurable evidence.',
                  '6. For arithmetic, rankings, grouping, correlations, date windows, top/bottom questions, or multi-row comparisons, use code execution rather than estimating manually.',
                  '7. When the user asks a follow-up, use CHAT HISTORY to resolve references such as "that week", "those tasks", "compare it", or "why".',
                  '8. Answer the exact question first. Then add the most useful supporting figures. Avoid generic productivity advice unless the user asks for recommendations.',
                  '9. Use concise tables or bullets when they make comparisons clearer.',
                  '10. Treat missing calendar days as 0 only for the achieved-week rule. For other averages, follow the metric definition or explicitly state the treatment used.',
                  '11. Prefer SEMANTIC LAYER normalized fields for calculations, but use RAW DATA when the question asks for exact stored values, notes, titles, or fields not represented in the semantic layer.',
                  '12. Before giving a numerical answer, verify filters, date boundaries, denominator, missing-value treatment, and units. Recalculate with code when there is any doubt.',
                  '13. For correlations, report direction, strength, sample size, and relevant caveats; never present correlation as causation.',
                  '14. For forecasts or projections, label them as estimates, state the method and historical window, and do not pretend future outcomes are known.',
                  '15. For what-if questions, keep source data unchanged, clearly label the result as a simulation, and apply the current business rules unless the user explicitly changes an assumption.',
                  '16. For root-cause questions, decompose the result into measurable drivers such as task completion, habit completion, workload, time variance, weekday, priority, quadrant, or specific missed items. Do not infer psychological causes.',
                  '17. For ambiguous metric names, use dataset.semanticLayer.metricCatalog and aliases. If two interpretations remain plausible and materially change the answer, briefly state the interpretation used.',
                  '18. If data coverage is insufficient, quantify the coverage gap using semanticLayer.dataQuality instead of giving a weak conclusion.',
                  '19. When asked for a list, include the exact identifying fields needed to verify the rows (date/task/habit as appropriate).',
                  '20. Silently self-check the final answer against the computed result before responding; do not expose private reasoning.',
                  '',
                  'CURRENT PAGE CONTEXT:',
                  JSON.stringify(pageContext),
                  '',
                  'CHAT HISTORY:',
                  JSON.stringify(history),
                  '',
                  'FULL LIVE DATASET:',
                  JSON.stringify(dataset),
                  '',
                  'QUESTION:',
                  question,
                ].join('\n'),
              },
            ],
          },
        ],
        config: {
          tools: [{ codeExecution: {} }],
          temperature: complexQuestion ? 0.1 : 0,
        },
      });

      const answer = String(response.text || '').trim();
      if (!answer) {
        return res.status(502).json({ error: 'AI analyst returned an empty response.' });
      }

      return res.json({
        answer,
        dataFreshness: dataset.fetchedAt,
        collectionCounts: dataset.collectionCounts,
        analysisLevel: complexQuestion ? 'deep' : 'standard',
      });
    } catch (err: any) {
      console.error('Analytics AI chat failed:', err);
      return res.status(500).json({
        error: err?.message || 'Analytics AI request failed.',
        fallback: true,
      });
    }
  });

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const configuredToken = String(process.env.SYSTEM_BUILDER_ADMIN_TOKEN || '').trim();

    if (!configuredToken) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          error: 'Administrative endpoints are disabled until SYSTEM_BUILDER_ADMIN_TOKEN is configured.',
        });
      }
      return next();
    }

    const providedToken = String(req.header('x-system-builder-admin-token') || '').trim();
    if (!providedToken || providedToken !== configuredToken) {
      return res.status(401).json({ error: 'Unauthorized administrative request.' });
    }

    return next();
  };

  // Read-only live migration reconciliation. Never writes or deletes Firestore data.
  app.get('/api/migration/verify', requireAdmin, async (_req, res) => {
    try {
      const [recordsSnap, tasksSnap, habitsSnap, daysSnap, logsSnap, countdownsSnap, usersSnap] =
        await Promise.all([
          getDocs(collection(db, 'records')),
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'habits')),
          getDocs(collection(db, 'days')),
          getDocs(collection(db, 'habitLogs')),
          getDocs(collection(db, 'countdowns')),
          getDocs(collection(db, 'users')),
        ]);

      const issues: string[] = [];
      const oldTaskDocs = tasksSnap.docs.filter((d) => {
        const x = d.data();
        return 'taskKey' in x || 'taskOfTheDay' in x || 'isCompleted' in x || 'matrixQuadrant' in x;
      });
      const canonicalTaskDocs = tasksSnap.docs.filter((d) => {
        const x = d.data();
        return Boolean(x.taskId && x.scheduledDate !== undefined && x.title !== undefined && typeof x.Iscompleted === 'boolean');
      });
      if (canonicalTaskDocs.length !== tasksSnap.size) {
        issues.push(`Tasks: ${tasksSnap.size - canonicalTaskDocs.length} document(s) are not canonical.`);
      }

      let expectedHabitLogs = 0;
      habitsSnap.forEach((d) => {
        const x = d.data();
        if (Array.isArray(x.checkIns)) expectedHabitLogs += new Set(x.checkIns.filter(Boolean)).size;
        if (!(x.habitId && x.name !== undefined && Array.isArray(x.repeatDays) && x.activeFrom && typeof x.isActive === 'boolean')) {
          issues.push(`Habits/${d.id}: canonical fields are incomplete.`);
        }
      });
      const completedLogs = logsSnap.docs.filter((d) => d.data().Iscompleted === true).length;
      if (expectedHabitLogs > 0 && completedLogs < expectedHabitLogs) {
        issues.push(`HabitLogs: expected at least ${expectedHabitLogs} completed logs from legacy checkIns; found ${completedLogs}.`);
      }

      const recordDates = new Set(recordsSnap.docs.map((d) => String(d.data().date || '')).filter(Boolean));
      if (recordsSnap.size > 0 && daysSnap.size === 0) issues.push('Days: no target documents found although legacy records exist.');

      daysSnap.forEach((d) => {
        const x = d.data();
        const required = [
          'dateKey',
          'tasksCompleted',
          'taskTotal',
          'taskCompletionRate',
          'habitsCompleted',
          'habitTotal',
          'habitCompletionRate',
          'DayCompletion',
          'IsdayCompleted',
        ];
        const missing = required.filter((k) => x[k] === undefined);
        if (missing.length) {
          issues.push(`Days/${d.id}: missing ${missing.join(', ')}.`);
          return;
        }

        if (String(x.dateKey) !== d.id) {
          issues.push(`Days/${d.id}: document ID must match dateKey ${x.dateKey}.`);
        }

        const taskTotal = Number(x.taskTotal || 0);
        const tasksCompleted = Number(x.tasksCompleted || 0);
        const habitTotal = Number(x.habitTotal || 0);
        const habitsCompleted = Number(x.habitsCompleted || 0);
        const expectedTaskRate =
          taskTotal > 0 ? Math.round((tasksCompleted / taskTotal) * 100) : 0;
        const expectedHabitRate =
          habitTotal > 0 ? Math.round((habitsCompleted / habitTotal) * 100) : 0;
        const expectedDayCompletion =
          Math.round((expectedTaskRate * 0.67 + expectedHabitRate * 0.33) * 10) / 10;
        const expectedDayCompleted = expectedDayCompletion >= 80;

        if (Number(x.taskCompletionRate) !== expectedTaskRate) {
          issues.push(
            `Days/${d.id}: taskCompletionRate must equal completed tasks / task total.`
          );
        }
        if (Number(x.habitCompletionRate) !== expectedHabitRate) {
          issues.push(
            `Days/${d.id}: habitCompletionRate must equal completed habits / habit total.`
          );
        }
        if (Number(x.DayCompletion) !== expectedDayCompletion) {
          issues.push(
            `Days/${d.id}: DayCompletion must equal 67% task completion + 33% habit completion.`
          );
        }
        if (x.IsdayCompleted !== expectedDayCompleted) {
          issues.push(
            `Days/${d.id}: IsdayCompleted must equal DayCompletion >= 80%.`
          );
        }

        const legacyFields = ['tasksDone', 'tasks', 'habitsDone', 'Habits', 'dayCompleted'];
        const presentLegacy = legacyFields.filter((key) => key in x);
        if (presentLegacy.length) {
          issues.push(
            `Days/${d.id}: legacy fields still present: ${presentLegacy.join(', ')}.`
          );
        }
      });

      if (usersSnap.size === 0) issues.push('Users: no migrated user profile found.');
      if (countdownsSnap.size === 0) {
        // Countdown is optional, so absence is informational rather than a failure.
      }

      const report = {
        verifiedAt: new Date().toISOString(),
        readOnly: true,
        safeToDeleteLegacyData: issues.length === 0,
        counts: {
          legacyRecords: recordsSnap.size,
          tasks: tasksSnap.size,
          canonicalTasks: canonicalTaskDocs.length,
          legacyShapedTasksStillPresent: oldTaskDocs.length,
          habits: habitsSnap.size,
          habitLogs: logsSnap.size,
          completedHabitLogs: completedLogs,
          days: daysSnap.size,
          users: usersSnap.size,
          countdowns: countdownsSnap.size,
        },
        legacyRecordDateCount: recordDates.size,
        issues,
      };
      return res.json(report);
    } catch (err: any) {
      console.error('Migration verification failed:', err);
      return res.status(500).json({ safeToDeleteLegacyData: false, error: err.message || String(err) });
    }
  });

  // Canonical Days CSV backup/export.
  app.get('/api/backup/export', requireAdmin, async (req, res) => {
    try {
      const format = String(req.query.format || 'csv').toLowerCase();
      const data = await fetchAllProjectData();
      const csvFiles = generateAllCsvFiles(data);
      const daysCsv = csvFiles['days.csv'] || '';

      if (format === 'json') {
        return res.json({
          success: true,
          timestamp: data.timestamp,
          counts: { days: data.days.length, tasks: data.tasks.length },
          csvFiles: { 'days.csv': daysCsv },
        });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="days.csv"');
      return res.status(200).send('\uFEFF' + daysCsv);
    } catch (err: any) {
      console.error('Failed to generate backup export:', err);
      return res.status(500).json({ success: false, error: err.message || 'Backup generation failed' });
    }
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
  });
}

startServer();

