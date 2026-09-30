import { FullStudyBook } from './calNewportFullStudy';
import { RYAN_HOLIDAY_BOOKS } from './ryanHolidayLibrary';

export const RYAN_HOLIDAY_FULL_STUDY: Record<string, FullStudyBook> = Object.fromEntries(
  RYAN_HOLIDAY_BOOKS.map(book => [book.id, {
    readingMinutes: '120–150 min study edition',
    introduction: [
      'This extended System Builder edition is an original study companion, not a reproduction or substitute for the copyrighted book.',
      'Read actively. After each section, explain the principle in your own words, connect it to a current problem, and choose a behavior to test.',
      'The goal is transfer: finish with decisions, experiments, and evidence that the idea changed how you respond in real situations.'
    ],
    sections: book.themes.map(theme => ({
      title: theme.title,
      reading: [
        ...theme.explanation,
        'Study the principle at three levels: perception, choice, and repeated behavior. First notice how you normally interpret the situation. Then identify the response that is actually under your control. Finally design a small repeatable practice so the idea survives beyond the reading session.',
        'Test the limits of the idea as well as its usefulness. Stoic practice is not emotional suppression, passive acceptance of preventable harm, or endless endurance of a bad strategy. Good judgment distinguishes what should be accepted from what should be changed.',
        'Use retrieval practice before moving on: close the guide and reconstruct the argument from memory. Then write one example from your own life and one situation where applying the principle too rigidly would be a mistake.',
        'Translate reflection into evidence. Define what observable behavior would show improvement over the next seven days, and review that evidence rather than relying only on how motivated you feel.'
      ],
      applications: [
        ...theme.examples.map(example => example.title + ': ' + example.body),
        'Personal transfer: apply this principle to one current responsibility, obstacle, relationship, or decision.',
        'Failure-mode check: describe one way the principle could be misunderstood or over-applied, then create a safeguard.'
      ],
      exercises: [
        ...theme.actionPlan,
        'Write a one-sentence version of the principle from memory.',
        'Define one observable behavior to practice for seven days.',
        'At the end of the week, record what changed, what did not, and what you will adjust.'
      ],
      review: [
        'What part of this principle is under your direct control?',
        'What emotion or assumption could distort your judgment here?',
        'What would responsible action look like today?',
        'How could this principle be misapplied?',
        'What evidence after seven days would show that the practice helped?'
      ]
    })),
    finalReview: [
      'Without looking back, write the five most useful ideas you remember.',
      'Connect each idea to one real situation from the last month.',
      'Choose one principle for daily practice and one for weekly review.',
      'Create a stop-doing rule for one behavior that conflicts with the principles.',
      'After 30 days, review evidence from your actions rather than your intentions.',
      'Return only to the sections connected to problems you are actually encountering.'
    ]
  }])
);
