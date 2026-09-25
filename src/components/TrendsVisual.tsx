import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import { DailyRecord, DashboardTheme } from '../types';
import {
  calculateMovingAverageTrends,
  MovingAveragePoint,
} from '../utils/trendCalculations';
import { standardizeDate } from '../utils/dateUtils';

interface TrendsVisualProps {
  records: DailyRecord[];
  theme: DashboardTheme;
  onToggleRecordStatus?: (id: string) => void;
  variant?: 'full' | 'chart' | 'summary';
}

export const TrendsVisual: React.FC<TrendsVisualProps> = ({
  records,
  theme,
  onToggleRecordStatus,
  variant = 'full',
}) => {
  const isDark = theme === 'dark';
  const showSummary = variant !== 'chart';
  const showChart = variant !== 'summary';
  const [windowSize] = useState<number>(7);
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<MovingAveragePoint | null>(null);

  // Compute fixed tracked-week trend metrics
  const trendData = useMemo(() => {
    return calculateMovingAverageTrends(records, windowSize);
  }, [records, windowSize]);

  const {
    points,
    highProductivityPeriods,
    lowProductivityPeriods,
    highProductivityDaysCount: highProductivityWeeksCount,
    lowProductivityDaysCount: lowProductivityWeeksCount,
  } = trendData;

  const analyzedWeeksCount = points.length;
  const highProductivityShare = analyzedWeeksCount > 0
    ? (highProductivityWeeksCount / analyzedWeeksCount) * 100
    : 0;
  const lowProductivityShare = analyzedWeeksCount > 0
    ? (lowProductivityWeeksCount / analyzedWeeksCount) * 100
    : 0;
  const steadyProductivityWeeksCount = points.filter((point) => point.productivityLevel === 'STEADY').length;
  const steadyProductivityShare = analyzedWeeksCount > 0
    ? (steadyProductivityWeeksCount / analyzedWeeksCount) * 100
    : 0;

  // Chart dimensions
  const svgWidth = 840;
  const svgHeight = 252;
  const padLeft = 46;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 34;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  // Calculate coordinates for points
  const pointsWithCoords = useMemo(() => {
    if (points.length === 0) return [];
    const count = points.length;
    const stepX = count > 1 ? chartWidth / (count - 1) : chartWidth / 2;

    return points.map((p, idx) => {
      const x = padLeft + (count > 1 ? idx * stepX : chartWidth / 2);
      // y from 0% (chartHeight) to 100% (0)
      const clampedRate = Math.min(100, Math.max(0, p.movingAverageRate));
      const y = padTop + chartHeight - (clampedRate / 100) * chartHeight;
      return {
        ...p,
        x,
        y,
      };
    });
  }, [points, chartWidth, chartHeight, padLeft, padTop]);

  // Generate SVG path for line and area
  const { linePath, areaPath } = useMemo(() => {
    if (pointsWithCoords.length === 0) return { linePath: '', areaPath: '' };
    if (pointsWithCoords.length === 1) {
      const p = pointsWithCoords[0];
      return {
        linePath: `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y}`,
        areaPath: `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y} L ${p.x + 20} ${padTop + chartHeight} L ${p.x - 20} ${padTop + chartHeight} Z`,
      };
    }

    // Build smooth curve or straight segment line
    let d = `M ${pointsWithCoords[0].x} ${pointsWithCoords[0].y}`;
    for (let i = 1; i < pointsWithCoords.length; i++) {
      const prev = pointsWithCoords[i - 1];
      const curr = pointsWithCoords[i];
      // Catmull-Rom or cubic Bezier smoothing
      const midX = (prev.x + curr.x) / 2;
      d += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const first = pointsWithCoords[0];
    const last = pointsWithCoords[pointsWithCoords.length - 1];
    const bottomY = padTop + chartHeight;
    const aPath = `${d} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;

    return { linePath: d, areaPath: aPath };
  }, [pointsWithCoords, padTop, chartHeight]);

  const target80Y = padTop + chartHeight - (80 / 100) * chartHeight;
  const target50Y = padTop + chartHeight - (50 / 100) * chartHeight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={
        variant === 'full'
          ? `ui-motion-section p-2.5 sm:p-3 rounded-2xl border space-y-3 ${
              isDark
                ? 'bg-slate-900/60 border-slate-800'
                : 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
            }`
          : 'w-full h-full flex flex-col'
      }
    >
      {showSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className={`ui-motion-card w-full p-2 sm:p-2.5 rounded-xl border relative overflow-hidden ${
            isDark
              ? 'bg-slate-900/70 border-slate-800'
              : 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500 opacity-80" />

          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-500 dark:text-slate-400">
                Weekly Productivity Summary
              </p>
              <p className="text-[10px] text-slate-400">
                Fixed 7-day performance buckets
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-lg font-black font-mono text-slate-800 dark:text-slate-100">
                {analyzedWeeksCount}
              </span>
              <span className="ml-1 text-[10px] font-bold text-slate-400">
                weeks analyzed
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800">
            <div className="pr-2 sm:pr-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400/30 flex items-center justify-center shrink-0">
                  <Flame className="w-3.5 h-3.5 text-blue-500" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-blue-600 dark:text-blue-300">
                    High
                  </p>
                  <p className="text-[9px] text-slate-400">≥80%</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-blue-500">
                  {highProductivityWeeksCount}
                </span>
                <span className="text-[10px] text-slate-400">weeks</span>
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {Math.round(highProductivityShare)}% of analyzed weeks
              </p>
              <p className="text-[9px] text-slate-400">
                {highProductivityPeriods.length} peak streak{highProductivityPeriods.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="px-2 sm:px-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400/30 flex items-center justify-center shrink-0">
                  <Gauge className="w-3.5 h-3.5 text-amber-500" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-amber-600 dark:text-amber-300">
                    Steady
                  </p>
                  <p className="text-[9px] text-slate-400">50–79%</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-500">
                  {steadyProductivityWeeksCount}
                </span>
                <span className="text-[10px] text-slate-400">weeks</span>
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {Math.round(steadyProductivityShare)}% of analyzed weeks
              </p>
              <p className="text-[9px] text-slate-400">
                Weeks maintaining steady progress
              </p>
            </div>

            <div className="pl-2 sm:pl-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 ring-2 ring-rose-400/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-rose-600 dark:text-rose-300">
                    Low
                  </p>
                  <p className="text-[9px] text-slate-400">&lt;50%</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className={`text-xl sm:text-2xl font-black font-mono ${
                  lowProductivityWeeksCount > 0 ? 'text-rose-500' : 'text-slate-400'
                }`}>
                  {lowProductivityWeeksCount}
                </span>
                <span className="text-[10px] text-slate-400">weeks</span>
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {Math.round(lowProductivityShare)}% of analyzed weeks
              </p>
              <p className="text-[9px] text-slate-400">
                {lowProductivityPeriods.length > 0
                  ? `${lowProductivityPeriods.length} recovery window${lowProductivityPeriods.length === 1 ? '' : 's'}`
                  : 'Zero low-productivity weeks'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {showChart && (
      <>
      {/* Weekly Interactive SVG Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.992 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.42, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2 }}
        className={`system-task-card ui-motion-section h-full flex-1 p-2 sm:p-2.5 rounded-2xl border flex flex-col transition-all ${

        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}>
        <div className="flex items-center justify-between mb-1 text-xs flex-wrap gap-1">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                High Productivity (≥80%)
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Steady (50–79%)
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Low Productivity (&lt;50%)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setShowDataLabels((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded-lg text-[11px] font-semibold transition-colors border cursor-pointer ${
                showDataLabels
                  ? isDark
                    ? 'bg-blue-950/60 border-blue-700/60 text-blue-300'
                    : 'bg-blue-50 border-blue-300 text-blue-800'
                  : isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
              }`}
              title="Toggle data value labels on line chart"
            >
              Data Labels: {showDataLabels ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* SVG Container */}
        <div className="w-full flex-1 overflow-hidden flex items-center">
          <div className="w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none"
            >
              <defs>
                {/* Gradient for area fill under line */}
                <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={isDark ? "0.35" : "0.25"} />
                  <stop offset="60%" stopColor="#2563eb" stopOpacity={isDark ? "0.15" : "0.10"} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
                </linearGradient>

                <linearGradient id="trendStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="50%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>

              {/* Shaded High Productivity Zone Background (>=80%) */}
              <rect
                x={padLeft}
                y={padTop}
                width={chartWidth}
                height={target80Y - padTop}
                fill={isDark ? "rgba(16, 185, 129, 0.06)" : "rgba(16, 185, 129, 0.08)"}
              />

              {/* Shaded Low Productivity Zone Background (<50%) */}
              <rect
                x={padLeft}
                y={target50Y}
                width={chartWidth}
                height={padTop + chartHeight - target50Y}
                fill={isDark ? "rgba(244, 63, 94, 0.06)" : "rgba(244, 63, 94, 0.06)"}
              />

              {/* Horizontal Grid Lines */}
              {[100, 80, 50, 20, 0].map((val) => {
                const y = padTop + chartHeight - (val / 100) * chartHeight;
                return (
                  <g key={val}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + chartWidth}
                      y2={y}
                      stroke={
                        val === 80
                          ? 'rgba(16, 185, 129, 0.45)'
                          : val === 50
                          ? 'rgba(244, 63, 94, 0.4)'
                          : isDark
                          ? 'rgba(51, 65, 85, 0.4)'
                          : 'rgba(226, 232, 240, 0.8)'
                      }
                      strokeWidth={val === 80 || val === 50 ? 1.5 : 1}
                      strokeDasharray={val === 80 || val === 50 ? '4 3' : undefined}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight={val === 80 ? 'bold' : 'normal'}
                      fill={
                        val === 80
                          ? isDark ? '#60a5fa' : '#1d4ed8'
                          : val === 50
                          ? isDark ? '#fb7185' : '#e11d48'
                          : isDark ? '#64748b' : '#94a3b8'
                      }
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* High Productivity Threshold Pill (80%) */}
              <text
                x={padLeft + chartWidth - 4}
                y={target80Y - 5}
                textAnchor="end"
                fontSize="10"
                fontWeight="bold"
                fill={isDark ? '#60a5fa' : '#1d4ed8'}
              >
                ★ 80% High Productivity Target
              </text>

              {/* Low Productivity Threshold Pill (50%) */}
              <text
                x={padLeft + chartWidth - 4}
                y={target50Y + 12}
                textAnchor="end"
                fontSize="10"
                fontWeight="bold"
                fill={isDark ? '#fb7185' : '#e11d48'}
              >
                ⚠ 50% Productivity Dip Line
              </text>

              {/* Area fill */}
              {areaPath && (
                <motion.path
                  d={areaPath}
                  fill="url(#trendAreaGradient)"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.18 }}
                />
              )}

              {/* Curve Stroke */}
              {linePath && (
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke="url(#trendStrokeGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ pathLength: { duration: 1.05, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2 } }}
                />
              )}

              {/* Data points */}
              {pointsWithCoords.map((pt) => {
                const isSelected = selectedPoint?.weekNumber === pt.weekNumber;
                const isHigh = pt.productivityLevel === 'HIGH';
                const isLow = pt.productivityLevel === 'LOW';

                return (
                  <g key={`pt-week-${pt.weekNumber}`}>
                    {/* Pulsing ring for selected point */}
                    {isSelected && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="10"
                        fill="none"
                        stroke={isHigh ? '#2563eb' : isLow ? '#f43f5e' : '#f59e0b'}
                        strokeWidth="2"
                        className="animate-ping"
                      />
                    )}

                    {/* Point Circle */}
                    <motion.circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? '6' : '4.5'}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: Math.min(0.45, pt.weekNumber * 0.04) }}
                      fill={
                        isHigh
                          ? '#2563eb'
                          : isLow
                          ? '#f43f5e'
                          : '#f59e0b'
                      }
                      stroke={isDark ? '#0f172a' : '#ffffff'}
                      strokeWidth="2"
                      className="cursor-pointer transition-all duration-150 hover:r-7"
                      onClick={() => setSelectedPoint(pt)}
                      onMouseEnter={() => setSelectedPoint(pt)}
                    />

                    {/* Data label displaying fixed-week completion rate and full-week status icon */}
                    {showDataLabels && (() => {
                      const isNearTop = pt.y < padTop + 8;
                      const labelY = isNearTop ? pt.y + 7 : pt.y - 20;
                      const iconCenterY = labelY + 7;
                      const textY = labelY + 10.2;
                      const valueText = `${pt.movingAverageRate.toFixed(1)}%`;
                      const isCompleted = pt.isCompleted;

                      return (
                        <g className="pointer-events-none select-none">
                          <rect
                            x={pt.x - 24}
                            y={labelY}
                            width={48}
                            height={14}
                            rx={4}
                            fill={isDark ? '#090d16' : '#ffffff'}
                            stroke={
                              isSelected
                                ? '#38bdf8'
                                : isHigh
                                ? isDark ? '#1d4ed8' : '#2563eb'
                                : isLow
                                ? isDark ? '#e11d48' : '#f43f5e'
                                : isDark ? '#d97706' : '#f59e0b'
                            }
                            strokeWidth={isSelected ? 1.5 : 0.8}
                            fillOpacity={isDark ? 0.95 : 0.98}
                          />

                          {/* Completed (Checkmark) / Not Completed (Cross) Status Icon */}
                          {isCompleted ? (
                            <g>
                              <circle
                                cx={pt.x - 15}
                                cy={iconCenterY}
                                r={3.8}
                                fill="#2563eb"
                              />
                              <path
                                d={`M ${pt.x - 17.2} ${iconCenterY + 0.1} l 1.5 1.5 l 3.2 -3.2`}
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="1.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </g>
                          ) : (
                            <g>
                              <circle
                                cx={pt.x - 15}
                                cy={iconCenterY}
                                r={3.8}
                                fill="#f43f5e"
                              />
                              <path
                                d={`M ${pt.x - 16.6} ${iconCenterY - 1.6} L ${pt.x - 13.4} ${iconCenterY + 1.6} M ${pt.x - 13.4} ${iconCenterY - 1.6} L ${pt.x - 16.6} ${iconCenterY + 1.6}`}
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="1.1"
                                strokeLinecap="round"
                              />
                            </g>
                          )}

                          <text
                            x={pt.x + 6}
                            y={textY}
                            textAnchor="middle"
                            fontSize="8"
                            fontFamily="monospace"
                            fontWeight="700"
                            fill={
                              isSelected
                                ? '#38bdf8'
                                : isHigh
                                ? isDark ? '#60a5fa' : '#1e40af'
                                : isLow
                                ? isDark ? '#fb7185' : '#be123c'
                                : isDark ? '#fcd34d' : '#b45309'
                            }
                          >
                            {valueText}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Fixed tracked-week X-axis label */}
                    <text
                      x={pt.x}
                      y={padTop + chartHeight + 18}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily="monospace"
                      fill={isDark ? '#94a3b8' : '#64748b'}
                    >
                      W{pt.weekNumber}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Selected Point Tooltip Callout */}
        <AnimatePresence>
          {selectedPoint && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={`mt-1.5 p-1.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-1.5 ${
                selectedPoint.productivityLevel === 'HIGH'
                  ? isDark
                    ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                    : 'bg-blue-50 border-blue-300 text-blue-900'
                  : selectedPoint.productivityLevel === 'LOW'
                  ? isDark
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                  : isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold px-1 py-0.5 rounded bg-black/20 text-xs">
                  Week {selectedPoint.weekNumber}
                </span>
                <span className="font-semibold">
                  D{selectedPoint.startDay}–D{selectedPoint.endDay}
                </span>
                <span className="text-slate-400">
                  {standardizeDate(selectedPoint.startDate)} – {standardizeDate(selectedPoint.endDate)}
                </span>
                <span>•</span>
                <span>
                  <strong>{selectedPoint.completedInWindow} / {selectedPoint.totalInWindow} completed</strong> ({selectedPoint.movingAverageRate}%)
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <span className={`px-1 py-0.5 rounded-full font-bold text-[11px] ${
                  selectedPoint.productivityLevel === 'HIGH'
                    ? 'bg-blue-500 text-white'
                    : selectedPoint.productivityLevel === 'LOW'
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}>
                  {selectedPoint.productivityLevel === 'HIGH'
                    ? 'High Productivity Period'
                    : selectedPoint.productivityLevel === 'LOW'
                    ? 'Productivity Dip'
                    : 'Steady Progression'}
                </span>
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="px-1 py-0.5 text-[11px] rounded bg-black/10 hover:bg-black/20 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </>
      )}
    </motion.div>
  );
};
