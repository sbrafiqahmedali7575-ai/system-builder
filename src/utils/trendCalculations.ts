import { DailyRecord } from '../types';

export interface MovingAveragePoint {
  day: number;
  date: string;
  isCompleted: boolean;
  weekNumber: number;
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
  trackedDays: number;
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
 * Calculates fixed tracked-week productivity and identifies high/low periods.
 * With the default 7-day size: Week 1 = D1-D7, Week 2 = D8-D14, etc.
 * Incomplete current weeks still use the full 7-day denominator.
 * @param records List of daily commitment records
 * @param windowSize Fixed tracked-week span in days
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

  // Sort chronological by tracked day, then group into fixed week buckets.
  const sorted = [...records].sort((a, b) => a.day - b.day);
  const weeklyBuckets = new Map<number, DailyRecord[]>();

  sorted.forEach((record) => {
    const weekNumber = Math.max(1, Math.ceil(record.day / windowSize));
    const bucket = weeklyBuckets.get(weekNumber) ?? [];
    bucket.push(record);
    weeklyBuckets.set(weekNumber, bucket);
  });

  const points: MovingAveragePoint[] = [...weeklyBuckets.entries()]
    .sort(([weekA], [weekB]) => weekA - weekB)
    .map(([weekNumber, weekRecords]) => {
      const orderedWeekRecords = [...weekRecords].sort((a, b) => a.day - b.day);
      const startDay = (weekNumber - 1) * windowSize + 1;
      const endDay = weekNumber * windowSize;
      const firstRecord = orderedWeekRecords[0];
      const lastRecord = orderedWeekRecords[orderedWeekRecords.length - 1];
      const completedInWindow = orderedWeekRecords.filter((record) => record.isCompleted).length;
      const totalInWindow = windowSize;
      const movingAverageRate = Math.round((completedInWindow / totalInWindow) * 100);

      let productivityLevel: 'HIGH' | 'STEADY' | 'LOW' = 'STEADY';
      if (movingAverageRate >= 80) {
        productivityLevel = 'HIGH';
      } else if (movingAverageRate < 50) {
        productivityLevel = 'LOW';
      }

      return {
        day: endDay,
        date: lastRecord?.date ?? firstRecord?.date ?? '',
        isCompleted: completedInWindow === totalInWindow,
        weekNumber,
        startDay,
        endDay,
        startDate: firstRecord?.date ?? '',
        endDate: lastRecord?.date ?? '',
        trackedDays: orderedWeekRecords.length,
        windowSize,
        completedInWindow,
        totalInWindow,
        movingAverageRate,
        productivityLevel,
        notes: lastRecord?.notes,
      };
    });

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
        const compCount = currentHighPoints.reduce((acc, p) => acc + p.completedInWindow, 0);
        highProductivityPeriods.push({
          id: `high-${currentHighStart.day}-${lastHigh.day}`,
          type: 'HIGH',
          startDay: currentHighStart.startDay,
          endDay: lastHigh.endDay,
          startDate: currentHighStart.startDate,
          endDate: lastHigh.endDate,
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
        const compCount = currentLowPoints.reduce((acc, p) => acc + p.completedInWindow, 0);
        lowProductivityPeriods.push({
          id: `low-${currentLowStart.day}-${lastLow.day}`,
          type: 'LOW',
          startDay: currentLowStart.startDay,
          endDay: lastLow.endDay,
          startDate: currentLowStart.startDate,
          endDate: lastLow.endDate,
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
        const compCount = currentHighPoints.reduce((acc, p) => acc + p.completedInWindow, 0);
        highProductivityPeriods.push({
          id: `high-${currentHighStart.day}-${lastHigh.day}`,
          type: 'HIGH',
          startDay: currentHighStart.startDay,
          endDay: lastHigh.endDay,
          startDate: currentHighStart.startDate,
          endDate: lastHigh.endDate,
          avgRate: Math.round(sumRate / currentHighPoints.length),
          daysCount: currentHighPoints.length,
          completedDays: compCount,
        });
      }

      if (currentLowStart && currentLowPoints.length > 0) {
        const lastLow = currentLowPoints[currentLowPoints.length - 1];
        const sumRate = currentLowPoints.reduce((acc, p) => acc + p.movingAverageRate, 0);
        const compCount = currentLowPoints.reduce((acc, p) => acc + p.completedInWindow, 0);
        lowProductivityPeriods.push({
          id: `low-${currentLowStart.day}-${lastLow.day}`,
          type: 'LOW',
          startDay: currentLowStart.startDay,
          endDay: lastLow.endDay,
          startDate: currentLowStart.startDate,
          endDate: lastLow.endDate,
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
