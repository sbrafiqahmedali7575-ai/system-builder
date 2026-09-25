import { DailyRecord, KPIStats } from '../types';

export interface DaxMeasure {
  id: string;
  name: string;
  category: 'KPI' | 'Time Intelligence' | 'Accumulator' | 'Status';
  formula: string;
  description: string;
  formattedOutputExample: string;
}

export const DAX_MEASURES: DaxMeasure[] = [
  {
    id: 'm1',
    name: 'Total Days',
    category: 'KPI',
    formula: `Total Days = COUNTROWS('DailyProgress')`,
    description: 'Calculates the total count of tracked days in the dataset.',
    formattedOutputExample: '14 Days',
  },
  {
    id: 'm2',
    name: 'Completed Days',
    category: 'KPI',
    formula: `Completed Days = \nCALCULATE(\n    COUNTROWS('DailyProgress'),\n    'DailyProgress'[IS Completed] = TRUE()\n)`,
    description: 'Counts the number of successfully completed milestones.',
    formattedOutputExample: '11 Days',
  },
  {
    id: 'm3',
    name: 'Completion Rate %',
    category: 'KPI',
    formula: `Completion Rate % = \nDIVIDE(\n    [Completed Days],\n    [Total Days],\n    0\n)`,
    description: 'Percentage of milestones marked as completed against total scheduled days.',
    formattedOutputExample: '78.6%',
  },
  {
    id: 'm4',
    name: 'Net Change Score',
    category: 'Accumulator',
    formula: `Net Change Score = SUM('DailyProgress'[Change])`,
    description: 'Sum of all positive and negative change differentials.',
    formattedOutputExample: '+3.80%',
  },
  {
    id: 'm5',
    name: 'Cumulative Change Trend',
    category: 'Accumulator',
    formula: `Cumulative Change Trend = \nVAR CurrentDay = MAX('DailyProgress'[DAY])\nRETURN\nCALCULATE(\n    SUM('DailyProgress'[Change]),\n    FILTER(\n        ALLSELECTED('DailyProgress'),\n        'DailyProgress'[DAY] <= CurrentDay\n    )\n)`,
    description: 'Calculates running cumulative sum of change score across Day sequence.',
    formattedOutputExample: 'Running Total Line',
  },
  {
    id: 'm6',
    name: 'Average Daily Change',
    category: 'KPI',
    formula: `Average Daily Change = AVERAGE('DailyProgress'[Change])`,
    description: 'Mean progress/change value per day.',
    formattedOutputExample: '+0.27 / day',
  },
  {
    id: 'm7',
    name: 'Completion Status Callout',
    category: 'Status',
    formula: `Completion Status Callout = \nSWITCH(\n    TRUE(),\n    [Completion Rate %] >= 0.80, "🟢 High Mastery",\n    [Completion Rate %] >= 0.50, "🟡 Steady Progress",\n    "🔴 Attention Required"\n)`,
    description: 'Dynamic text callout for Power BI Smart Narrative and KPI Cards.',
    formattedOutputExample: '🟢 High Mastery',
  },
  {
    id: 'm8',
    name: 'Active Streak Days',
    category: 'KPI',
    formula: `Active Streak Days = \n// Calculates consecutive completed days up to latest date\nVAR MaxDate = MAX('DailyProgress'[DATE])\nRETURN\nCOUNTROWS(\n    FILTER(\n        'DailyProgress',\n        'DailyProgress'[IS Completed] = TRUE()\n    )\n)`,
    description: 'Tracks continuous learning velocity without gaps.',
    formattedOutputExample: '8 Days',
  }
];

