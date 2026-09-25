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
import { AnimatedProgressRing } from './AnimatedProgressRing';

interface TrendsVisualProps {
  records: DailyRecord[];
  theme: DashboardTheme;
  onToggleRecordStatus?: (id: string) => void;
}

export const TrendsVisual: React.FC<TrendsVisualProps> = ({
  records,
  theme,
  onToggleRecordStatus,
}) => {
  const isDark = theme === 'dark';
  const [windowSize] = useState<number>(7);
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<MovingAveragePoint | null>(null);

  // Compute trend metrics
  const trendData = useMemo(() => {
    return calculateMovingAverageTrends(records, windowSize);
  }, [records, windowSize]);

  const {
    points,
    highProductivityPeriods,
    lowProductivityPeriods,
    highProductivityDaysCount,
    lowProductivityDaysCount,
  } = trendData;

  const analyzedDaysCount = points.length;
  const highProductivityShare = analyzedDaysCount > 0
    ? (highProductivityDaysCount / analyzedDaysCount) * 100
    : 0;
  const lowProductivityShare = analyzedDaysCount > 0
    ? (lowProductivityDaysCount / analyzedDaysCount) * 100
    : 0;
  const steadyProductivityDaysCount = points.filter((point) => point.productivityLevel === 'STEADY').length;
  const steadyProductivityShare = analyzedDaysCount > 0
    ? (steadyProductivityDaysCount / analyzedDaysCount) * 100
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
      className={`ui-motion-section p-2.5 sm:p-3 rounded-2xl border space-y-3 ${
        isDark
          ? 'bg-slate-900/60 border-slate-800'
          : 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
      }`}
    >
      {/* 1. Productivity Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 sm:gap-2">
        {/* Card 1: High Productivity */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.995 }}
          className={`ui-motion-card p-2 rounded-xl border min-h-[118px] relative overflow-hidden group flex flex-col justify-between ${
            isDark
              ? 'bg-slate-900/40 border-slate-800 hover:border-blue-700/60'
              : 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:shadow-md'
          }`}
        >
          <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-blue-500/8 group-hover:scale-125 transition-transform duration-500" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 opacity-70" />

          <div className="relative flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
              High Productivity
            </span>
            <motion.div
              initial={{ scale: 0.72, rotate: -12, opacity: 0 }}
              whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400/30 flex items-center justify-center"
            >
              <Flame className="w-3.5 h-3.5 text-blue-500" />
            </motion.div>
          </div>

          <div className="relative mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold font-mono text-blue-500">
                  {highProductivityDaysCount}
                </span>
                <span className="text-[10px] text-slate-400">days ≥80%</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {highProductivityPeriods.length} peak streak{highProductivityPeriods.length === 1 ? '' : 's'} recorded
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                {Math.round(highProductivityShare)}% of analyzed days
              </p>
            </div>

            <AnimatedProgressRing
              value={highProductivityShare}
              size={56}
              strokeWidth={5}
              progressClassName="text-blue-500"
              label={`${highProductivityDaysCount}D`}
              sublabel="high"
              delay={0.08}
            />
          </div>
        </motion.div>

        {/* Card 2: Average Productivity */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.32, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.995 }}
          className={`ui-motion-card p-2 rounded-xl border min-h-[118px] relative overflow-hidden group flex flex-col justify-between ${
            isDark
              ? 'bg-slate-900/40 border-slate-800 hover:border-amber-700/60'
              : 'bg-slate-50 border-slate-200 hover:border-amber-300 hover:shadow-md'
          }`}
        >
          <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-amber-500/8 group-hover:scale-125 transition-transform duration-500" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500 via-yellow-400 to-blue-500 opacity-70" />

          <div className="relative flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
              Steady Productivity
            </span>
            <motion.div
              initial={{ scale: 0.72, rotate: -12, opacity: 0 }}
              whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }}
              className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400/30 flex items-center justify-center"
            >
              <Gauge className="w-3.5 h-3.5 text-amber-500" />
            </motion.div>
          </div>

          <div className="relative mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold font-mono text-amber-500">
                  {steadyProductivityDaysCount}
                </span>
                <span className="text-[10px] text-slate-400">days 50–79%</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Days in the steady productivity range
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                {Math.round(steadyProductivityShare)}% of analyzed days
              </p>
            </div>

            <AnimatedProgressRing
              value={steadyProductivityShare}
              size={56}
              strokeWidth={5}
              progressClassName="text-amber-500"
              label={`${steadyProductivityDaysCount}D`}
              sublabel="steady"
              delay={0.13}
            />
          </div>
        </motion.div>

        {/* Card 3: Low Productivity Dips */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.32, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.995 }}
          className={`ui-motion-card p-2 rounded-xl border min-h-[118px] relative overflow-hidden group flex flex-col justify-between ${
            isDark
              ? 'bg-slate-900/40 border-slate-800 hover:border-rose-700/60'
              : 'bg-slate-50 border-slate-200 hover:border-rose-300 hover:shadow-md'
          }`}
        >
          <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-rose-500/8 group-hover:scale-125 transition-transform duration-500" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-rose-500 via-red-400 to-amber-400 opacity-70" />

          <div className="relative flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
              Low Productivity Dips
            </span>
            <motion.div
              initial={{ scale: 0.72, rotate: -12, opacity: 0 }}
              whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.1 }}
              className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 ring-2 ring-rose-400/30 flex items-center justify-center"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            </motion.div>
          </div>

          <div className="relative mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-extrabold font-mono ${
                  lowProductivityDaysCount > 0 ? 'text-rose-500' : 'text-slate-400'
                }`}>
                  {lowProductivityDaysCount}
                </span>
                <span className="text-[10px] text-slate-400">days &lt;50%</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {lowProductivityPeriods.length > 0
                  ? `${lowProductivityPeriods.length} recovery window${lowProductivityPeriods.length === 1 ? '' : 's'}`
                  : 'Zero prolonged dips detected'}
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                {Math.round(lowProductivityShare)}% of analyzed days
              </p>
            </div>

            <AnimatedProgressRing
              value={lowProductivityShare}
              size={56}
              strokeWidth={5}
              progressClassName="text-rose-500"
              label={`${lowProductivityDaysCount}D`}
              sublabel="low"
              delay={0.18}
            />
          </div>
        </motion.div>
      </div>

      {/* 3. Interactive SVG Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.992 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.42, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2 }}
        className={`ui-motion-card p-2 rounded-xl border relative overflow-hidden ${

        isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50/80 border-slate-200'
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
            <div className="hidden sm:flex items-center space-x-1 pl-1 border-l border-slate-200 dark:border-slate-800">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[9px] font-bold">✓</span>
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Done
              </span>
            </div>
            <div className="hidden sm:flex items-center space-x-1">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold">✕</span>
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Missed
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
            <span className="text-[11px] text-slate-400 italic hidden sm:inline">
              Hover or tap points for details
            </span>
          </div>
        </div>

        {/* SVG Container */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[700px]">
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
                const isSelected = selectedPoint?.day === pt.day;
                const isHigh = pt.productivityLevel === 'HIGH';
                const isLow = pt.productivityLevel === 'LOW';

                return (
                  <g key={`pt-${pt.day}`}>
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
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: Math.min(0.45, pt.day * 0.015) }}
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

                    {/* Data Label displaying moving average rate and completed/not completed icon */}
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

                    {/* Day X-axis label */}
                    <text
                      x={pt.x}
                      y={padTop + chartHeight + 18}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily="monospace"
                      fill={isDark ? '#94a3b8' : '#64748b'}
                    >
                      D{pt.day}
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
                  Day {selectedPoint.day}
                </span>
                <span className="font-semibold">
                  {standardizeDate(selectedPoint.date)}
                </span>
                <span>•</span>
                <span>
                  {windowSize}-Day Window: <strong>{selectedPoint.completedInWindow} / {selectedPoint.totalInWindow} met</strong> ({selectedPoint.movingAverageRate}%)
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
    </motion.div>
  );
};
