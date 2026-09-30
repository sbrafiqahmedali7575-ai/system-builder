export const NOT_COMPLETED_DAY_LINES = [
  // Principle 3 — Don’t waste the obstacle.
  'Use what went wrong today as material for a better tomorrow.',
  'The obstacle is useful when it teaches you what to change.',

  // Principle 4 — Focus on the next action.
  'Forget the whole mountain; take the next useful step.',
  'Progress restarts with one clear action.',

  // Principle 5 — Practice persistent action.
  'Keep moving, but change the method when the method is not working.',
  'Persistence means returning with a better approach.',

  // Principle 6 — Turn problems into opportunities.
  'Let today’s difficulty reveal the skill you need to strengthen.',
  'A setback can become training when you use it deliberately.',

  // Principle 7 — Use the process.
  'Trust the process: review, correct, and continue.',
  'Do the next part well; the larger result will follow.',
] as const;

export const COMPLETED_DAY_LINES = [
  // Principle 9 — Prepare for difficulty.
  'Preparation made today’s difficulty easier to carry.',
  'You were ready enough to act when the day became difficult.',

  // Principle 10 — Develop inner endurance.
  'You strengthened the part of you that keeps going.',
  'Endurance grows every time you finish despite resistance.',

  // Five essential lessons.
  'Control what you can control, and let your effort speak.',
  'Your perception shaped your response; your response shaped the day.',
  'Action beat overthinking today.',
  'You turned an obstacle into useful training.',
  'You persisted, learned, adjusted, and moved forward.',
] as const;

export const getDayProgressLine = (status: 'COMPLETED' | 'NOT_COMPLETED') => {
  const lines = status === 'COMPLETED' ? COMPLETED_DAY_LINES : NOT_COMPLETED_DAY_LINES;
  return lines[Math.floor(Math.random() * lines.length)];
};
