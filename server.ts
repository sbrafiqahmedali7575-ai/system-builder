import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'path';
import fs from 'fs';
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

  // Read-only live migration reconciliation. Never writes or deletes Firestore data.
  app.get('/api/migration/verify', async (_req, res) => {
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
        const required = ['dateKey','tasksDone','tasks','tasksCompleted','habitsDone','Habits','habitsCompleted','dayCompleted','IsdayCompleted'];
        const missing = required.filter((k) => x[k] === undefined);
        if (missing.length) issues.push(`Days/${d.id}: missing ${missing.join(', ')}.`);
        const expectedDayCompleted =
          Math.round(
            (
              Number(x.tasksCompleted || 0) * 0.8 +
              Number(x.habitsCompleted || 0) * 0.2
            ) * 100
          ) / 100;
        if (Math.abs(Number(x.dayCompleted || 0) - expectedDayCompleted) > 0.001) {
          issues.push(
            `Days/${d.id}: dayCompleted does not match the 80% task + 20% habit weighted percentage.`
          );
        }
        if (x.IsdayCompleted !== (expectedDayCompleted >= 80)) {
          issues.push(
            `Days/${d.id}: IsdayCompleted does not match dayCompleted >= 80.`
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
  app.get('/api/backup/export', async (req, res) => {
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

  // Serve static dist build if available, otherwise fall back to Vite
  const rootIndexExists = fs.existsSync(path.join(process.cwd(), 'index.html'));
  const distPath = path.join(process.cwd(), 'dist');
  const distIndexExists = fs.existsSync(path.join(distPath, 'index.html'));

  if (!rootIndexExists && distIndexExists) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

