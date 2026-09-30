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

assert.ok(
  app.includes('returnToDashboardForShortcut'),
  'Global shortcuts from Books/Tools must return to the dashboard before opening dashboard-only UI.'
);
assert.ok(
  app.includes("returnToDashboardForShortcut(() => setIsCommandPaletteOpen(true))"),
  'Ctrl/Cmd+K must not create a hidden command palette from Books/Tools.'
);
assert.ok(
  app.includes("returnToDashboardForShortcut(() => setIsTaskSearchOpen(true))"),
  'Task search shortcut must not create hidden state from Books/Tools.'
);
assert.ok(
  app.includes("returnToDashboardForShortcut(openEnterTasks)"),
  'New-task shortcut must return to Today before dispatching Enter Tasks.'
);

const commandPalette = read('src/components/CommandPalette.tsx');
assert.ok(
  commandPalette.includes('onCalendar:()=>void'),
  'Command Palette must expose a real Calendar navigation action.'
);
assert.ok(
  commandPalette.includes('onClick={act(onCalendar)}'),
  'Command Palette Calendar action must navigate instead of scrolling to a possibly unmounted element.'
);
assert.ok(
  app.includes("onCalendar={() => handleOpenTools('tasks')}"),
  'Open Calendar must navigate to Plan / Task Tracker.'
);

assert.ok(
  calendar.includes('const [error, setError] = useState<string | null>(null);'),
  'Calendar quick-add must keep a visible error state.'
);
assert.ok(
  calendar.includes('catch (submitError)'),
  'Calendar quick-add must catch save failures.'
);
assert.ok(
  calendar.includes('role="alert"'),
  'Calendar quick-add failures must be announced visibly and accessibly.'
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

assert.ok(
  books.includes('const [readerStateLoaded, setReaderStateLoaded] = useState(false);'),
  'Reader annotations must wait for stored state to load before persisting.'
);
assert.ok(
  books.includes("id.startsWith('research-') ? 'research' : id.startsWith('full-') ? 'full' : 'concise'"),
  'Reader annotation jumps must switch to the correct study mode.'
);
assert.ok(
  books.includes('data-reader-content="true"'),
  'Reader content must expose a selectable annotation surface.'
);
assert.ok(
  books.includes('onTouchEnd={() => window.setTimeout(captureSelection, 120)}'),
  'Reader highlight capture must support touch selection.'
);
assert.ok(
  books.includes('data-reader-section="true"'),
  'Reader sections must expose stable targets for bookmarks, notes, and highlights.'
);
assert.ok(
  books.includes('Reader Annotations'),
  'Reader must provide a persistent annotations drawer.'
);
assert.ok(
  books.includes('Save Note'),
  'Reader notes must use an in-app editor instead of browser prompts.'
);
assert.ok(
  !books.includes("window.prompt('Note for this section'"),
  'Legacy prompt-only section notes must remain removed.'
);
assert.ok(
  books.includes('Bookmarked') && books.includes('Edit Note'),
  'Bookmark and note controls must expose visible saved state.'
);

assert.ok(
  books.includes('const renderHighlightedText = (text: string, sectionId: string): React.ReactNode =>'),
  'Saved reader highlights must render back into matching reader text.'
);
assert.ok(
  books.includes('<mark') && books.includes("title={highlight.note || 'Saved highlight'}"),
  'Rendered reader highlights must remain visible and expose their saved note.'
);


const taskTracker = read('src/components/TaskTracker.tsx');
const habitTracker = read('src/components/HabitTracker.tsx');
const commandPaletteResponsive = read('src/components/CommandPalette.tsx');

assert.ok(
  taskTracker.includes('h-[calc(100dvh-9.5rem)] min-h-[320px]'),
  'Task Planner must fit 320px-wide short-phone layouts without forcing a 520px minimum height.'
);
assert.ok(
  taskTracker.includes('lg:h-[min(720px,calc(100dvh-7rem))]'),
  'Task Planner must cap its height cleanly on large desktops.'
);
assert.ok(
  calendar.includes('min-h-[300px] sm:min-h-[400px] md:min-h-0'),
  'Calendar must be allowed to shrink inside short phone and tablet Task Planner layouts.'
);
assert.ok(
  habitTracker.includes('min-w-[656px] sm:min-w-[720px] lg:min-w-[790px]'),
  'Habit weekly grid must use a narrower phone/tablet footprint while preserving desktop density.'
);
assert.ok(
  !habitTracker.includes('100vh-'),
  'Habit Tracker viewport caps must use dynamic viewport height rather than legacy 100vh.'
);
assert.ok(
  habitTracker.includes('100dvh-'),
  'Habit Tracker must respond to mobile browser chrome and short dynamic viewports.'
);
assert.ok(
  commandPaletteResponsive.includes('max-h-[calc(100dvh-1rem)] overflow-y-auto'),
  'Command Palette must remain scrollable on short phone heights.'
);
assert.ok(
  books.includes('max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain'),
  'Reader note editor must remain fully reachable on short phone heights.'
);
assert.ok(
  books.includes('max-h-[42dvh]'),
  'Reader note textarea must not consume the entire short viewport.'
);

assert.ok(pomodoro.includes('fixed inset-0 z-[220]'), 'Pomodoro modal must sit above mobile navigation.');
assert.ok(report.includes('fixed inset-0 z-[220]'), 'Countdown editor must sit above mobile navigation.');
assert.ok(badge.includes('fixed inset-0 z-[230]'), 'Badge celebration must sit above other app chrome.');

console.log('UI contract checks passed.');
