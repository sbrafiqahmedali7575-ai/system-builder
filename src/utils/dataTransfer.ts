import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type {
  CanonicalCollectionName,
  CanonicalDataRow,
} from '../services/firebaseService';

export type DataTransferFormat = 'csv' | 'xlsx';

export const DATA_TABLE_COLUMNS: Record<CanonicalCollectionName, string[]> = {
  users: ['userId', 'name'],
  days: [
    'dateKey',
    'tasksCompleted',
    'taskTotal',
    'taskCompletionRate',
    'habitsCompleted',
    'habitTotal',
    'habitCompletionRate',
    'DayCompletion',
    'IsdayCompleted',
  ],
  tasks: [
    'taskId',
    'title',
    'quadrant',
    'scheduledDate',
    'taskOrder',
    'EstimationTime',
    'ActualTime',
    'notes',
    'Iscompleted',
  ],
  habits: ['habitId', 'name', 'repeatDays', 'activeFrom', 'isActive', 'color'],
  habitLogs: ['habitLogId', 'habitId', 'dateKey', 'Iscompleted'],
  countdowns: ['countdownId', 'title', 'targetDate', 'isActive'],
};

export const DATA_PRIMARY_KEYS: Record<CanonicalCollectionName, string> = {
  users: 'userId',
  days: 'dateKey',
  tasks: 'taskId',
  habits: 'habitId',
  habitLogs: 'habitLogId',
  countdowns: 'countdownId',
};

const NUMBER_COLUMNS = new Set([
  'tasksCompleted',
  'taskTotal',
  'taskCompletionRate',
  'habitsCompleted',
  'habitTotal',
  'habitCompletionRate',
  'DayCompletion',
  'taskOrder',
]);

const BOOLEAN_COLUMNS = new Set([
  'IsdayCompleted',
  'Iscompleted',
  'isActive',
]);

const HEADER_ALIASES: Partial<
  Record<CanonicalCollectionName, Record<string, string>>
> = {
  days: {
    tasksdone: 'tasksCompleted',
    tasks: 'taskTotal',
    habitsdone: 'habitsCompleted',
    habits: 'habitTotal',
    daycompleted: 'IsdayCompleted',
  },
  tasks: {
    sortorder: 'taskOrder',
  },
};

function exportCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value as string | number | boolean;
}

function parseBoolean(value: unknown, column: string): boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'completed', 'active'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'not completed', 'inactive'].includes(normalized)) {
    return false;
  }
  throw new Error(`${column} must be TRUE/FALSE or 1/0.`);
}

