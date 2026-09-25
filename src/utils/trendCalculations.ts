import { DailyRecord } from '../types';

export interface MovingAveragePoint {
  day: number;
  date: string;
  isCompleted: boolean;
  windowSize: number;
  completedInWindow: number;
  totalInWindow: number;
  movingAverageRate: number; // 0 to 100
  productivityLevel: 'HIGH' | 'STEADY' | 'LOW';
  notes?: string;
}

export interface ProductivityPeriod {
  id: string;
  type: 'HIGH' | 'LOW';
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
  avgRate: number;
  daysCount: number;
  completedDays: number;
}

export interface TrendAnalysisResult {
  points: MovingAveragePoint[];
  windowSize: number;
  currentMovingAverage: number;
  previousMovingAverage: number;
  momentumDelta: number; // current - previous
  overallAverage: number;
  highProductivityPeriods: ProductivityPeriod[];
  lowProductivityPeriods: ProductivityPeriod[];
  peakPeriod: ProductivityPeriod | null;
  lowestPeriod: ProductivityPeriod | null;
  trendDirection: 'RISING' | 'FALLING' | 'STEADY';
  highProductivityDaysCount: number;
  lowProductivityDaysCount: number;
}

/**
 * Calculates moving average of commitments met and identifies high/low productivity periods.
 * @param records List of daily commitment records
 * @param windowSize Rolling window span in days (e.g. 3, 5, 7)
 */
