import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const todayTasks = read('src/components/TodayTasksCard.tsx');
const pomodoroTimer = read('src/components/PomodoroTimer.tsx');
const calendar = read('src/components/CalendarWorkspace.tsx');
const more = read('src/components/MoreWorkspace.tsx');
const app = read('src/App.tsx');
const dayProgress = read('src/components/DayProgressMoment.tsx');
const books = read('src/components/CalNewportLibrary.tsx');
const pomodoro = read('src/components/PomodoroTimer.tsx');
const report = read('src/components/ReportView.tsx');
const lifecycle = read('src/hooks/useSystemDataLifecycle.ts');
const dayReview = read('src/components/DayReviewModal.tsx');
const migration = read('src/services/dataModelMigration.ts');
const firebaseService = read('src/services/firebaseService.ts');
const dataWorkspace = read('src/components/DataWorkspace.tsx');
const dataTransfer = read('src/utils/dataTransfer.ts');
const badge = read('src/components/BadgeCelebration.tsx');
const performanceIntelligence = read('src/components/PerformanceIntelligence.tsx');
const mobileBottomNav = read('src/components/MobileBottomNav.tsx');
const dataAnalytics = read('src/components/DataAnalyticsPage.tsx');
const powerBiHeader = read('src/components/PowerBiHeader.tsx');
const server = read('server.ts');

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

const enterTasksStart = todayTasks.indexOf('5. "ENTER TASKS" PANEL');
const enterTasksEnd = todayTasks.indexOf('6. EDIT TASK MODAL', enterTasksStart);
const enterTasksPanel =
  enterTasksStart >= 0 && enterTasksEnd > enterTasksStart
    ? todayTasks.slice(enterTasksStart, enterTasksEnd)
    : '';

assert.ok(enterTasksPanel, 'Enter Tasks panel source must be present.');
assert.ok(
  enterTasksPanel.includes('system-stable-modal') &&
    enterTasksPanel.includes('items-start') &&
    enterTasksPanel.includes('sm:items-center'),
  'Enter Tasks must stay top-anchored on mobile while remaining centered on desktop.'
);
assert.ok(
  enterTasksPanel.includes('max-h-[calc(100svh-1.5rem)]') &&
    enterTasksPanel.includes('touch-pan-y') &&
    enterTasksPanel.includes('overscroll-y-contain'),
  'Enter Tasks must use a stable mobile viewport and internal touch scrolling.'
);
assert.ok(
  !enterTasksPanel.includes('transition-all'),
  'Enter Tasks must not animate layout/size changes while the mobile viewport changes.'
);
assert.ok(
  !enterTasksPanel.includes('>\n                    Cancel\n'),
  'Enter Tasks mobile header must not contain a Cancel button.'
);
assert.ok(
  todayTasks.includes("window.matchMedia('(min-width: 640px) and (pointer: fine)').matches"),
  'Enter Tasks auto-focus must be limited to desktop/fine-pointer devices.'
);
assert.ok(
  todayTasks.includes('taskInputRef.current?.focus({ preventScroll: true });'),
  'Desktop Enter Tasks auto-focus must not scroll the page.'
);
assert.ok(
  todayTasks.includes("}, [activeDateTab]);"),
  'Global Enter Tasks quick-add must track the active Today/Tomorrow tab.'
);
assert.ok(
  enterTasksPanel.includes("if (e.key === 'Escape' && !isAddingTask) handleCloseEnterPanel();") &&
    enterTasksPanel.includes('disabled={isAddingTask}'),
  'Enter Tasks close controls must not dismiss the dialog during an active save.'
);

