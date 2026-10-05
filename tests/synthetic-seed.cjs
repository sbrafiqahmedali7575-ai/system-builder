// Synthetic test data only. Never bundled with the desktop application.
const collections = { users: { U1: { userId: 'U1', name: 'Test user' } }, days: {}, tasks: {}, habits: {}, habitLogs: {}, countdowns: { C1: { countdownId: 'C1', name: 'Test countdown', targetDate: '2026-12-31' } } };
for (let i = 1; i <= 64; i++) {
  const dateKey = new Date(Date.UTC(2026, 7, i)).toISOString().slice(0, 10);
  collections.days[dateKey] = { dateKey, IsdayCompleted: false, taskTotal: 0, tasksDone: 0, habitTotal: 0, habitsDone: 0 };
  if (i <= 63) collections.tasks['T' + i] = { taskId: 'T' + i, title: 'Test task ' + i, scheduledDate: dateKey, Iscompleted: false, taskOrder: 0 };
}
for (let i = 1; i <= 6; i++) {
  const habitId = 'H' + i;
  collections.habits[habitId] = { habitId, name: i === 1 ? 'Wake Up Early 5 AM' : 'Test habit ' + i, repeatDays: [0,1,2,3,4,5,6], activeFrom: '2026-09-01', isActive: true, inactivePeriods: [], color: '#3b82f6' };
  for (let day = 1; day <= 4; day++) {
    const dateKey = '2026-09-0' + day, habitLogId = habitId + '_' + dateKey;
    collections.habitLogs[habitLogId] = { habitLogId, habitId, dateKey, Iscompleted: true };
  }
}
module.exports = { schema: 1, revision: 0, backupRevision: -1, lastBackup: null, collections, deleted: [] };

