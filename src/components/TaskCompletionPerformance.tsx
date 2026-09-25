import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { DashboardTheme, TaskItem } from '../types';
import {
  CONFIGURED_TIMEZONE,
  getIsoDateKeyInTimezone,
  toInputDateValue,
} from '../utils/taskDateUtils';

interface TaskCompletionPerformanceProps {
  tasks: TaskItem[];
  theme: DashboardTheme;
}

interface DailyTaskPerformance {
  dateKey: string;
  label: string;
  completed: number;
  total: number;
  percentage: number;
}

function formatShortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export const TaskCompletionPerformance: React.FC<TaskCompletionPerformanceProps> = ({
  tasks,
  theme,
}) => {
  const isDark = theme === 'dark';
  const todayKey = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);

  const chartData = useMemo<DailyTaskPerformance[]>(() => {
    const byDate = new Map<string, { total: number; completed: number }>();

    tasks.forEach((task) => {
      const dateKey = toInputDateValue(task.taskKey);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      if (dateKey > todayKey) return;

      const current = byDate.get(dateKey) || { total: 0, completed: 0 };
      current.total += 1;
      if (task.isCompleted) current.completed += 1;
      byDate.set(dateKey, current);
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([dateKey, counts]) => ({
        dateKey,
        label: formatShortDate(dateKey),
        completed: counts.completed,
        total: counts.total,
        percentage:
          counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      }));
  }, [tasks, todayKey]);

  const latestPercentage =
    chartData.length > 0 ? chartData[chartData.length - 1].percentage : 0;

  const averagePercentage =
    chartData.length > 0
      ? Math.round(
          chartData.reduce((sum, point) => sum + point.percentage, 0) /
            chartData.length
        )
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.36, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={`ui-motion-section h-full min-h-[260px] p-3 rounded-2xl border flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400/30 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Task Completion Performance
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Daily completed tasks ÷ total tasks
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-300">
            {latestPercentage}%
          </div>
          <div className="text-[9px] font-bold text-slate-400">latest day</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="font-bold text-slate-500 dark:text-slate-400">
          Last {chartData.length || 0} active day{chartData.length === 1 ? '' : 's'}
        </span>
        <span className="font-black text-slate-700 dark:text-slate-200">
          Avg {averagePercentage}%
        </span>
      </div>

      <div className="mt-2 flex-1 min-h-[180px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? '#334155' : '#e2e8f0'}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number, _name, item) => [
                  `${value}% (${item.payload.completed}/${item.payload.total})`,
                  'Completion',
                ]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  borderRadius: 10,
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  background: isDark ? '#0f172a' : '#ffffff',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={650}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full min-h-[180px] flex items-center justify-center text-center px-4">
            <div>
              <Activity className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Add tasks and complete them to build your daily performance trend.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
