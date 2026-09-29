import { CalNewportBook } from './calNewportLibrary';
import { CAL_NEWPORT_CHAPTER_GUIDES } from './calNewportChapterGuides';

export interface FullStudySection {
  title: string;
  reading: string[];
  applications: string[];
  exercises: string[];
  review: string[];
}
export interface FullStudyBook { readingMinutes: string; introduction: string[]; sections: FullStudySection[]; finalReview: string[]; }

const expansions: Record<CalNewportBook['id'], {lens:string; practice:string; questions:string[]}> = {
  'so-good': {lens:'career capital, craftsmanship, deliberate practice, control, and mission',practice:'Apply the principle to your current career by identifying a valuable capability, producing evidence of it, and seeking feedback from the market.',questions:['What evidence of value can you produce this week?','Where are you asking for a career reward before building enough leverage?','Which small bet could test a promising direction?']},
  'deep-work': {lens:'attention, concentration, deliberate depth, distraction management, and high-value output',practice:'Convert the idea into a protected deep-work block with a clear objective, rules for distraction, and a visible output.',questions:['What would make this principle observable in your calendar?','Which distraction has the highest opportunity cost?','What result would prove a deep session was successful?']},
  'slow-productivity': {lens:'work-in-progress limits, natural pacing, sustainable ambition, and quality',practice:'Reduce concurrent commitments, give the important work a realistic pace, and define the quality bar before adding more activity.',questions:['What can you stop or queue?','Where is your pace fighting reality?','What does excellent work look like here?']},
  'digital-minimalism': {lens:'values, attention, intentional technology use, solitude, leisure, and richer connection',practice:'Test each technology against an important value, then create an explicit operating rule for the tools you keep.',questions:['What value does this tool strongly support?','What cost in attention does it impose?','What higher-quality activity can replace habitual use?']},
  'time-block-planner': {lens:'time-block planning, prioritization, replanning, capture, shutdown, and estimation',practice:'Translate the principle into tomorrow’s calendar, then compare the plan with reality and use the difference to improve the next plan.',questions:['Where will this work live on the calendar?','What will move if reality changes?','What did your last plan teach you about estimation?']}
};

export const CAL_NEWPORT_FULL_STUDY: Record<CalNewportBook['id'], FullStudyBook> = Object.fromEntries(
  (Object.keys(CAL_NEWPORT_CHAPTER_GUIDES) as CalNewportBook['id'][]).map(bookId => {
    const lens=expansions[bookId], chapters=CAL_NEWPORT_CHAPTER_GUIDES[bookId];
    return [bookId,{
      readingMinutes:'60–90 min study edition',
      introduction:[
        `This extended System Builder edition is an original study companion organized around ${lens.lens}. It is designed for slow, active reading rather than as a substitute for the copyrighted book.`,
        'Read with a notebook or the built-in highlight and note tools. After each section, pause before continuing: explain the idea in your own words, connect it to a real situation, and choose one behavior you can test.',
        'The goal of this long edition is transfer. Instead of merely recognizing an idea, you should finish with decisions, experiments, and evidence that show whether you can apply it.'
      ],
      sections:chapters.map((chapter,index)=>({
        title:chapter.title,
        reading:[
          ...chapter.summary,
          `Study lens: read this section through the perspective of ${lens.lens}. Ask what behavior the principle changes, what trade-off it creates, and what evidence would show that it is working.`,
          `The key ideas here are: ${chapter.keyIdeas.join(' ')} Do not treat these as slogans. For each one, identify the condition in which it is useful, a condition in which it could be misapplied, and a concrete example from your own work or life.`,
          `Application matters more than agreement. ${lens.practice} Start small enough that you can observe the result, then revise the system from evidence rather than motivation.`,
          `A useful way to retain this section is retrieval: close the guide and reconstruct its main argument without looking. Then compare your explanation with the summary and identify what you missed. Repeat the same recall after a day and again after a week.`
        ],
        applications:[
          ...chapter.examples.map(e=>`${e.title}: ${e.body}`),
          `Personal transfer: choose one current responsibility and write how “${chapter.title}” would change the way you approach it this week.`,
          'Failure-mode check: describe one way you could apply this principle too rigidly or superficially, then add a safeguard.'
        ],
        exercises:[
          ...chapter.actionPlan,
          'Write a one-sentence version of the principle from memory.',
          'Define one observable behavior to practice for seven days.',
          'At the end of the week, record what changed, what did not, and what you will adjust.'
        ],
        review:[...chapter.reviewQuestions,...lens.questions]
      })),
      finalReview:[
        'Without looking back, write the five most useful ideas you remember.',
        'Rank the ideas by relevance to your next 30 days and explain your reasoning.',
        'Choose one principle to practice daily and one to review weekly.',
        'Create a concrete “stop doing” list; improvement requires subtraction as well as addition.',
        'After 30 days, review evidence: outputs completed, distractions reduced, quality improved, or commitments simplified.',
        'Re-read only the sections connected to problems you actually encountered. Use the guide as a working reference, not a completion badge.'
      ]
    }];
  })
) as Record<CalNewportBook['id'], FullStudyBook>;