assert.ok(
  todayTasks.includes('id="btn-add-task-card-header"') &&
    todayTasks.includes('inline-flex h-10 w-10 shrink-0 items-center justify-center') &&
    todayTasks.includes('id="btn-review-task-day"'),
  'Today card Add and Review controls must keep mobile-sized touch targets.'
);
assert.ok(
  todayTasks.includes('role="checkbox"') &&
    todayTasks.includes('h-10 w-10 shrink-0 items-center justify-center') &&
    todayTasks.includes('relative block size-5 shrink-0 rounded-[5px]'),
  'Today task checkbox must keep a large mobile tap target with a visible 20px square.'
);
assert.ok(
  todayTasks.includes("aria-label={") &&
    todayTasks.includes("'Mark incomplete'") &&
    todayTasks.includes("'Mark completed'") &&
    todayTasks.includes('task.taskOfTheDay'),
  'Today task checkbox must expose an explicit accessible task label.'
);
assert.ok(
  todayTasks.includes('const incompleteTasks = useMemo(') &&
    todayTasks.includes('sortedTasks.filter((task) => !task.isCompleted)') &&
    todayTasks.includes('sortedTasks.filter((task) => task.isCompleted)'),
  'Today task list must preserve quadrant ordering while keeping incomplete tasks above completed tasks.'
);
assert.ok(
  todayTasks.includes('More actions for') &&
    todayTasks.includes('inline-flex h-10 w-10 shrink-0 items-center justify-center') &&
    todayTasks.includes('max-w-[calc(100vw-2rem)]'),
  'Today task action menu must keep a mobile touch target and remain within narrow viewports.'
);
assert.ok(
  todayTasks.includes('inline-flex min-h-10 items-center justify-center space-x-1') &&
    todayTasks.includes('Add your first task'),
  'Today empty-state Add action must remain touch-friendly.'
);
assert.ok(
  todayTasks.includes('hidden sm:inline">Strongest:') &&
    todayTasks.includes('hidden sm:inline">Needs attention:'),
  'Weekly review must stay compact on mobile while retaining detailed desktop insights.'
);
assert.ok(
  todayTasks.includes('aria-label="Edit task"') &&
    todayTasks.includes('max-h-[calc(100svh-1.5rem)]') &&
    todayTasks.includes('touch-pan-y'),
  'Edit Task must remain stable when the mobile keyboard changes the visual viewport.'
);
assert.ok(
  todayTasks.includes('grid grid-cols-2 gap-2 pt-1.5 border-t') &&
    todayTasks.includes('sm:flex sm:items-center sm:justify-end'),
  'Edit and Delete task actions must remain side by side on mobile.'
);
assert.ok(
  enterTasksPanel.includes('grid grid-cols-2 gap-2 pt-1.5') &&
    enterTasksPanel.includes('sm:flex sm:items-center sm:justify-end'),
  'Enter Tasks mobile footer must place Add and Done side by side while preserving the desktop footer layout.'
);
assert.ok(
  enterTasksPanel.includes('sm:hidden') &&
    enterTasksPanel.includes('<span>Add</span>') &&
    enterTasksPanel.includes('>\n                    Done\n'),
  'Enter Tasks must expose a mobile-only Add action beside Done.'
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

assert.ok(
  !dayProgress.includes('Your next move'),
  'Day result popups must not render the next-move card on any screen size.'
);
assert.ok(
  !dayProgress.includes('sm:max-w-xl') &&
    !dayProgress.includes('sm:grid-cols-4') &&
    !dayProgress.includes('sm:p-6') &&
    !dayProgress.includes('md:block'),
  'Completed and Not Completed result content must keep the same compact mobile layout on desktop.'
);
const dayReviewModal = read('src/components/DayReviewModal.tsx');
assert.ok(
  dayReviewModal.includes("? 'max-w-md rounded-2xl max-h-[calc(100dvh-1.5rem)]'") &&
    !dayReviewModal.includes('sm:max-w-xl') &&
    !dayReviewModal.includes('lg:max-w-2xl'),
  'Day result modal width and height must remain identical across mobile and desktop.'
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
  !books.includes('>Spacing</button>') &&
    !books.includes('Width: {readerWidth}') &&
    !books.includes('setReaderWidth') &&
    !books.includes('setLineHeight'),
  'Books reader must not expose or retain spacing/width controls.'
);
assert.ok(
  books.includes("const widthClass = 'max-w-[1080px]';") &&
    books.includes('lineHeight:1.9'),
  'Books reader must keep a fixed wide layout with normal reading spacing.'
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

assert.ok(report.includes('fixed inset-0 z-[220]'), 'Countdown editor must sit above mobile navigation.');
assert.ok(badge.includes('fixed inset-0 z-[230]'), 'Badge celebration must sit above other app chrome.');

const calendarMonth = read('src/components/calendar/CalendarMonthView.tsx');
const calendarDay = read('src/components/calendar/CalendarDayCell.tsx');
const styles = read('src/index.css');

assert.ok(
  calendar.includes('pb-20 md:pb-4'),
  'Mobile Calendar scrolling must clear the fixed bottom navigation.'
);
assert.ok(
  calendarMonth.includes('min-h-[360px] sm:min-h-[560px]'),
  'Month calendar must compact on short phones without changing tablet/desktop sizing.'
);
assert.ok(
  calendarDay.includes('min-h-[54px] sm:min-h-[108px]'),
  'Mobile calendar week rows must remain compact at narrow/short phone sizes.'
);
assert.ok(
  habitTracker.includes('hidden sm:grid grid-cols-12') &&
    habitTracker.includes('max-w-full overflow-x-auto overscroll-x-contain'),
  'Habit heatmap must not force page-level horizontal overflow on 320px phones.'
);
assert.ok(
  !styles.includes('.system-edition main { max-width:none !important; }'),
  'Large desktop dashboard must preserve its explicit max-width instead of stretching edge-to-edge.'
);
assert.ok(
  styles.includes('.system-edition .system-stable-modal') &&
    styles.includes('animation:none !important;') &&
    styles.includes('transform:none !important;'),
  'Stable mobile modals must not inherit global overlay transform animations.'
);
assert.ok(
  styles.includes('.task-menu-item { min-height:44px; padding:.7rem .75rem; }'),
  'Mobile task action menu items must retain comfortable touch targets.'
);


console.log('UI contract checks passed.');


// Focus timer contract: elapsed time is task-bound and completion is a single atomic task update.
assert.ok(pomodoro.includes('Date.now() - startedAtRef.current'), 'Focus timer must derive elapsed time from wall-clock deltas.');
assert.ok(pomodoro.includes('void commitElapsed(Math.floor(accumulatedMsRef.current / 1000))'), 'Pausing focus timer must persist elapsed seconds.');
assert.ok(pomodoro.includes('void commitElapsed(0)'), 'Resetting focus timer must persist zero elapsed time.');
assert.ok(pomodoro.includes('await onCompleteCurrentTask(finalSeconds)'), 'Completing Current Task must pass the final timer value.');
assert.ok(report.includes('ActualTime: formatActualTime(elapsedSeconds)'), 'Focus completion must write the timer value to canonical ActualTime.');
assert.ok(report.includes('isCompleted: true'), 'Focus completion must mark the same task completed in the atomic update.');
assert.ok(report.includes('.filter((task) => !task.isCompleted)'), 'Completed tasks must not remain selectable as focus tasks.');
assert.ok(report.includes("selected === completedTaskId ? '' : selected"), 'Completing a focus task must release its selection so the next incomplete task can become current.');

assert.ok(pomodoro.includes("if (!hasCurrentTask || isSaving) return;"), 'Focus timer must not start without a valid current task.');
assert.ok(pomodoro.includes("setTimerError('Unable to save focus time. Please try again.')"), 'Focus timer must surface elapsed-time persistence failures.');
assert.ok(pomodoro.includes("setTimerError('Unable to complete task. Your elapsed time is still available.')"), 'Failed completion must preserve the elapsed session and surface an error.');
assert.ok(pomodoro.includes('setIsTaskLocked(true);'), 'A failed focused-task completion must keep the task locked for a safe retry.');


// Data-sync and single-user app contracts.
assert.ok(lifecycle.includes("(a.ActualTime || '') === (b.ActualTime || '')"), 'Pending task sync must compare ActualTime before accepting cloud snapshots.');
assert.ok(lifecycle.includes("(a.EstimationTime || '') === (b.EstimationTime || '')"), 'Pending task sync must compare EstimationTime before accepting cloud snapshots.');
assert.equal(dayReview.includes('openedFromEmail'), false, 'Day review must not contain legacy email navigation behavior.');


// End-to-end data integrity contracts.
assert.equal(migration.includes("email:"), false, 'Single-user migration must not recreate removed email data.');
assert.ok(firebaseService.includes('Duplicate habit rejected'), 'Firestore habit creation must reject duplicate habit records.');
assert.ok(firebaseService.includes("transaction.get(habitRef)"), 'Habit creation must guard duplicate IDs transactionally.');
assert.ok(firebaseService.includes('Duplicate task rejected'), 'Task creation must retain duplicate task rejection.');


// Mobile overlay safety contracts.
assert.ok(dayReview.includes("document.body.style.overflow = 'hidden'"), 'Day Review must lock background scrolling while open.');
assert.ok(commandPalette.includes("document.body.style.overflow='hidden'"), 'Command Palette must lock background scrolling while open.');
assert.ok(commandPalette.includes("env(safe-area-inset-bottom)"), 'Command Palette must respect mobile safe areas.');
assert.ok(calendar.includes("env(safe-area-inset-bottom)"), 'Calendar dialogs must respect mobile safe areas.');
assert.ok(books.includes("env(safe-area-inset-bottom)"), 'Books note dialog must respect mobile safe areas.');
assert.ok(report.includes('onCompleteCurrentTask'), 'Focus completion contract must remain wired after modal changes.');


// Mobile task-delete interaction contracts (iPhone/Android viewport-safe behavior).
assert.ok(todayTasks.includes('createPortal(') && todayTasks.includes('document.body'), 'Task delete dialog must escape transformed card ancestors through a body portal.');
assert.ok(todayTasks.includes('max-h-[calc(100dvh-1.5rem)]'), 'Task delete dialog must fit short dynamic mobile viewports.');
assert.ok(todayTasks.includes('env(safe-area-inset-bottom)') && todayTasks.includes('env(safe-area-inset-top)'), 'Task delete dialog must respect iPhone/Android safe areas.');
assert.ok(todayTasks.includes("event.key === 'Escape' && !isDeleting"), 'Escape must close only when deletion is idle.');
assert.ok(todayTasks.includes('event.target === event.currentTarget && !isDeleting'), 'Backdrop tap must dismiss only when deletion is idle.');
assert.ok(todayTasks.includes('deleteInFlightRef.current'), 'Rapid repeated delete taps must be synchronously deduplicated.');
assert.ok(todayTasks.includes("setDeleteError(err?.message || 'Failed to delete task. Please try again.')"), 'Delete failures must remain visible and retryable.');
assert.ok(todayTasks.includes('min-h-12'), 'Mobile delete actions must provide 48px touch targets.');


// Mobile dropdown, action-menu, and popover contracts.
assert.ok(todayTasks.includes("data-task-action-menu"), 'Task action menu must expose an outside-tap boundary.');
assert.ok(todayTasks.includes("document.addEventListener('pointerdown', onPointerDown)"), 'Task action menu must dismiss on outside tap.');
assert.ok(todayTasks.includes("if (event.key === 'Escape') closeMenu()"), 'Task action menu must dismiss with Escape.');
assert.ok(todayTasks.includes('bottom-11') && todayTasks.includes('sm:bottom-auto'), 'Mobile task action menu must open upward to reduce viewport clipping.');
assert.ok(books.includes('data-highlight-palette'), 'Reader highlight popover must expose an outside-tap boundary.');
assert.ok(books.includes("if (event.key === 'Escape') dismiss()"), 'Reader highlight popover must dismiss with Escape.');
assert.ok(books.includes('h-11 w-11 rounded-full'), 'Reader highlight actions must use mobile-sized touch targets.');


// Focus timer 15-minute alternating alert contracts.
assert.ok(pomodoroTimer.includes('Math.floor(elapsedSeconds / 900)'), 'Focus timer alerts must evaluate 15-minute milestones.');
assert.ok(pomodoroTimer.includes('currentMilestone % 2 === 0 ? 3 : 1'), '15/45/75-minute milestones must beep once and 30/60/90-minute milestones three times.');
assert.ok(pomodoroTimer.includes('lastAlertMilestoneRef.current = currentMilestone'), 'Each elapsed milestone must alert only once.');
assert.ok(pomodoroTimer.includes("oscillator.type = 'square'") && pomodoroTimer.includes('1320'), 'Focus timer must use a high-alert beep tone.');


// Focus timer alert preview controls must exercise the production alert generator.
assert.ok(pomodoroTimer.includes('Test 1 Beep') && pomodoroTimer.includes('Test 3 Beeps'), 'Focus timer must expose alert preview controls.');
assert.ok(pomodoroTimer.includes('onClick={() => playHighAlertBeeps(1)}'), 'Alert preview must test the one-beep milestone sound.');
assert.ok(pomodoroTimer.includes('onClick={() => playHighAlertBeeps(3)}'), 'Alert preview must test the three-beep milestone sound.');


// Focus timer sound settings must not change the milestone cadence.
assert.ok(pomodoroTimer.includes("system-builder:timer-alert-volume"), 'Timer alert volume must persist locally.');
assert.ok(pomodoroTimer.includes("system-builder:timer-alert-muted"), 'Timer alert mute state must persist locally.');
assert.ok(pomodoroTimer.includes('alertsMuted || alertVolume <= 0'), 'Muted/zero-volume alerts must remain silent.');
assert.ok(pomodoroTimer.includes('0.42 * (alertVolume / 100)'), 'Alert gain must follow the configured volume.');
assert.ok(pomodoroTimer.includes('currentMilestone % 2 === 0 ? 3 : 1'), 'Volume settings must preserve the alternating one/three-beep cadence.');


// Running timer must expose the same persisted one-tap mute state.
assert.ok((pomodoroTimer.match(/setAlertsMuted\(\(muted\) => !muted\)/g) || []).length >= 1, 'Timer alert settings must expose a persisted one-tap mute control.');
assert.ok(pomodoroTimer.includes("currentMilestone % 2 === 0 ? 3 : 1"), 'Mute shortcut must not alter milestone beep cadence.');


// Timer alert settings must survive browser/PWA restarts and migrate legacy values.
assert.ok(pomodoroTimer.includes("system-builder:timer-alert-settings:v1"), 'Timer sound settings must use a versioned persistent record.');
assert.ok(pomodoroTimer.includes('readTimerAlertSettings'), 'Timer sound settings must hydrate from persistent storage on launch.');
assert.ok(pomodoroTimer.includes('writeTimerAlertSettings'), 'Timer sound settings must persist atomically.');
assert.ok(pomodoroTimer.includes('LEGACY_TIMER_VOLUME_KEY') && pomodoroTimer.includes('LEGACY_TIMER_MUTED_KEY'), 'Existing timer sound preferences must migrate from legacy keys.');
assert.ok(pomodoroTimer.includes("window.addEventListener('storage', syncSettings)"), 'Browser and installed-app windows must synchronize timer sound settings when sharing the same origin.');
assert.ok(pomodoroTimer.includes('currentMilestone % 2 === 0 ? 3 : 1'), 'Persistence changes must preserve the timer alert cadence.');


// Timer alert controls must remain hidden behind the three-dot settings menu.
assert.ok(pomodoroTimer.includes('MoreHorizontal'), 'Focus timer must expose a three-dot alert settings trigger.');
assert.ok(pomodoroTimer.includes('isAlertMenuOpen'), 'Timer alert settings must be hidden by default behind explicit menu state.');
assert.ok(pomodoroTimer.includes('aria-controls="timer-alert-settings"'), 'Three-dot trigger must be associated with the alert settings panel.');
assert.ok(pomodoroTimer.includes('{isAlertMenuOpen && ('), 'Alert volume, mute, and preview controls must render only after opening the menu.');
assert.ok(pomodoroTimer.includes('currentMilestone % 2 === 0 ? 3 : 1'), 'Hiding alert controls must not alter milestone cadence.');


assert.ok(
  dataTransfer.includes("'DayCompletion'"),
  'Days data table should expose DayCompletion'
);
const daysColumnsStart = dataTransfer.indexOf('days: [');
const daysColumnsEnd = dataTransfer.indexOf('],', daysColumnsStart);
const daysColumnsContract = dataTransfer.slice(daysColumnsStart, daysColumnsEnd);
assert.ok(
  daysColumnsContract.indexOf("'DayCompletion'") < daysColumnsContract.indexOf("'IsdayCompleted'"),
  'DayCompletion should appear before IsdayCompleted in Days'
);
assert.ok(
  firebaseService.includes('taskCompletionRate * 0.67 + habitCompletionRate * 0.33'),
  'DayCompletion should use 67% task completion and 33% habit completion'
);
assert.ok(
  firebaseService.includes('IsdayCompleted: DayCompletion >= 80'),
  'IsdayCompleted should be true when DayCompletion is at least 80%'
);


assert.ok(
  performanceIntelligence.includes("taskRate*.67+habitRate*.33"),
  'Performance trend should calculate DayCompletion as 67% tasks + 33% habits.'
);
assert.ok(
  performanceIntelligence.includes("useState<TrendMode>('dayCompletion')"),
  'Performance trend should preserve trendMode and default to DayCompletion.'
);
assert.ok(
  performanceIntelligence.includes("useState<Period>('1w')"),
  'Performance range should default to 1W.'
);
assert.ok(
  performanceIntelligence.includes("period==='1w'?7") &&
    performanceIntelligence.includes("period==='2w'?14") &&
    performanceIntelligence.includes("period==='1m'?30") &&
    performanceIntelligence.includes("period==='quarter'?90") &&
    performanceIntelligence.includes("period==='6m'?180") &&
    performanceIntelligence.includes("period==='1y'?365"),
  'Performance trend range buttons must drive the expected lookback windows.'
);
assert.ok(
  performanceIntelligence.includes("const bucket=period==='1y'||period==='all'?'month':'week'"),
  '1M/3M/6M should aggregate weekly while 1Y/All aggregate monthly.'
);
assert.ok(
  performanceIntelligence.includes("record.date,record") &&
    performanceIntelligence.includes("?.dayCompletion"),
  'Performance trend should prefer canonical Days.DayCompletion values.'
);
assert.ok(
  performanceIntelligence.includes("performanceTrendAverage") &&
    performanceIntelligence.includes("hasPerformanceTrendData"),
  'Dynamic performance trend should calculate an average and hide it when no values exist.'
);


assert.ok(
  powerBiHeader.includes('Data Analytics') &&
    powerBiHeader.includes('onOpenAnalytics') &&
    powerBiHeader.includes("window.location.pathname === '/analytics'"),
  'Desktop navigation must expose the Data Analytics page beside Tools.'
);
assert.ok(
  app.includes("window.location.pathname === '/analytics'") &&
    app.includes('<DataAnalyticsPage') &&
    app.includes('onOpenAnalytics={handleOpenAnalytics}'),
  'App routing must support the Data Analytics page.'
);
assert.ok(
  dataAnalytics.includes('DayCompletion') &&
    dataAnalytics.includes('Task vs Habit Drivers') &&
    dataAnalytics.includes('Habit Performance') &&
    dataAnalytics.includes('Consistency & Reliability'),
  'Data Analytics must expose the core performance, task, habit, and consistency views.'
);
assert.ok(
  dataAnalytics.includes('Ask AI Data Analyst') &&
    dataAnalytics.includes('/api/analytics/chat') &&
    dataAnalytics.includes('localAnswer'),
  'Data Analytics must include a usable AI analyst chat with local fallback.'
);
assert.ok(
  server.includes("app.post('/api/analytics/chat'") &&
    server.includes('GoogleGenAI') &&
    server.includes("getDocs(collection(db, 'days'))") &&
    server.includes("getDocs(collection(db, 'tasks'))") &&
    server.includes("getDocs(collection(db, 'habits'))") &&
    server.includes("getDocs(collection(db, 'habitLogs'))") &&
    server.includes("getDocs(collection(db, 'countdowns'))") &&
    server.includes("getDocs(collection(db, 'users'))"),
  'AI analyst must query all canonical live Firestore collections.'
);
assert.ok(
  server.includes("tools: [{ codeExecution: {} }]") &&
    server.includes('FULL LIVE DATASET:') &&
    server.includes('CHAT HISTORY:'),
  'AI analyst must support exact multi-row calculations and conversational follow-up questions.'
);
assert.ok(
  dataAnalytics.includes('history: messages.slice(-16)') &&
    dataAnalytics.includes('Ask anything about your data'),
  'Analytics chat must send conversation history and present open-ended data questioning.'
);
assert.ok(
  server.includes('const semanticLayer = {') &&
    server.includes('metricCatalog') &&
    server.includes('weeklyFacts') &&
    server.includes('monthlyFacts') &&
    server.includes('taskBreakdowns') &&
    server.includes('dataQuality'),
  'Advanced AI analytics must expose a semantic layer with derived metrics and quality metadata.'
);
assert.ok(
  server.includes('SYSTEM_BUILDER_ANALYTICS_DEEP_MODEL') &&
    server.includes('complexQuestion') &&
    server.includes("analysisLevel: complexQuestion ? 'deep' : 'standard'"),
  'Complex analytics questions must support an optional deep-analysis model path.'
);
assert.ok(
  server.includes('correlations, anomaly/outlier detection') &&
    server.includes('what-if simulation') &&
    server.includes('Silently self-check the final answer'),
  'AI analyst prompt must support advanced statistical, diagnostic, simulation, and verification workflows.'
);
assert.ok(
  dataAnalytics.includes("analysisLevel === 'deep' ? 'Deep' : 'Live'") &&
    dataAnalytics.includes('Find my biggest anomaly') &&
    dataAnalytics.includes('Compare last 30 vs previous 30 days'),
  'Analytics chat UI must surface advanced analysis mode and advanced prompts.'
);
assert.ok(
  dataAnalytics.includes('Ask anything about your System Builder data') &&
    dataAnalytics.includes('aria-controls="analytics-ai-chat"') &&
    dataAnalytics.includes('id="analytics-ai-chat"') &&
    dataAnalytics.indexOf('Ask anything about your System Builder data') <
      dataAnalytics.indexOf('<section className="grid grid-cols-2 gap-2.5'),
  'AI chat launcher must live professionally inside the top Data Analytics header before the KPI grid.'
);
assert.ok(
  !dataAnalytics.includes('bottom-[calc(5.75rem+env(safe-area-inset-bottom))]'),
  'Data Analytics must not use the old floating AI launcher.'
);
assert.ok(
  mobileBottomNav.includes('BarChart3') &&
    mobileBottomNav.includes('onAnalytics') &&
    mobileBottomNav.includes('aria-label="Open Data Analytics"') &&
    mobileBottomNav.includes("activeSection === 'analytics'") &&
    !mobileBottomNav.includes('<Plus'),
  'Mobile bottom navigation must use Data Analytics as the raised center action instead of Add Task.'
);
assert.ok(
  app.includes('activeSection="analytics"') &&
    (app.match(/onAnalytics=\{handleOpenAnalytics\}/g) || []).length >= 4,
  'Every mobile workspace must wire the center Analytics action and mark it active on the Analytics page.'
);
