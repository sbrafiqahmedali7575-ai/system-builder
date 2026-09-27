import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fetchAllProjectData, generateAllCsvFiles } from './server/backupService';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
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