export function calculateMovingAverageTrends(
  records: DailyRecord[],
  windowSize: number = 7
): TrendAnalysisResult {
  if (!records || records.length === 0) {
    return {
      points: [],
      windowSize,
      currentMovingAverage: 0,
      previousMovingAverage: 0,
      momentumDelta: 0,
      overallAverage: 0,
      highProductivityPeriods: [],
      lowProductivityPeriods: [],
      peakPeriod: null,
      lowestPeriod: null,
      trendDirection: 'STEADY',
      highProductivityDaysCount: 0,
      lowProductivityDaysCount: 0,
    };
  }

  // Sort chronological by day ascending
  const sorted = [...records].sort((a, b) => a.day - b.day);

  const points: MovingAveragePoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    // Window looks back up to `windowSize` records
    const windowStart = Math.max(0, i - windowSize + 1);
    const windowSlice = sorted.slice(windowStart, i + 1);

    const completedInWindow = windowSlice.filter((r) => r.isCompleted).length;
    const totalInWindow = windowSlice.length;
    const movingAverageRate = totalInWindow > 0
      ? Math.round((completedInWindow / totalInWindow) * 100)
      : 0;

    let productivityLevel: 'HIGH' | 'STEADY' | 'LOW' = 'STEADY';
    if (movingAverageRate >= 80) {
      productivityLevel = 'HIGH';
    } else if (movingAverageRate < 50) {
      productivityLevel = 'LOW';
    }

    points.push({
      day: current.day,
      date: current.date,
      isCompleted: current.isCompleted,
      windowSize,
      completedInWindow,
      totalInWindow,
      movingAverageRate,
      productivityLevel,
      notes: current.notes,
    });
  }

  // Overall average
  const totalCompleted = sorted.filter((r) => r.isCompleted).length;
  const overallAverage = sorted.length > 0 ? Math.round((totalCompleted / sorted.length) * 100) : 0;

  // Current & Previous Moving Average for Momentum Delta
  const latestPoint = points[points.length - 1];
  const currentMovingAverage = latestPoint ? latestPoint.movingAverageRate : 0;
  const prevPoint = points.length > 1 ? points[points.length - 2] : null;
  const previousMovingAverage = prevPoint ? prevPoint.movingAverageRate : currentMovingAverage;
  const momentumDelta = currentMovingAverage - previousMovingAverage;

  let trendDirection: 'RISING' | 'FALLING' | 'STEADY' = 'STEADY';
  if (momentumDelta > 2) trendDirection = 'RISING';
  else if (momentumDelta < -2) trendDirection = 'FALLING';

  // Group continuous high and low productivity periods
  const highProductivityPeriods: ProductivityPeriod[] = [];
  const lowProductivityPeriods: ProductivityPeriod[] = [];

  let currentHighStart: MovingAveragePoint | null = null;
  let currentHighPoints: MovingAveragePoint[] = [];

  let currentLowStart: MovingAveragePoint | null = null;
  let currentLowPoints: MovingAveragePoint[] = [];

  points.forEach((pt, idx) => {
    // High productivity tracking
    if (pt.productivityLevel === 'HIGH') {
      if (!currentHighStart) {
        currentHighStart = pt;
      }
      currentHighPoints.push(pt);
    } else {
      if (currentHighStart && currentHighPoints.length > 0) {
        const lastHigh = currentHighPoints[currentHighPoints.length - 1];
        const sumRate = currentHighPoints.reduce((acc, p) => acc + p.movingAverageRate, 0);
        const compCount = currentHighPoints.filter((p) => p.isCompleted).length;
        highProductivityPeriods.push({
          id: `high-${currentHighStart.day}-${lastHigh.day}`,
          type: 'HIGH',
          startDay: currentHighStart.day,
          endDay: lastHigh.day,
          startDate: currentHighStart.date,
          endDate: lastHigh.date,
          avgRate: Math.round(sumRate / currentHighPoints.length),
          daysCount: currentHighPoints.length,
          completedDays: compCount,
        });
        currentHighStart = null;
        currentHighPoints = [];
      }
    }

    // Low productivity tracking
    if (pt.productivityLevel === 'LOW') {
      if (!currentLowStart) {
        currentLowStart = pt;
      }
      currentLowPoints.push(pt);
    } else {
      if (currentLowStart && currentLowPoints.length > 0) {
        const lastLow = currentLowPoints[currentLowPoints.length - 1];
        const sumRate = currentLowPoints.reduce((acc, p) => acc + p.movingAverageRate, 0);
        const compCount = currentLowPoints.filter((p) => p.isCompleted).length;
        lowProductivityPeriods.push({
          id: `low-${currentLowStart.day}-${lastLow.day}`,
          type: 'LOW',
          startDay: currentLowStart.day,
          endDay: lastLow.day,
          startDate: currentLowStart.date,
          endDate: lastLow.date,
          avgRate: Math.round(sumRate / currentLowPoints.length),
          daysCount: currentLowPoints.length,
          completedDays: compCount,
        });
        currentLowStart = null;
        currentLowPoints = [];
      }
    }

    // Handle end of array
    if (idx === points.length - 1) {
      if (currentHighStart && currentHighPoints.length > 0) {
        const lastHigh = currentHighPoints[currentHighPoints.length - 1];
        const sumRate = currentHighPoints.reduce((acc, p) => acc + p.movingAverageRate, 0);
        const compCount = currentHighPoints.filter((p) => p.isCompleted).length;
        highProductivityPeriods.push({
          id: `high-${currentHighStart.day}-${lastHigh.day}`,
          type: 'HIGH',
          startDay: currentHighStart.day,
          endDay: lastHigh.day,
          startDate: currentHighStart.date,
          endDate: lastHigh.date,
          avgRate: Math.round(sumRate / currentHighPoints.length),
          daysCount: currentHighPoints.length,
          completedDays: compCount,
        });
      }

      if (currentLowStart && currentLowPoints.length > 0) {
        const lastLow = currentLowPoints[currentLowPoints.length - 1];
        const sumRate = currentLowPoints.reduce((acc, p) => acc + p.movingAverageRate, 0);
        const compCount = currentLowPoints.filter((p) => p.isCompleted).length;
        lowProductivityPeriods.push({
          id: `low-${currentLowStart.day}-${lastLow.day}`,
          type: 'LOW',
          startDay: currentLowStart.day,
          endDay: lastLow.day,
          startDate: currentLowStart.date,
          endDate: lastLow.date,
          avgRate: Math.round(sumRate / currentLowPoints.length),
          daysCount: currentLowPoints.length,
          completedDays: compCount,
        });
      }
    }
  });

  // Identify Peak Period (highest avg rate, longest span)
  let peakPeriod: ProductivityPeriod | null = null;
  if (highProductivityPeriods.length > 0) {
    peakPeriod = [...highProductivityPeriods].sort((a, b) => {
      if (b.avgRate !== a.avgRate) return b.avgRate - a.avgRate;
      return b.daysCount - a.daysCount;
    })[0];
  }

  // Identify Lowest Period (lowest avg rate)
  let lowestPeriod: ProductivityPeriod | null = null;
  if (lowProductivityPeriods.length > 0) {
    lowestPeriod = [...lowProductivityPeriods].sort((a, b) => {
      if (a.avgRate !== b.avgRate) return a.avgRate - b.avgRate;
      return b.daysCount - a.daysCount;
    })[0];
  }

  const highProductivityDaysCount = points.filter((p) => p.productivityLevel === 'HIGH').length;
  const lowProductivityDaysCount = points.filter((p) => p.productivityLevel === 'LOW').length;

  return {
    points,
    windowSize,
    currentMovingAverage,
    previousMovingAverage,
    momentumDelta,
    overallAverage,
    highProductivityPeriods,
    lowProductivityPeriods,
    peakPeriod,
    lowestPeriod,
    trendDirection,
    highProductivityDaysCount,
    lowProductivityDaysCount,
  };
}