export function calculateKPIStats(records: DailyRecord[]): KPIStats {
  if (records.length === 0) {
    return {
      totalDays: 0,
      completedDays: 0,
      pendingDays: 0,
      completionRate: 0,
      netChange: 0,
      avgChange: 0,
      currentStreak: 0,
      maxStreak: 0,
      uniqueSkillsCount: 0,
      topSkill: 'None',
      positiveDaysCount: 0,
      negativeDaysCount: 0,
    };
  }

  const totalDays = records.length;
  const completedDays = records.filter((r) => r.isCompleted).length;
  const pendingDays = totalDays - completedDays;
  const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;
  
  const netChange = records.reduce((sum, r) => sum + (Number(r.change) || 0), 0);
  const avgChange = totalDays > 0 ? netChange / totalDays : 0;

  // Default streak calculation (No rules: consecutive completed days)
  const sorted = [...records].sort((a, b) => a.day - b.day);
  let currentStreak = 0;
  if (sorted.length > 0) {
    const lastIdx = sorted.length - 1;
    let startIdx = lastIdx;

    if (sorted[lastIdx].isCompleted) {
      startIdx = lastIdx;
    } else if (lastIdx > 0 && sorted[lastIdx - 1].isCompleted) {
      // If current latest day is pending, streak from previous day is active
      startIdx = lastIdx - 1;
    } else {
      startIdx = -1;
    }

    if (startIdx >= 0) {
      for (let i = startIdx; i >= 0; i--) {
        if (sorted[i].isCompleted) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  // Max streak: longest unbroken run of completed days
  let maxStreak = 0;
  let running = 0;
  for (const r of sorted) {
    if (r.isCompleted) {
      running++;
      if (running > maxStreak) {
        maxStreak = running;
      }
    } else {
      running = 0;
    }
  }
  if (currentStreak > maxStreak) {
    maxStreak = currentStreak;
  }

  // Skills breakdown
  const skillCounts: Record<string, number> = {};
  records.forEach((r) => {
    skillCounts[r.skill] = (skillCounts[r.skill] || 0) + 1;
  });

  const uniqueSkillsCount = Object.keys(skillCounts).length;
  let topSkill = 'Excel';
  let topSkillCount = -1;
  Object.entries(skillCounts).forEach(([skill, count]) => {
    if (count > topSkillCount) {
      topSkillCount = count;
      topSkill = skill;
    }
  });

  const positiveDaysCount = records.filter((r) => r.change > 0).length;
  const negativeDaysCount = records.filter((r) => r.change < 0).length;

  return {
    totalDays,
    completedDays,
    pendingDays,
    completionRate,
    netChange,
    avgChange,
    currentStreak,
    maxStreak,
    uniqueSkillsCount,
    topSkill,
    positiveDaysCount,
    negativeDaysCount,
  };
}

export function generatePowerQueryM(records: DailyRecord[]): string {
  const rowsFormatted = records
    .map(
      (r) =>
        `        {${r.day}, "${r.date}", ${r.isCompleted ? 'true' : 'false'}, "${r.result}", ${r.change.toFixed(2)}, "${r.skill}", "${r.summary}"}`
    )
    .join(',\n');

  return `let
    Source = Table.FromRows(
        Json.Document(Binary.Decompress(Binary.FromText("", BinaryEncoding.Base64), Compression.Deflate)), 
        let _t = ((type nullable text) meta [Serialized.Text = true]) in 
        type table [DAY = _t, DATE = _t, #"IS Completed" = _t, Result = _t, Change = _t, Skill = _t, Summary = _t]
    ),
    // Static / Live Raw Data Table generated from App
    DataPayload = #table(
        {"DAY", "DATE", "IS Completed", "Result", "Change", "Skill", "Summary"},
        {
${rowsFormatted}
        }
    ),
    #"Changed Type" = Table.TransformColumnTypes(DataPayload, {
        {"DAY", Int64.Type},
        {"DATE", type text},
        {"IS Completed", type logical},
        {"Result", type text},
        {"Change", type number},
        {"Skill", type text},
        {"Summary", type text}
    }),
    #"Added Cumulative Column" = Table.AddColumn(#"Changed Type", "Cumulative Index", each [DAY], Int64.Type)
in
    #"Added Cumulative Column"`;
}
