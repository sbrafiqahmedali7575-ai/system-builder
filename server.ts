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

  // 5. One-Click Records CSV Backup & Export Endpoint (records.csv ONLY)
  // Cleaned columns: id, day, date, isCompleted, notes
  app.get('/api/backup/export', async (req, res) => {
    try {
      const format = String(req.query.format || 'csv').toLowerCase();

      const data = await fetchAllProjectData();
      const csvFiles = generateAllCsvFiles(data);
      const recordsCsv = csvFiles['records.csv'] || '';

      if (format === 'json') {
        return res.json({
          success: true,
          timestamp: data.timestamp,
          counts: {
            records: data.records.length,
          },
          folderPath: 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB',
          defaultSubfolder: 'csv_files',
          targetPath: 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB\\csv_files\\records.csv',
          columns: [
            'id',
            'day',
            'date',
            'skill',
            'summary',
            'result',
            'isCompleted',
            'change',
            'notes',
            'updatedAt',
          ],
          csvFiles: {
            'records.csv': recordsCsv,
          },
        });
      }

      // Add UTF-8 Byte Order Mark (BOM) so Excel and SQL Loaders on Windows parse UTF-8 accurately
      const bom = '\uFEFF';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="records.csv"');
      return res.status(200).send(bom + recordsCsv);
    } catch (err: any) {
      console.error('Failed to generate backup export:', err);
      res.status(500).json({ success: false, error: err.message || 'Backup generation failed' });
    }
  });

  // Windows batch sync script generator for automated replacement of records.csv
  // Hardcoded default target: D:\My Projects\SQL\DataSet\RafiqCommitDB\csv_files
  app.get('/api/backup/sync-script', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const rootDir = 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB';
    const targetDir = 'D:\\My Projects\\SQL\\DataSet\\RafiqCommitDB\\csv_files';
    const batchContent = `@echo off
chcp 65001 >nul
echo ======================================================================
echo  System Builder (RafiqCommitDB) - Records CSV Auto-Replacer
echo  Folder Path: ${rootDir}
echo  Default Subfolder: csv_files
echo  Target File: ${targetDir}\\records.csv
echo ======================================================================

set "ROOT_DIR=${rootDir}"
set "TARGET_DIR=${targetDir}"

if not exist "%ROOT_DIR%" (
  echo [Info] Root project directory does not exist. Creating "%ROOT_DIR%"...
  mkdir "%ROOT_DIR%"
)

if not exist "%TARGET_DIR%" (
  echo [Info] Target folder "csv_files" does not exist. Creating "%TARGET_DIR%"...
  mkdir "%TARGET_DIR%"
)

echo.
echo [1/2] Deleting previous records CSV in "%TARGET_DIR%"...
if exist "%TARGET_DIR%\\records.csv" del /F /Q "%TARGET_DIR%\\records.csv"
del /F /Q "%TARGET_DIR%\\*.csv" 2>nul
echo       Previous records files deleted cleanly with zero folder prompt.

echo.
echo [2/2] Downloading fresh records.csv directly into csv_files...
curl -s "${baseUrl}/api/backup/export?table=records" -o "%TARGET_DIR%\\records.csv"

echo.
echo Verification:
dir "%TARGET_DIR%\\records.csv"

echo.
echo ======================================================================
echo  SUCCESS! records.csv replaced in "%TARGET_DIR%".
echo  Columns: id, day, date, isCompleted, notes
echo  Ready for SQL Server / Power BI reload.
echo ======================================================================
pause
`;

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sync_rafiq_commit_db.bat"');
    res.send(batchContent);
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

