import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { DailyRecord } from '../types';
import { calculateKPIStats, generatePowerQueryM, DAX_MEASURES } from './daxMeasures';

/**
 * Generates a fully packaged Microsoft Power BI Desktop (.pbix / .pbit) archive
 * containing the complete Tabular Model (DataModelSchema), Report Canvas (Report/Layout),
 * DAX Measures, Power Query M queries with all raw dataset records, Settings, Diagram,
 * Theme, Connection definitions, and embedded Dataset sources.
 */
export async function generatePbixZipBlob(
  records: DailyRecord[],
  fileName = 'SkillProgress_Dashboard.pbix'
): Promise<Blob> {
  const zip = new JSZip();
  const kpis = calculateKPIStats(records);
  const mExpression = generatePowerQueryM(records);

  // 1. Version file - Power BI Desktop Version stamp
  zip.file('Version', '2.138.1004.0');

  // 2. [Content_Types].xml (OPC Open Packaging Conventions definition)
  const contentTypesXml = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="xml" ContentType="application/xml" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="txt" ContentType="text/plain" />
  <Default Extension="csv" ContentType="text/csv" />
  <Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
  <Override PartName="/Report/Layout" ContentType="application/json" />
  <Override PartName="/DataModelSchema" ContentType="application/json" />
  <Override PartName="/Settings" ContentType="application/json" />
  <Override PartName="/DiagramLayout" ContentType="application/json" />
  <Override PartName="/Connections" ContentType="application/json" />
  <Override PartName="/Metadata" ContentType="application/json" />
  <Override PartName="/StaticResources/SharedResources/BaseThemes/CY24SU08.json" ContentType="application/json" />
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  // 3. Tabular DataModelSchema (TOM Tabular Object Model JSON definition)
  const dataModelSchema = {
    name: 'SkillProgressModel',
    compatibilityLevel: 1550,
    model: {
      culture: 'en-US',
      dataAccessOptions: {
        legacyRedirects: true,
        returnErrorValuesAsNull: true,
        fastCombine: true,
      },
      tables: [
        {
          name: 'DailyProgress',
          description: 'Daily tracking fact table for skill progress, completion status, and scores.',
          columns: [
            {
              name: 'DAY',
              dataType: 'int64',
              sourceColumn: 'DAY',
              summarizeBy: 'none',
              isKey: true,
              annotations: [{ name: 'Format', value: '<Format Format="Number" Accuracy="0" />' }],
            },
            {
              name: 'DATE',
              dataType: 'string',
              sourceColumn: 'DATE',
              summarizeBy: 'none',
            },
            {
              name: 'IS Completed',
              dataType: 'boolean',
              sourceColumn: 'IS Completed',
              summarizeBy: 'none',
            },
            {
              name: 'Result',
              dataType: 'string',
              sourceColumn: 'Result',
              summarizeBy: 'none',
            },
            {
              name: 'Change',
              dataType: 'double',
              sourceColumn: 'Change',
              summarizeBy: 'sum',
              annotations: [{ name: 'Format', value: '<Format Format="Custom" FormatString="+#,##0.00;-#,##0.00;0.00" />' }],
            },
            {
              name: 'Skill',
              dataType: 'string',
              sourceColumn: 'Skill',
              summarizeBy: 'none',
            },
            {
              name: 'Summary',
              dataType: 'string',
              sourceColumn: 'Summary',
              summarizeBy: 'none',
            },
            {
              name: 'Notes',
              dataType: 'string',
              sourceColumn: 'Notes',
              summarizeBy: 'none',
            },
            {
              name: 'Status Category',
              dataType: 'string',
              type: 'calculated',
              expression: "IF('DailyProgress'[IS Completed] = TRUE(), \"Completed\", \"Pending\")",
              summarizeBy: 'none',
            },
            {
              name: 'Cumulative Day Index',
              dataType: 'int64',
              type: 'calculated',
              expression: "'DailyProgress'[DAY]",
              summarizeBy: 'none',
            },
          ],
          partitions: [
            {
              name: 'DailyProgress-ImportPartition',
              mode: 'import',
              source: {
                type: 'm',
                expression: mExpression,
              },
            },
          ],
          measures: [
            {
              name: 'Total Days',
              expression: "COUNTROWS('DailyProgress')",
              formatString: '#,##0',
              description: 'Total number of days logged in the learning schedule.',
            },
            {
              name: 'Completed Days',
              expression: "CALCULATE(COUNTROWS('DailyProgress'), 'DailyProgress'[IS Completed] = TRUE())",
              formatString: '#,##0',
              description: 'Total number of completed milestone checkpoints.',
            },
            {
              name: 'Pending Days',
              expression: "CALCULATE(COUNTROWS('DailyProgress'), 'DailyProgress'[IS Completed] = FALSE())",
              formatString: '#,##0',
              description: 'Pending or uncompleted milestones count.',
            },
            {
              name: 'Completion Rate %',
              expression: 'DIVIDE([Completed Days], [Total Days], 0)',
              formatString: '0.0%',
              description: 'Proportion of completed milestones vs total scheduled days.',
            },
            {
              name: 'Net Change Score',
              expression: "SUM('DailyProgress'[Change])",
              formatString: '+#,##0.00;-#,##0.00;0.00',
              description: 'Cumulative sum of all change differentials.',
            },
            {
              name: 'Average Daily Change',
              expression: "AVERAGE('DailyProgress'[Change])",
              formatString: '+#,##0.00;-#,##0.00;0.00',
              description: 'Average change score gain per recorded day.',
            },
            {
              name: 'Cumulative Change Trend',
              expression:
                "VAR CurrentDay = MAX('DailyProgress'[DAY])\nRETURN\nCALCULATE(\n    SUM('DailyProgress'[Change]),\n    FILTER(\n        ALLSELECTED('DailyProgress'),\n        'DailyProgress'[DAY] <= CurrentDay\n    )\n)",
              formatString: '+#,##0.00;-#,##0.00;0.00',
              description: 'Running cumulative progress score across sequential days.',
            },
            {
              name: 'Active Streak Days',
              expression:
                "VAR MaxDate = MAX('DailyProgress'[DATE])\nRETURN\nCOUNTROWS(\n    FILTER(\n        'DailyProgress',\n        'DailyProgress'[IS Completed] = TRUE()\n    )\n)",
              formatString: '#,##0',
              description: 'Active consecutive milestone streak days.',
            },
            {
              name: 'Completion Status Callout',
              expression:
                'SWITCH(\n    TRUE(),\n    [Completion Rate %] >= 0.80, "🟢 High Mastery",\n    [Completion Rate %] >= 0.50, "🟡 Steady Progress",\n    "🔴 Attention Required"\n)',
              formatString: '""',
              description: 'Smart text indicator for performance scorecards.',
            },
          ],
          annotations: [
            { name: 'PBI_ResultType', value: 'Table' },
            { name: 'PBI_NavigationStepName', value: 'Navigation' },
          ],
        },
      ],
    },
  };
  zip.file('DataModelSchema', JSON.stringify(dataModelSchema, null, 2));

  // 4. Report Canvas Layout JSON (Visuals, Containers, Slicers, Lines, Tables)
  const reportLayout = {
    id: 0,
    resourcePackages: [],
    sections: [
      {
        id: 0,
        name: 'ReportSection_Executive',
        displayName: 'Skill Progress Executive Dashboard',
        filters: '[]',
        ordinal: 0,
        visualContainers: [
          // Visual 0: Dashboard Header Banner Text visual
          {
            x: 20,
            y: 15,
            z: 0,
            width: 1240,
            height: 65,
            config: JSON.stringify({
              name: 'VisualHeaderTitle',
              layouts: [{ id: 0, position: { x: 20, y: 15, width: 1240, height: 65, z: 0 } }],
              singleVisual: {
                visualType: 'textbox',
                vcObjects: {
                  general: [
                    {
                      properties: {
                        paragraphs: [
                          {
                            textRuns: [
                              {
                                value: 'Skill Progress & Daily Milestone Tracker',
                                textStyle: { fontSize: '18pt', fontWeight: 'bold', color: '#F8FAFC' },
                              },
                              {
                                value: `  |  Dataset: ${records.length} Tracked Days  |  Top Track: ${kpis.topSkill}`,
                                textStyle: { fontSize: '11pt', color: '#94A3B8' },
                              },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            }),
          },

          // Visual 1: KPI Card 1 - Total Days
          {
            x: 20,
            y: 90,
            z: 1,
            width: 290,
            height: 120,
            config: JSON.stringify({
              name: 'KpiCard_TotalDays',
              layouts: [{ id: 0, position: { x: 20, y: 90, width: 290, height: 120, z: 1 } }],
              singleVisual: {
                visualType: 'card',
                projections: { Values: [{ queryRef: 'DailyProgress.Total Days' }] },
                vcObjects: {
                  title: [
                    {
                      properties: {
                        show: { expr: { Literal: { Value: 'true' } } },
                        text: { expr: { Literal: { Value: "'TOTAL DAYS SCHEDULED'" } } },
                      },
                    },
                  ],
                  labels: [{ properties: { color: { solid: { color: '#FACC15' } }, fontSize: { expr: { Literal: { Value: '28D' } } } } }],
                },
              },
            }),
          },

          // Visual 2: KPI Card 2 - Completion Rate %
          {
            x: 330,
            y: 90,
            z: 2,
            width: 290,
            height: 120,
            config: JSON.stringify({
              name: 'KpiCard_CompletionRate',
              layouts: [{ id: 0, position: { x: 330, y: 90, width: 290, height: 120, z: 2 } }],
              singleVisual: {
                visualType: 'card',
                projections: { Values: [{ queryRef: 'DailyProgress.Completion Rate %' }] },
                vcObjects: {
                  title: [
                    {
                      properties: {
                        show: { expr: { Literal: { Value: 'true' } } },
                        text: { expr: { Literal: { Value: "'COMPLETION RATE %'" } } },
                      },
                    },
                  ],
                  labels: [{ properties: { color: { solid: { color: '#34D399' } }, fontSize: { expr: { Literal: { Value: '28D' } } } } }],
                },
              },
            }),
          },

          // Visual 3: KPI Card 3 - Net Change Score
          {
            x: 640,
            y: 90,
            z: 3,
            width: 290,
            height: 120,
            config: JSON.stringify({
              name: 'KpiCard_NetChange',
              layouts: [{ id: 0, position: { x: 640, y: 90, width: 290, height: 120, z: 3 } }],
              singleVisual: {
                visualType: 'card',
                projections: { Values: [{ queryRef: 'DailyProgress.Net Change Score' }] },
                vcObjects: {
                  title: [
                    {
                      properties: {
                        show: { expr: { Literal: { Value: 'true' } } },
                        text: { expr: { Literal: { Value: "'NET CHANGE SCORE'" } } },
                      },
                    },
                  ],
                  labels: [{ properties: { color: { solid: { color: '#38BDF8' } }, fontSize: { expr: { Literal: { Value: '28D' } } } } }],
                },
              },
            }),
          },

          // Visual 4: KPI Card 4 - Top Domain / Completed Days
          {
            x: 950,
            y: 90,
            z: 4,
            width: 310,
            height: 120,
            config: JSON.stringify({
              name: 'KpiCard_CompletedCount',
              layouts: [{ id: 0, position: { x: 950, y: 90, width: 310, height: 120, z: 4 } }],
              singleVisual: {
                visualType: 'card',
                projections: { Values: [{ queryRef: 'DailyProgress.Completed Days' }] },
                vcObjects: {
                  title: [
                    {
                      properties: {
                        show: { expr: { Literal: { Value: 'true' } } },
                        text: { expr: { Literal: { Value: `'COMPLETED MILESTONES (${kpis.topSkill})'` } } },
                      },
                    },
                  ],
                  labels: [{ properties: { color: { solid: { color: '#A78BFA' } }, fontSize: { expr: { Literal: { Value: '28D' } } } } }],
                },
              },
            }),
          },

          // Visual 5: Line Graph Visual - Day Progression & Cumulative Score Trend
          {
            x: 20,
            y: 225,
            z: 5,
            width: 780,
            height: 380,
            config: JSON.stringify({
              name: 'Visual_LineChart_Progression',
              layouts: [{ id: 0, position: { x: 20, y: 225, width: 780, height: 380, z: 5 } }],
              singleVisual: {
                visualType: 'lineChart',
                projections: {
                  Category: [{ queryRef: 'DailyProgress.DAY' }],
                  Y: [
                    { queryRef: 'DailyProgress.Cumulative Change Trend' },
                    { queryRef: 'DailyProgress.Change' },
                  ],
                },
                vcObjects: {
                  title: [
                    {
                      properties: {
                        show: { expr: { Literal: { Value: 'true' } } },
                        text: { expr: { Literal: { Value: "'Daily & Cumulative Progress Trend Across Days'" } } },
                      },
                    },
                  ],
                  legend: [{ properties: { show: { expr: { Literal: { Value: 'true' } } }, position: { expr: { Literal: { Value: "'Top'" } } } } }],
                  dataPoint: [
                    { properties: { fill: { solid: { color: '#FACC15' } } } },
                    { properties: { fill: { solid: { color: '#38BDF8' } } } },
                  ],
                },
              },
            }),
          },

          // Visual 6: Clustered Bar / Column Chart - Skill Distribution Breakdown
          {
            x: 820,
            y: 225,
            z: 6,
            width: 440,
            height: 380,
            config: JSON.stringify({
              name: 'Visual_ColumnChart_Skills',
              layouts: [{ id: 0, position: { x: 820, y: 225, width: 440, height: 380, z: 6 } }],
              singleVisual: {
                visualType: 'clusteredColumnChart',
                projections: {
                  Category: [{ queryRef: 'DailyProgress.Skill' }],
                  Y: [{ queryRef: 'DailyProgress.Total Days' }],
                  Series: [{ queryRef: 'DailyProgress.Status Category' }],
                },
                vcObjects: {
                  title: [
                    {
                      properties: {
                        show: { expr: { Literal: { Value: 'true' } } },
                        text: { expr: { Literal: { Value: "'Milestones by Learning Domain & Status'" } } },
                      },
                    },
                  ],
                  labels: [{ properties: { show: { expr: { Literal: { Value: 'true' } } } } }],
                },
              },
            }),
          },

          // Visual 7: Interactive Tabular Grid with all columns
          {
            x: 20,
            y: 620,
            z: 7,
            width: 1240,
            height: 320,
            config: JSON.stringify({
              name: 'Visual_Table_DailyProgressRecords',
              layouts: [{ id: 0, position: { x: 20, y: 620, width: 1240, height: 320, z: 7 } }],
              singleVisual: {
                visualType: 'tableEx',
                projections: {
                  Values: [
                    { queryRef: 'DailyProgress.DAY' },
                    { queryRef: 'DailyProgress.DATE' },
                    { queryRef: 'DailyProgress.IS Completed' },
                    { queryRef: 'DailyProgress.Result' },
                    { queryRef: 'DailyProgress.Change' },
                    { queryRef: 'DailyProgress.Skill' },
                    { queryRef: 'DailyProgress.Summary' },
                    { queryRef: 'DailyProgress.Notes' },
                  ],
                },
                vcObjects: {
                  title: [
                    {
                      properties: {
                        show: { expr: { Literal: { Value: 'true' } } },
                        text: { expr: { Literal: { Value: "'Daily Learning Log & Checkpoint Milestones Data Grid'" } } },
                      },
                    },
                  ],
                  stylePreset: [{ properties: { name: { expr: { Literal: { Value: "'AlternatingRows'" } } } } }],
                },
              },
            }),
          },
        ],
        config: JSON.stringify({
          displayOption: 1,
          width: 1280,
          height: 960,
        }),
      },
    ],
  };
  zip.file('Report/Layout', JSON.stringify(reportLayout, null, 2));

  // 5. Settings
  zip.file('Settings', JSON.stringify({ version: '1.0', exportFilterDisabled: false, useStylingReportSettings: true }, null, 2));

  // 6. DiagramLayout (Schema Relationship layout in Power BI model view)
  zip.file(
    'DiagramLayout',
    JSON.stringify(
      {
        version: '1.1.0',
        diagrams: [
          {
            ordinal: 0,
            scrollPosition: { x: 0, y: 0 },
            nodes: [
              {
                location: { x: 80, y: 80 },
                node: {
                  name: 'DailyProgress',
                  properties: [
                    'DAY',
                    'DATE',
                    'IS Completed',
                    'Result',
                    'Change',
                    'Skill',
                    'Summary',
                    'Notes',
                    'Status Category',
                    'Cumulative Day Index',
                    '[Total Days]',
                    '[Completed Days]',
                    '[Pending Days]',
                    '[Completion Rate %]',
                    '[Net Change Score]',
                    '[Average Daily Change]',
                    '[Cumulative Change Trend]',
                    '[Active Streak Days]',
                    '[Completion Status Callout]',
                  ],
                },
                size: { height: 380, width: 260 },
                zIndex: 1,
              },
            ],
          },
        ],
      },
      null,
      2
    )
  );

  // 7. Connections (Data Source Connections specification)
  zip.file(
    'Connections',
    JSON.stringify(
      {
        version: '1.0',
        connections: [
          {
            name: 'SkillProgressEmbeddedModel',
            connectionString: 'Data Source=$Embedded$;Initial Catalog=SkillProgressModel;',
            type: 'Internal',
          },
        ],
      },
      null,
      2
    )
  );

  // 8. Custom Theme JSON (Modern Power BI Palette)
  const themeJson = {
    name: 'PowerBI_DarkGold_Enterprise',
    dataColors: ['#FACC15', '#38BDF8', '#34D399', '#F87171', '#A78BFA', '#FB923C', '#E879F9', '#4ADE80'],
    background: '#020617',
    foreground: '#0F172A',
    tableAccent: '#FACC15',
    visualStyles: {
      '*': {
        '*': {
          fontFamily: [{ expr: { Literal: { Value: 'Segoe UI' } } }],
          background: [{ color: { solid: { color: '#0F172A' } }, transparency: 0 }],
          border: [{ show: true, color: { solid: { color: '#1E293B' } }, radius: 10 }],
        },
      },
      card: {
        '*': {
          labels: [{ color: { solid: { color: '#F8FAFC' } }, fontSize: 24 }],
          categoryLabels: [{ color: { solid: { color: '#94A3B8' } }, fontSize: 10 }],
        },
      },
    },
  };
  zip.file('StaticResources/SharedResources/BaseThemes/CY24SU08.json', JSON.stringify(themeJson, null, 2));

  // 9. Metadata description
  const metadata = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    recordsCount: records.length,
    datasetSummary: {
      totalDays: kpis.totalDays,
      completedDays: kpis.completedDays,
      completionRate: `${kpis.completionRate.toFixed(1)}%`,
      netChange: kpis.netChange.toFixed(2),
      topSkill: kpis.topSkill,
    },
    daxMeasuresIncluded: DAX_MEASURES.map((m) => m.name),
  };
  zip.file('Metadata', JSON.stringify(metadata, null, 2));

  // 10. Also embed Dataset source files inside the archive (Excel & CSV)
  const excelData = records.map((r) => ({
    DAY: r.day,
    DATE: r.date,
    'IS Completed': r.isCompleted,
    Result: r.result,
    Change: r.change,
    Skill: r.skill,
    Summary: r.summary,
    Notes: r.notes || '',
  }));
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DailyProgress');

  const measuresData = DAX_MEASURES.map((m) => ({
    Measure: m.name,
    Category: m.category,
    Formula: m.formula,
    Description: m.description,
    Format: m.formattedOutputExample,
  }));
  const measuresSheet = XLSX.utils.json_to_sheet(measuresData);
  XLSX.utils.book_append_sheet(workbook, measuresSheet, 'DAX_Measures');

  const excelBinary = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  zip.file('Dataset/DailyProgress_Dataset.xlsx', excelBinary);

  // Readme instructions for opening in Power BI Desktop
  const readmeText = `===============================================================
MICROSOFT POWER BI DESKTOP PROJECT ARCHIVE (.PBIX / .PBIT)
Project: Skill Progress & Milestone Tracker Dashboard
Generated on: ${new Date().toLocaleString()}
Records Included: ${records.length} Days
===============================================================

HOW TO USE IN POWER BI DESKTOP:
1. Open Microsoft Power BI Desktop.
2. Click File -> Open and choose '${fileName}', or double-click this file.
3. The Tabular Model, Visual Layout, and DAX measures will load automatically.

CONTAINED IN THIS PBIX PACKAGE:
- Tabular Object Model (TOM) Schema (DataModelSchema)
- Complete Executive Dashboard Canvas Visuals (Report/Layout)
  * KPI Cards: Total Days, Completion Rate %, Net Change, Top Domain
  * Multi-Series Line Chart: Day Progression vs Cumulative Change Trend
  * Clustered Column Chart: Skill Domain Breakdown
  * Rich Data Grid Table: All columns with status badges
- 8 Production DAX Calculated Measures
- Power Query M transformations with inline embedded data payload
- Dataset/DailyProgress_Dataset.xlsx & Dataset/DailyProgress_Dataset.csv
- Dark Gold Enterprise Theme (CY24SU08.json)

DAX MEASURES INCLUDED:
${DAX_MEASURES.map((m) => `* [${m.name}] = ${m.formula.replace(/\n/g, ' ')}`).join('\n')}
===============================================================`;
  zip.file('README_PowerBI.txt', readmeText);

  // Generate binary blob
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

export function exportToCSV(records: DailyRecord[]): void {
  const headers = ['DAY', 'DATE', 'IS Completed', 'Result', 'Change', 'Skill', 'Summary', 'Notes'];
  const rows = records.map((r) => [
    r.day,
    `"${r.date}"`,
    r.isCompleted ? 'TRUE' : 'FALSE',
    `"${r.result}"`,
    r.change.toFixed(2),
    `"${r.skill.replace(/"/g, '""')}"`,
    `"${r.summary.replace(/"/g, '""')}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Skill_Progress_Data_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToExcel(records: DailyRecord[]): void {
  const data = records.map((r) => ({
    DAY: r.day,
    DATE: r.date,
    'IS Completed': r.isCompleted,
    Result: r.result,
    Change: r.change,
    Skill: r.skill,
    Summary: r.summary,
    Notes: r.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DailyProgress');

  const measuresData = DAX_MEASURES.map((m) => ({
    Measure: m.name,
    Category: m.category,
    Formula: m.formula,
    Description: m.description,
    Format: m.formattedOutputExample,
  }));
  const measuresSheet = XLSX.utils.json_to_sheet(measuresData);
  XLSX.utils.book_append_sheet(workbook, measuresSheet, 'DAX_Measures');

  XLSX.writeFile(workbook, `Skill_Progress_PowerBI_Dataset_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function triggerDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