function parseNumber(value: unknown, column: string): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const normalized = typeof value === 'string'
    ? value.trim().replace(/%$/, '')
    : value;
  if (normalized === '') return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${column} must be a valid number.`);
  }
  return parsed;
}

function parseRepeatDays(value: unknown): number[] {
  if (value === null || value === undefined || value === '') return [];
  const rawValues = Array.isArray(value)
    ? value
    : (() => {
        const text = String(value).trim();
        if (!text) return [];
        if (text.startsWith('[')) {
          try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            throw new Error('repeatDays must be JSON like [1,2,3] or comma-separated.');
          }
        }
        return text.split(/[;,]/);
      })();

  const days = rawValues.map((item) => Number(String(item).trim()));
  if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error('repeatDays accepts only weekday numbers 0-6.');
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

function normalizeHeader(
  collectionName: CanonicalCollectionName,
  header: string
): string | null {
  const expected = DATA_TABLE_COLUMNS[collectionName];
  const normalized = header.trim().toLowerCase();
  const exact = expected.find((column) => column.toLowerCase() === normalized);
  if (exact) return exact;
  return HEADER_ALIASES[collectionName]?.[normalized] || null;
}

function normalizeRow(
  collectionName: CanonicalCollectionName,
  source: Record<string, unknown>,
  rowNumber: number
): CanonicalDataRow {
  const columns = DATA_TABLE_COLUMNS[collectionName];
  const mapped: Record<string, unknown> = {};

  Object.entries(source).forEach(([header, value]) => {
    const column = normalizeHeader(collectionName, header);
    if (!column) return;
    mapped[column] = value;
  });

  const primaryKey = DATA_PRIMARY_KEYS[collectionName];
  const primaryValue = String(mapped[primaryKey] ?? '').trim();
  if (!primaryValue) {
    throw new Error(`Row ${rowNumber}: missing required ${primaryKey}.`);
  }

  const row: CanonicalDataRow = { id: primaryValue };
  columns.forEach((column) => {
    if (!(column in mapped)) return;
    try {
      if (column === 'repeatDays') {
        row[column] = parseRepeatDays(mapped[column]);
      } else if (NUMBER_COLUMNS.has(column)) {
        row[column] = parseNumber(mapped[column], column);
      } else if (BOOLEAN_COLUMNS.has(column)) {
        row[column] = parseBoolean(mapped[column], column);
      } else {
        row[column] = String(mapped[column] ?? '').trim();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Row ${rowNumber}: ${message}`);
    }
  });

  row[primaryKey] = primaryValue;

  if (collectionName === 'days') {
    const taskRate = Number(row.taskCompletionRate ?? 0);
    const habitRate = Number(row.habitCompletionRate ?? 0);
    const dayCompletion =
      Math.round((taskRate * 0.67 + habitRate * 0.33) * 10) / 10;
    row.DayCompletion = dayCompletion;
    row.IsdayCompleted = dayCompletion >= 80;
  }

  return row;
}

async function readCsv(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        if (result.errors.length > 0) {
          const first = result.errors[0];
          reject(new Error(`CSV parse error near row ${first.row ?? '?'}: ${first.message}`));
          return;
        }
        resolve(result.data);
      },
      error: (error) => reject(error),
    });
  });
}

async function readExcel(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The Excel workbook has no worksheets.');
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });
}

export async function parseCanonicalDataFile(
  file: File,
  collectionName: CanonicalCollectionName,
  format: DataTransferFormat
): Promise<CanonicalDataRow[]> {
  const rawRows = format === 'csv' ? await readCsv(file) : await readExcel(file);
  if (rawRows.length === 0) {
    throw new Error('The selected file contains no data rows.');
  }

  const rows = rawRows.map((row, index) =>
    normalizeRow(collectionName, row, index + 2)
  );

  const primaryKey = DATA_PRIMARY_KEYS[collectionName];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const key = String(row[primaryKey] ?? '').trim();
    if (seen.has(key)) {
      throw new Error(
        `Duplicate ${primaryKey} "${key}" in import file at row ${index + 2}.`
      );
    }
    seen.add(key);
  });

  return rows;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCanonicalDataFile(
  collectionName: CanonicalCollectionName,
  rows: CanonicalDataRow[],
  format: DataTransferFormat
): void {
  const columns = DATA_TABLE_COLUMNS[collectionName];
  const exportRows = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, exportCell(row[column])]))
  );
  const dateStamp = new Date().toISOString().slice(0, 10);
  const baseName = `system-builder-${collectionName}-${dateStamp}`;

  if (format === 'csv') {
    const csv = Papa.unparse(exportRows, { columns });
    downloadBlob(
      new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
      `${baseName}.csv`
    );
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: columns });
  worksheet['!cols'] = columns.map((column) => ({
    wch: Math.min(
      40,
      Math.max(
        column.length + 2,
        ...exportRows.map((row) => String(row[column] ?? '').length + 2)
      )
    ),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, collectionName.slice(0, 31));
  XLSX.writeFile(workbook, `${baseName}.xlsx`, { compression: true });
}


export type CanonicalDataSet = Record<
  CanonicalCollectionName,
  CanonicalDataRow[]
>;

const ALL_COLLECTIONS: CanonicalCollectionName[] = [
  'users',
  'days',
  'tasks',
  'habits',
  'habitLogs',
  'countdowns',
];

function exportRowsForCollection(
  collectionName: CanonicalCollectionName,
  rows: CanonicalDataRow[]
): Record<string, string | number | boolean>[] {
  const columns = DATA_TABLE_COLUMNS[collectionName];
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [column, exportCell(row[column])])
    ) as Record<string, string | number | boolean>
  );
}

