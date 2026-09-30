import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const todayTasks = read('src/components/TodayTasksCard.tsx');
const calendar = read('src/components/CalendarWorkspace.tsx');
const more = read('src/components/MoreWorkspace.tsx');
const app = read('src/App.tsx');
const dayProgress = read('src/components/DayProgressMoment.tsx');
const books = read('src/components/CalNewportLibrary.tsx');
const pomodoro = read('src/components/PomodoroTimer.tsx');
const report = read('src/components/ReportView.tsx');
const badge = read('src/components/BadgeCelebration.tsx');

// Mobile modal safety: interactive dialogs must render above the fixed bottom nav (z-[140])
// and remain reachable on short/narrow phone viewports.
assert.ok(todayTasks.includes('fixed inset-0 z-[220]'), 'Task dialogs must render above mobile navigation.');
assert.ok(
  todayTasks.includes('max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain'),
  'Enter/Edit task dialogs must be viewport-safe and scrollable.'
);
assert.equal(
  (todayTasks.match(/fixed inset-0 z-50/g) || []).length,
  0,
  'Task dialogs must not use the legacy z-50 layer.'
);

assert.ok(
  calendar.includes('fixed inset-0 z-[220]'),
  'Calendar dialogs must render above mobile navigation.'
);
assert.ok(
  calendar.includes('max-h-[calc(100dvh-1rem)]'),
  'Calendar quick-add must remain usable on short phones.'
);
assert.ok(
  calendar.includes('Add one or multiple tasks for {longDate(selectedDate)}'),
  'Calendar quick-add must render the selected date, not a literal template expression.'
);
assert.ok(
  !calendar.includes('Add one or multiple tasks for ${longDate(selectedDate)}'),
  'Calendar quick-add must not leak a template placeholder into the UI.'
);

assert.ok(
  calendar.includes('const CalendarFocusTopBar'),
  'Calendar focus mode must keep a compact navigation header.'
);
assert.ok(
  calendar.includes('<CalendarFocusTopBar'),
  'Calendar focus mode must render its focus navigation header.'
);
assert.ok(
  calendar.includes('periodLabel={periodLabel}'),
  'Calendar focus header must show the current month/year period label.'
);
assert.ok(
  calendar.includes('<CalendarViewSegmentedControl'),
  'Calendar focus header must retain Month/Year switching.'
);
assert.ok(
  calendar.includes('>\n          Today\n        </button>'),
  'Calendar focus header must retain the Today action.'
);

// Tools navigation/focus must remain functional when the mobile bottom nav is visible.
assert.ok(
  more.includes('useEffect(() => {\n    setActiveTab(initialTab);\n  }, [initialTab]);'),
  'Tools workspace must react when the requested initial tab changes.'
);
assert.ok(
  more.includes('onClick={() => setFocusMode(true)}'),
  'Desktop Tools focus control must work on every supported tools tab.'
);
assert.ok(
  app.includes('focusActive={toolsFocusMode}'),
  'Mobile Tools focus state must be reflected in the bottom navigation.'
);
assert.ok(
  app.includes('onFocus={() => setToolsFocusMode(v => !v)}'),
  'Mobile Tools focus button must have a working action.'
);
assert.ok(
  app.includes("setIsDayReviewOpen(params.get('review') === '1');"),
  'Browser back/forward must keep review modal state in sync with the URL.'
);

// Completed and Not Completed result footers should retain the same compact two-column layout.
assert.ok(
  dayProgress.includes('className="mt-4 grid grid-cols-2 gap-2 max-[360px]:gap-1.5"'),
  'Both day-result states must use the same two-column footer at mobile widths.'
);
assert.ok(
  !dayProgress.includes("isCompleted ? 'grid-cols-1' : 'grid-cols-2'"),
  'Completed result must not fall back to a one-column footer.'
);

// Other full-screen overlays must stay above the fixed mobile navigation.
assert.ok(books.includes('fixed inset-y-0 right-0 z-[220]'), 'Reader highlights drawer must sit above mobile navigation.');
assert.ok(pomodoro.includes('fixed inset-0 z-[220]'), 'Pomodoro modal must sit above mobile navigation.');
assert.ok(report.includes('fixed inset-0 z-[220]'), 'Countdown editor must sit above mobile navigation.');
assert.ok(badge.includes('fixed inset-0 z-[230]'), 'Badge celebration must sit above other app chrome.');

console.log('UI contract checks passed.');