function validateImportedRows(
  collectionName: CanonicalCollectionName,
  rawRows: Record<string, unknown>[]
): CanonicalDataRow[] {
  const rows = rawRows.map((row, index) =>
    normalizeRow(collectionName, row, index + 2)
  );
  const primaryKey = DATA_PRIMARY_KEYS[collectionName];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const key = String(row[primaryKey] ?? '').trim();
    if (seen.has(key)) {
      throw new Error(
        `${collectionName}: duplicate ${primaryKey} "${key}" at row ${index + 2}.`
      );
    }
    seen.add(key);
  });

  return rows;
}

function parseCsvText(
  text: string,
  collectionName: CanonicalCollectionName
): CanonicalDataRow[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(
      `${collectionName}: CSV parse error near row ${first.row ?? '?'}: ${first.message}`
    );
  }
  return validateImportedRows(collectionName, result.data);
}

export async function exportAllCanonicalData(
  data: CanonicalDataSet,
  format: DataTransferFormat
): Promise<void> {
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (format === 'xlsx') {
    const workbook = XLSX.utils.book_new();

    ALL_COLLECTIONS.forEach((collectionName) => {
      const columns = DATA_TABLE_COLUMNS[collectionName];
      const rows = exportRowsForCollection(
        collectionName,
        data[collectionName] || []
      );
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
      worksheet['!cols'] = columns.map((column) => ({
        wch: Math.min(
          40,
          Math.max(
            column.length + 2,
            ...rows.map((row) => String(row[column] ?? '').length + 2)
          )
        ),
      }));
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        collectionName.slice(0, 31)
      );
    });

    XLSX.writeFile(
      workbook,
      `system-builder-all-data-${dateStamp}.xlsx`,
      { compression: true }
    );
    return;
  }

  const zip = new JSZip();
  ALL_COLLECTIONS.forEach((collectionName) => {
    const columns = DATA_TABLE_COLUMNS[collectionName];
    const rows = exportRowsForCollection(
      collectionName,
      data[collectionName] || []
    );
    const csv = Papa.unparse(rows, { columns });
    zip.file(`${collectionName}.csv`, `\uFEFF${csv}`);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `system-builder-all-data-${dateStamp}-csv.zip`);
}

export async function parseAllCanonicalDataFile(
  file: File,
  format: DataTransferFormat
): Promise<CanonicalDataSet> {
  const emptyData = Object.fromEntries(
    ALL_COLLECTIONS.map((collectionName) => [collectionName, []])
  ) as CanonicalDataSet;

  if (format === 'xlsx') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetLookup = new Map(
      workbook.SheetNames.map((name) => [name.toLowerCase(), name])
    );

    for (const collectionName of ALL_COLLECTIONS) {
      const sheetName = sheetLookup.get(collectionName.toLowerCase());
      if (!sheetName) {
        throw new Error(
          `Excel import is missing the "${collectionName}" worksheet.`
        );
      }
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        { defval: '', raw: false }
      );
      emptyData[collectionName] = rawRows.length === 0
        ? []
        : validateImportedRows(collectionName, rawRows);
    }

    return emptyData;
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const filesByLowerName = new Map(
    Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map(
        (entry) =>
          [entry.name.split('/').pop()!.toLowerCase(), entry] as const
      )
  );

  for (const collectionName of ALL_COLLECTIONS) {
    const entry = filesByLowerName.get(`${collectionName.toLowerCase()}.csv`);
    if (!entry) {
      throw new Error(
        `CSV ZIP import is missing "${collectionName}.csv".`
      );
    }
    const text = await entry.async('string');
    emptyData[collectionName] = parseCsvText(text.replace(/^\uFEFF/, ''), collectionName);
  }

  return emptyData;
}
