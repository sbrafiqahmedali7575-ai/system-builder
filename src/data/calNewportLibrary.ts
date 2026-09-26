export interface CalNewportExample {
  title: string;
  body: string;
}

export interface CalNewportTheme {
  title: string;
  shortIdea: string;
  explanation: string[];
  examples: CalNewportExample[];
  actionPlan: string[];
}

export interface CalNewportBook {
  id:
    | 'so-good'
    | 'deep-work'
    | 'slow-productivity'
    | 'digital-minimalism'
    | 'time-block-planner';
  title: string;
  shortTitle: string;
  year: number;
  focus: string;
  favorite: boolean;
  readingTime: string;
  overview: string[];
  whyItMatters: string;
  themes: CalNewportTheme[];
  summary: string[];
  conciseActionPlan: string[];
}

export const CAL_NEWPORT_BOOKS: CalNewportBook[] = [
  {
    id: 'so-good',
    title: "So Good They Can't Ignore You",
    shortTitle: 'So Good',
    year: 2012,
    focus: 'Career & valuable skills',
    favorite: true,
    readingTime: '18–22 min guide',
    overview: [
      "This book challenges the idea that a satisfying career begins by first discovering a perfect passion. Its central practical message is that strong careers are usually built by becoming unusually useful, accumulating scarce skills, and then using the value you create to earn better opportunities, autonomy, and meaningful work.",
      "For a data analyst, the most useful interpretation is to stop asking whether SQL, Power BI, Excel, Python, or analytics feels exciting every day. Instead, ask whether your ability in those skills is becoming rare, reliable, visible, and valuable. Career confidence follows evidence: difficult problems solved, clean dashboards delivered, stakeholders helped, and projects completed to a professional standard.",
      "The book is especially useful during a career restart because it shifts attention away from the gap itself and toward the quality of the capability you can demonstrate now. Your strongest leverage is not a perfect story about the past; it is a growing body of proof that you can do valuable analytical work today."
    ],
    whyItMatters:
      'Use this book as your career operating system: build career capital through deliberate practice, convert that capital into better roles and autonomy, and let meaningful work emerge from mastery rather than waiting for motivation.',
    themes: [
      {
        title: '1. Adopt the craftsman mindset',
        shortIdea: 'Measure your career by the value you can create, not by whether every task feels inspiring.',
        explanation: [
          "A passion-first mindset keeps attention on what a job gives you: excitement, identity, status, flexibility, or meaning. A craftsman mindset reverses the question and asks what you can offer. That shift is powerful because value creation is something you can train. You can improve query design, data modeling, requirements gathering, dashboard storytelling, documentation, and reliability even when confidence is low.",
          "The mindset does not mean ignoring your interests. It means refusing to make temporary feelings the main career decision system. Early in a skill-building phase, many valuable activities are frustrating because you are not yet fluent. If you judge them only by immediate enjoyment, you may abandon exactly the activities that could later give you confidence and choice.",
          "For analytics, define craftsmanship as producing work that another analyst, manager, or client would trust. A query should be correct and readable. A model should have clear grain and relationships. A dashboard should answer a business question rather than merely look attractive. A professional explanation should state assumptions, limitations, and next actions."
        ],
        examples: [
          {
            title: 'Example A — SQL interview preparation',
            body:
              'Instead of studying SQL because you hope to feel motivated, you build a 30-day portfolio of increasingly difficult business questions. Every query is formatted, commented, validated against totals, and rewritten after review. By the end, your confidence comes from evidence that you can solve problems under constraints.'
          },
          {
            title: 'Example B — Reporting role at work',
            body:
              'A recurring sales report is slow and confusing. Rather than treating it as routine work, you learn the source tables, remove duplicated logic, document KPI definitions, and redesign the output so managers can see exceptions quickly. The work becomes career capital because it improves reliability and business usefulness.'
          }
        ],
        actionPlan: [
          'Choose one skill that directly increases your usefulness this month.',
          'Define a professional quality standard for that skill.',
          'Produce one visible artifact every week: query, report, model, analysis, or documentation.',
          'Ask for specific feedback on correctness, clarity, and business usefulness.',
          'Track proof of improvement instead of tracking motivation.'
        ]
      },
      {
        title: '2. Build career capital before demanding career rewards',
        shortIdea: 'Autonomy, strong pay, and interesting work are usually purchased with rare and valuable capability.',
        explanation: [
          "Career capital is the collection of skills, relationships, reputation, experience, and evidence that makes you valuable in a labor market. The more valuable and difficult-to-replace your contribution becomes, the more leverage you generally have to obtain better assignments, flexibility, compensation, or mission-driven work.",
          "This is important during a career transition because it creates a concrete order of operations. First, build capability. Second, prove it. Third, use that proof to pursue better opportunities. Trying to skip directly to rewards can make the job search feel arbitrary because there is not yet enough evidence to support the outcome you want.",
          "For a data analyst, career capital is not the number of courses completed. It is the ability to turn messy business questions into reliable analysis. A practical portfolio might include advanced SQL, a clean star schema, reusable Power BI measures, requirement notes, data-quality checks, and a short written recommendation. These artifacts show that your technical skills work together."
        ],
        examples: [
          {
            title: 'Example A — Moving beyond basic SQL',
            body:
              'Knowing SELECT and JOIN is common. You increase career capital by becoming comfortable with window functions, CTEs, performance-aware filtering, validation queries, and explaining why your result is correct. The scarce part is not syntax; it is dependable problem solving.'
          },
          {
            title: 'Example B — Earning more autonomy',
            body:
              'A manager initially gives you narrowly defined reporting tasks. Over time you consistently clarify requirements, catch data issues early, and deliver without repeated corrections. Because your reliability is proven, the manager starts giving you broader analytical ownership. Autonomy appears after trust has been earned.'
          }
        ],
        actionPlan: [
          'List the five capabilities repeatedly requested in your target roles.',
          'Rate each capability by evidence, not confidence: no proof, basic proof, strong proof.',
          'Work first on the weakest high-value capability.',
          'Collect portfolio evidence in a single career-capital folder.',
          'Use interviews to demonstrate proof rather than merely claiming skill.'
        ]
      },
      {
        title: '3. Practice deliberately, not comfortably',
        shortIdea: 'Growth happens when practice targets a specific weakness and includes feedback.',
        explanation: [
          "Repeating familiar work can make you faster without making you much better. Deliberate practice is different: it isolates a weakness, pushes slightly beyond your comfortable level, gives you feedback, and repeats until the weakness becomes a strength. This type of practice is mentally demanding, which is why it is easy to avoid.",
          "In analytics, passive tutorial consumption feels productive because it is smooth. Real growth often feels slower. You may need to stare at an incorrect result, inspect row duplication, reconcile totals, or rebuild a measure several times. That struggle is useful when it is structured around a clear learning objective.",
          "A deliberate practice session should have one target. For example: 'Today I will learn to solve top-N-per-group problems without copying a solution.' You attempt, inspect the failure, study only the missing concept, retry, and then explain the solution in your own words. The explanation is important because it exposes shallow understanding."
        ],
        examples: [
          {
            title: 'Example A — Window functions',
            body:
              'You already know ROW_NUMBER. Instead of repeating easy ranking exercises, you choose business problems involving ties, running totals, moving averages, and partitioned percentages. After each attempt, you compare the result with an independent validation query and note the mistake pattern.'
          },
          {
            title: 'Example B — Power BI DAX',
            body:
              'You can create SUM measures, so you deliberately practice filter context. You build the same business metric using CALCULATE, REMOVEFILTERS, ALLSELECTED, and time-intelligence patterns, then test each measure under slicers. Feedback comes from whether the numbers behave correctly in different contexts.'
          }
        ],
        actionPlan: [
          'Start each study block with one precise weakness.',
          'Attempt the problem before watching or reading the solution.',
          'Use a validation method so you know whether the answer is correct.',
          'Record the mistake pattern in a short error log.',
          'Re-test the same weakness after 48–72 hours without notes.'
        ]
      },
      {
        title: '4. Use career capital to earn control carefully',
        shortIdea: 'Autonomy is valuable, but it works best when you have enough market value to support it.',
        explanation: [
          "Control over what you work on, how you work, and when you work can dramatically improve career satisfaction. But control is not simply declared. It is safer when it is backed by capability that other people value. Otherwise, avoiding structure can become avoidance rather than autonomy.",
          "A useful rule for career decisions is to test whether someone is willing to exchange something meaningful for your skill: salary, responsibility, project ownership, a contract, a referral, or a promotion. External willingness to invest is stronger evidence than internal excitement alone.",
          "For your analyst path, this means you do not need to wait until you are an expert before applying for jobs, but you should build enough proof that employers can see why giving you responsibility is reasonable. Later, as your career capital grows, you can negotiate remote work, specialization, leadership, or better compensation from a stronger position."
        ],
        examples: [
          {
            title: 'Example A — Choosing freelance analytics too early',
            body:
              'A beginner may want freelance freedom immediately, but without a repeatable delivery process client work becomes stressful. After building several complete projects, learning requirement discovery, and proving reliable delivery, freelance control becomes more realistic because the capability can support it.'
          },
          {
            title: 'Example B — Negotiating role scope',
            body:
              'After several months of consistently producing accurate reporting, you propose owning the full monthly performance dashboard. Because you have already demonstrated reliability, the request for greater control is supported by evidence rather than preference alone.'
          }
        ],
        actionPlan: [
          'Define the type of control you want: schedule, location, project ownership, or specialization.',
          'Identify what proof would make a manager comfortable granting that control.',
          'Build that proof before negotiating.',
          'Prefer small increases in autonomy that preserve learning and feedback.',
          'Do not trade away skill growth merely to escape short-term discomfort.'
        ]
      },
      {
        title: '5. Let mission emerge from mastery',
        shortIdea: 'Meaningful direction becomes easier to see after you understand a field deeply enough.',
        explanation: [
          "Big career missions are difficult to invent from the outside. When you are new to a field, you do not yet know which problems are important, which constraints are real, or where useful opportunities exist. Mastery gives you a better map. As knowledge and network grow, you begin to notice valuable problems that were previously invisible.",
          "For analytics, your first mission does not need to be grand. Your immediate mission can be to become a reliable analyst who helps people make clearer decisions. As you gain experience, you may discover a stronger direction: customer analytics, finance analytics, data quality, BI engineering, experimentation, or analytics leadership.",
          "The practical lesson is to combine focused skill building with small experiments. Do not wait for certainty. Build capability, then test possible directions through projects, conversations, and short commitments. A mission becomes credible when it is connected to problems you understand and skills you can apply."
        ],
        examples: [
          {
            title: 'Example A — Discovering a BI specialization',
            body:
              'You begin as a general analyst, but repeated dashboard projects reveal that you enjoy data modeling and metric design. You deliberately take more modeling work, study dimensional design, and gradually move toward BI development. The specialization emerges from work, not from guessing in advance.'
          },
          {
            title: 'Example B — Finding meaningful business impact',
            body:
              'A churn analysis shows that a particular customer segment leaves after a predictable service issue. Working with operations to reduce that issue produces measurable retention improvement. You become interested in customer analytics because you have experienced a concrete problem where analysis changed an outcome.'
          }
        ],
        actionPlan: [
          'Keep your near-term mission modest and specific.',
          'Notice which difficult problems repeatedly attract your attention.',
          'Run small projects to test potential specializations.',
          'Talk to practitioners one or two levels ahead of you.',
          'Update your direction every quarter using evidence from real work.'
        ]
      }
    ],
    summary: [
      "The practical lesson of So Good They Can't Ignore You is that career satisfaction is usually built from the inside out. Valuable skills create leverage. Leverage creates better opportunities, greater control, and eventually the ability to pursue work that feels more meaningful. The process is less romantic than waiting for a calling, but it is more controllable.",
      "For a data analyst career restart, the book suggests a simple priority: become difficult to ignore because your work is dependable. Build depth in SQL, Power BI, Excel, business reasoning, and communication. Turn learning into projects. Turn projects into evidence. Turn evidence into interviews, responsibility, and better roles.",
      "The long-term mindset is compounding. One excellent query does not create a career, but hundreds of deliberate repetitions, honest feedback loops, and increasingly difficult projects create capability that becomes hard to dismiss."
    ],
    conciseActionPlan: [
      'Pick one high-value analytical skill for the next 30 days.',
      'Schedule deliberate practice at least five times per week.',
      'Ship one professional artifact every week.',
      'Maintain an error-and-feedback log.',
      'Build a portfolio around business problems, not tool demonstrations.',
      'Review career capital monthly and adjust the next learning target.'
    ]
  },
  {
    id: 'deep-work',
    title: 'Deep Work',
    shortTitle: 'Deep Work',
    year: 2016,
    focus: 'Learning SQL, Excel, Power BI & Python deeply',
    favorite: true,
    readingTime: '20–24 min guide',
    overview: [
      "Deep Work is a framework for producing high-value results through sustained, distraction-free concentration. The core practical idea is that difficult cognitive skills improve faster when you protect uninterrupted attention and work at the edge of your current ability.",
      "For analytics, deep work is the difference between spending three hours around SQL and spending ninety minutes actually reasoning about a difficult query. It is the difference between watching Power BI videos and building a model whose measures you can explain under pressure. The quality of attention changes the quality of learning.",
      "The book also treats attention as trainable. If your day is constantly fragmented by notifications, short videos, chats, and context switching, concentration feels unusually hard. By repeatedly practicing focused blocks and tolerating boredom, you rebuild the ability to stay with one demanding problem."
    ],
    whyItMatters:
      'Use Deep Work as your learning engine: protect focused blocks for difficult analytics practice, reduce attention residue, and make depth a repeatable daily habit rather than an occasional burst.',
    themes: [
      {
        title: '1. Protect uninterrupted concentration',
        shortIdea: 'Difficult skills need blocks long enough for your brain to reach full problem-solving depth.',
        explanation: [
          "Deep concentration has a startup cost. During the first minutes of a difficult task, part of your mind is still carrying residue from previous messages, tabs, or unfinished decisions. If you switch again before settling, you repeatedly pay the startup cost without reaching the level where complex reasoning becomes easier.",
          "For analytical learning, a protected block should have a defined objective, the necessary data or files already open, and a clear rule against unrelated browsing. The goal is not simply to sit for a long time. The goal is to remove decisions and distractions so your full working memory can stay on one problem.",
          "A practical beginner target is sixty to ninety minutes. More experienced deep workers may use longer blocks, but consistency matters more than heroic duration. One high-quality block repeated daily will usually outperform a scattered day filled with partial attention."
        ],
        examples: [
          {
            title: 'Example A — Advanced SQL block',
            body:
              'Before the block you open SSMS, the UrbanStore schema, and one business question. Your phone is outside the room and browser tabs are closed. For 75 minutes you attempt the query, validate results, and rewrite it for clarity. You do not check solutions until the block ends.'
          },
          {
            title: 'Example B — Power BI modeling',
            body:
              'You reserve a 90-minute block only for star-schema design. Instead of switching between YouTube, WhatsApp, and the model, you inspect grain, relationships, date logic, and ambiguous filters. The uninterrupted context lets you reason across the whole model.'
          }
        ],
        actionPlan: [
          'Schedule one protected 60–90 minute block before low-value work.',
          'Write the exact objective before the block begins.',
          'Remove the phone and close unrelated apps and tabs.',
          'Keep a small distraction sheet; write impulses down instead of acting on them.',
          'End by recording what was solved and the next starting point.'
        ]
      },
      {
        title: '2. Train concentration by embracing boredom',
        shortIdea: 'If every quiet moment is filled with stimulation, your brain never practices staying with one thing.',
        explanation: [
          "Concentration is partly a behavioral skill. When you automatically reach for a phone whenever a task becomes difficult or a moment becomes empty, you teach the brain that discomfort should be escaped immediately. Deep work requires the opposite response: noticing the urge to switch and staying with the current problem.",
          "This does not require eliminating technology. It requires creating boundaries around when stimulation is allowed. You can decide that messages are checked after a deep block, not during it. You can walk without short-form video. You can wait in a queue without opening feeds. These small repetitions strengthen your tolerance for unstimulated attention.",
          "During study, boredom often appears just before useful thinking. A query fails, a DAX measure returns the wrong number, or Python throws an unfamiliar error. If you remain with the problem for another ten minutes, you may build a reasoning pattern that a quick search would have bypassed."
        ],
        examples: [
          {
            title: 'Example A — Debugging before searching',
            body:
              'A SQL query duplicates revenue. Instead of immediately searching the internet, you spend fifteen minutes checking join cardinality, grouping grain, and row counts. Even if you later look up a concept, the initial reasoning makes the answer more memorable.'
          },
          {
            title: 'Example B — Device-free walk',
            body:
              'After a study session, you take a twenty-minute walk without audio or social media. Your mind naturally reviews what you learned and notices unresolved questions. The walk becomes recovery plus consolidation instead of another stream of input.'
          }
        ],
        actionPlan: [
          'Delay nonessential phone checks until planned windows.',
          'Use at least one device-free walk or meal each day.',
          'Give hard problems a fixed struggle period before searching for help.',
          'Notice and record the urge to switch tasks without obeying it.',
          'Increase focus duration gradually rather than forcing extreme sessions.'
        ]
      },
      {
        title: '3. Create rituals that make depth automatic',
        shortIdea: 'A repeatable environment and start routine reduce the willpower required to focus.',
        explanation: [
          "Deep work becomes easier when the start of a session is predictable. A ritual can specify where you work, how long you work, what tools are allowed, what outcome you expect, and what you do when you get stuck. The purpose is to remove negotiation.",
          "For studying analytics, a ritual could be simple: same desk, water ready, phone away, one database open, timer started, objective written, and browser blocked except approved documentation. Repetition creates a cue: when the ritual begins, your brain expects sustained effort.",
          "The ritual should also define quality. For example, a SQL session is not complete when the query merely runs. It is complete when you validate totals, handle edge cases, format the code, and explain the result. Quality rules prevent deep time from becoming unstructured experimentation."
        ],
        examples: [
          {
            title: 'Example A — Morning skill ritual',
            body:
              'At 6:00 AM you open the same notebook, write one SQL objective, start a 75-minute timer, and keep only SSMS plus documentation available. The fixed sequence reduces the chance that the session turns into browsing.'
          },
          {
            title: 'Example B — Evening Power BI ritual',
            body:
              'Before the block you write the dashboard question and success condition. At the end you take one screenshot, note one modeling lesson, and write tomorrow’s first step. This closing ritual makes the next session easier to enter.'
          }
        ],
        actionPlan: [
          'Choose a fixed location for your most important study block.',
          'Define a standard start checklist of no more than five steps.',
          'State one measurable result for each block.',
          'Define what counts as complete and correct.',
          'Use a two-minute shutdown note to preserve context for tomorrow.'
        ]
      },
      {
        title: '4. Reduce shallow work and attention residue',
        shortIdea: 'Low-value activity expands unless you deliberately contain it.',
        explanation: [
          "Shallow work includes coordination, routine administration, reactive messaging, unnecessary browsing, and other tasks that do not require much cognitive depth. These activities are not always useless, but they can consume the best hours of the day because they are easy to start and provide quick feelings of activity.",
          "The hidden cost is attention residue. After switching from a difficult problem to email or social media, part of your attention remains attached to the previous context. Frequent switching therefore reduces both speed and quality even when each interruption looks small.",
          "For your learning plan, protect prime hours for high-value practice and batch shallow activities into smaller windows. Job searches, email, file organization, and course administration should not repeatedly interrupt the block where you are building rare skills."
        ],
        examples: [
          {
            title: 'Example A — Job search batching',
            body:
              'Instead of checking job portals throughout the day, you reserve 45 minutes in the afternoon. Morning hours remain available for SQL and Power BI practice, which strengthens the capabilities that make applications more competitive.'
          },
          {
            title: 'Example B — Communication windows',
            body:
              'You check WhatsApp and email at predetermined times rather than after every notification. The change does not remove communication; it prevents each message from fragmenting a difficult learning session.'
          }
        ],
        actionPlan: [
          'List recurring shallow activities and batch them.',
          'Keep messaging closed during deep blocks.',
          'Protect the first high-energy hours for difficult skill work.',
          'Use website/app blockers when self-control is unreliable.',
          'Measure deep hours weekly, not total hours spent at the computer.'
        ]
      },
      {
        title: '5. Measure depth by output, not time alone',
        shortIdea: 'The purpose of focus is valuable output and improved capability.',
        explanation: [
          "A long session is not automatically deep. You can sit quietly for two hours while avoiding the difficult part of a problem. Deep work should produce evidence: a solved analysis, a clearer model, a better explanation, a tested hypothesis, or a specific skill improvement.",
          "Tracking output prevents productivity theater. For analytics, useful measures include difficult questions solved without help, validated measures created, project milestones completed, bugs understood, and concepts you can explain from memory. Hours matter, but they are an input rather than the final score.",
          "A weekly review connects deep work to a broader goal. You ask whether focused blocks are moving you toward job readiness, stronger projects, or professional performance. If not, adjust the target rather than simply adding more hours."
        ],
        examples: [
          {
            title: 'Example A — SQL output score',
            body:
              'Five 60-minute sessions produce eight solved business questions, three documented mistakes, and one polished portfolio query. Those outputs are more meaningful than saying you studied SQL for five hours.'
          },
          {
            title: 'Example B — Power BI project milestone',
            body:
              'A week of deep work is judged by a validated date table, star schema, twelve tested measures, and one completed dashboard page. The visible milestone keeps focus connected to employable capability.'
          }
        ],
        actionPlan: [
          'Define one output metric for each study domain.',
          'Track completed deep blocks and completed outputs separately.',
          'Review the ratio every week.',
          'If hours rise but output stalls, change the task difficulty or feedback method.',
          'Celebrate finished artifacts, not merely busy days.'
        ]
      }
    ],
    summary: [
      "Deep Work is most useful as a system for converting time into capability. It argues that uninterrupted concentration is increasingly valuable because complex knowledge work requires more attention than a fragmented environment naturally allows.",
      "For analytics learning, the practical application is direct: schedule protected blocks, train yourself not to escape difficulty, use rituals, batch shallow activity, and judge focus by the quality of what you produce. A smaller number of genuine deep-work hours can be more useful than a full day of interrupted study.",
      "The long-term result is not merely productivity. It is cognitive confidence. When you repeatedly prove that you can stay with a difficult SQL query, model, analysis, or coding problem until you understand it, complex work becomes less threatening and your professional range expands."
    ],
    conciseActionPlan: [
      'Protect one 60–90 minute deep block every day.',
      'Keep phone and messaging outside the block.',
      'Start with one clearly written objective.',
      'Use a struggle period before seeking answers.',
      'Batch shallow work later in the day.',
      'Track deep outputs weekly and increase difficulty gradually.'
    ]
  },
  {
    id: 'slow-productivity',
    title: 'Slow Productivity',
    shortTitle: 'Slow Productivity',
    year: 2024,
    focus: 'Sustainable progress without burnout',
    favorite: false,
    readingTime: '15–18 min guide',
    overview: [
      "Slow Productivity offers a counterweight to overloaded knowledge work. Its practical philosophy is to reduce simultaneous commitments, allow important work to unfold at a humane pace, and place quality above visible busyness.",
      "For a demanding learning plan, this is important because intensity without recovery can create the illusion of speed while reducing retention, consistency, and health. Sustainable progress comes from controlling work in progress, matching effort to natural energy, and allowing some skills to develop over months rather than trying to master everything at once.",
      "The approach does not mean moving casually. It means being selective enough that important work receives serious attention and recovery is treated as part of performance."
    ],
    whyItMatters:
      'Use Slow Productivity to prevent an ambitious data-analytics plan from becoming an overloaded checklist. Fewer simultaneous goals, consistent pacing, and high standards produce more durable progress.',
    themes: [
      {
        title: '1. Do fewer things at the same time',
        shortIdea: 'Reduce work in progress so the most important skills receive enough attention to move forward.',
        explanation: [
          "Overload is often caused less by total ambition than by too many active commitments. Every project carries coordination, setup, decision, and recovery costs. When you try to advance SQL, Power BI, Python, Excel, interview preparation, job applications, English, and multiple projects equally every day, attention becomes thin.",
          "Doing fewer things does not mean abandoning important goals. It means sequencing them. You can keep a master list while limiting the number of active fronts. For example, SQL and Power BI may be primary for six weeks while Python remains maintenance-only.",
          "A work-in-progress limit makes progress visible because finished milestones appear faster. Completion also frees mental space. The goal is to finish meaningful units before opening new ones."
        ],
        examples: [
          {
            title: 'Example A — Two-skill sprint',
            body:
              'For six weeks you prioritize SQL and Power BI. Excel receives one maintenance session weekly and Python is paused. Because attention is concentrated, you finish a complete portfolio project instead of leaving four half-built projects.'
          },
          {
            title: 'Example B — Project WIP limit',
            body:
              'You allow only one active dashboard project and one active SQL practice track. A new dataset cannot be started until one active project reaches a defined milestone. This prevents novelty from replacing completion.'
          }
        ],
        actionPlan: [
          'Choose no more than two primary skill goals for the next six weeks.',
          'Keep secondary goals in maintenance mode.',
          'Limit active projects to one or two.',
          'Define a finish condition before starting new work.',
          'Review the WIP limit every Sunday.'
        ]
      },
      {
        title: '2. Work at a natural pace',
        shortIdea: 'Use intensity in waves instead of expecting maximum output every day.',
        explanation: [
          "Knowledge work quality varies with energy, sleep, health, complexity, and life demands. A natural pace accepts this variation. Some days support demanding analysis; others are better for review, documentation, or recovery. The system remains productive because the overall direction continues.",
          "A sustainable study plan can have hard days, moderate days, and lighter days. Recovery is not a failure state; it protects the capacity to perform hard work again. This reduces the cycle of overcommitment, missed targets, guilt, and restart.",
          "Natural pace also applies over longer periods. A major skill such as DAX or Python may need months of repeated exposure. Compressing the timeline too aggressively can produce superficial familiarity without durable understanding."
        ],
        examples: [
          {
            title: 'Example A — Weekly energy rhythm',
            body:
              'Monday through Thursday contain demanding deep-work sessions. Friday focuses on review and project cleanup. One weekend session is optional. You still progress strongly without demanding seven identical high-intensity days.'
          },
          {
            title: 'Example B — Recovery after a difficult project',
            body:
              'After finishing a major Power BI project, you spend two lighter days documenting lessons, organizing files, and reviewing mistakes before starting the next challenge. The pause consolidates learning instead of immediately replacing it.'
          }
        ],
        actionPlan: [
          'Plan weekly intensity rather than identical daily targets.',
          'Use lighter days for review, documentation, and maintenance.',
          'Protect sleep and exercise as performance infrastructure.',
          'Add buffer time after major milestones.',
          'Judge progress over months, not one imperfect day.'
        ]
      },
      {
        title: '3. Obsess over quality',
        shortIdea: 'High-quality output compounds more than a large quantity of forgettable activity.',
        explanation: [
          "When activity is easy to count, quantity can become the goal: lessons watched, questions attempted, dashboards created, applications submitted. Quality is harder to measure but more valuable. A smaller number of polished projects can communicate more capability than many rushed examples.",
          "Quality means caring about correctness, clarity, usability, and craft. In analytics, this includes clean data models, validated calculations, clear labels, readable SQL, sensible visuals, and recommendations connected to evidence.",
          "Quality obsession should not become perfectionism. The standard is professional usefulness, not endless polishing. Finish, review against criteria, improve the highest-impact weaknesses, and ship."
        ],
        examples: [
          {
            title: 'Example A — One strong portfolio project',
            body:
              'Instead of uploading ten generic dashboards, you create one retail analytics project with a documented business problem, validated SQL, a star schema, well-defined DAX, executive visuals, and a concise written recommendation.'
          },
          {
            title: 'Example B — Interview answer quality',
            body:
              'Rather than memorizing fifty shallow answers, you prepare ten important stories deeply: context, problem, analysis, decision, result, and lesson. The smaller set is more adaptable and credible.'
          }
        ],
        actionPlan: [
          'Create a written quality checklist for projects.',
          'Validate every key metric independently.',
          'Ask whether each visual or query answers a real business question.',
          'Remove unnecessary complexity before adding polish.',
          'Ship when the work is professionally useful, then capture lessons.'
        ]
      },
      {
        title: '4. Replace busyness with visible progress',
        shortIdea: 'A calm schedule can still be ambitious when milestones are clear.',
        explanation: [
          "Busyness feels measurable because the calendar is full. Progress is harder because important work can look quiet from the outside. Slow productivity replaces visible motion with milestone-based accountability.",
          "For a learning plan, milestones might be 'complete five validated DAX measures' or 'finish the customer segmentation page' rather than 'study Power BI for four hours.' Milestones give slower work a clear direction and make it easier to decide what deserves attention.",
          "The benefit is psychological as well as practical. When you know the next meaningful milestone, you can stop filling every open minute with low-value activity."
        ],
        examples: [
          {
            title: 'Example A — Weekly milestone board',
            body:
              'Your week contains three outcomes: finish one SQL analysis, complete one dashboard page, and review twenty interview questions. Daily plans are built around those outcomes rather than an arbitrary number of study hours.'
          },
          {
            title: 'Example B — Fewer job applications',
            body:
              'Instead of sending fifty generic applications, you submit a smaller number of carefully matched applications with a strong resume and relevant project evidence. The process is slower per application but higher quality.'
          }
        ],
        actionPlan: [
          'Set three meaningful weekly outcomes.',
          'Break each outcome into the next physical action.',
          'Remove activities that do not support the outcomes.',
          'Review milestones twice per week without adding new commitments impulsively.',
          'Use completion quality, not calendar fullness, as the success signal.'
        ]
      }
    ],
    summary: [
      "Slow Productivity argues for a more durable way to produce meaningful results: limit simultaneous commitments, accept variable pacing, and care deeply about quality. It is not an argument for low ambition. It is an argument for reducing the overload that prevents ambitious work from receiving enough attention.",
      "For your analytics path, the book is a reminder that skill building is a multi-year compounding process. A focused six-week SQL and Power BI cycle, followed by another deliberate cycle, is more sustainable than trying to maximize every skill every day.",
      "The ideal outcome is calm seriousness: fewer active goals, clear milestones, high standards, and enough recovery to remain consistent."
    ],
    conciseActionPlan: [
      'Choose two primary goals for the next six weeks.',
      'Set three outcome-based milestones each week.',
      'Use hard, moderate, and light days.',
      'Apply a professional quality checklist before shipping work.',
      'Keep one weekly recovery block with no career work.',
      'Review progress monthly and sequence the next goals.'
    ]
  },
  {
    id: 'digital-minimalism',
    title: 'Digital Minimalism',
    shortTitle: 'Digital Minimalism',
    year: 2019,
    focus: 'Controlling distractions',
    favorite: false,
    readingTime: '15–18 min guide',
    overview: [
      "Digital Minimalism is about using technology intentionally rather than allowing default products and notifications to decide where your attention goes. The key question is not whether a technology is good or bad, but whether it strongly supports something you value enough to justify its costs.",
      "For learning and career rebuilding, the most important resource being protected is attention. Short-form video, constant notifications, and habitual checking can consume the small gaps that would otherwise become reading, reflection, practice, rest, or conversation.",
      "The goal is not to become anti-technology. It is to make digital tools serve a chosen life. SQL documentation, Power BI forums, job portals, email, and ChatGPT can be valuable; endless feeds may not be."
    ],
    whyItMatters:
      'Use Digital Minimalism to protect the attention required for deep analytics learning and to prevent entertainment platforms from occupying the same mental space as your highest-priority goals.',
    themes: [
      {
        title: '1. Start from values, not apps',
        shortIdea: 'Decide what matters first, then choose technology that strongly supports it.',
        explanation: [
          "Most people accumulate digital tools one at a time. Each app seems harmless, but the combined system creates constant interruption. A values-first approach reverses the process: identify what matters, then decide which tools earn a place.",
          "For you, high-level values might include professional mastery, family presence, health, faith, and financial progress. A digital tool should have a clear role in one of these areas. If the role is vague, replaceable, or mostly entertainment, it deserves stricter limits.",
          "The decision should include operating rules. Keeping YouTube for technical learning is different from allowing the home feed to decide what you watch."
        ],
        examples: [
          {
            title: 'Example A — YouTube by direct search only',
            body:
              'You keep YouTube because high-quality Power BI and SQL tutorials are valuable, but you open videos through saved links or direct search and avoid Shorts and the recommendation feed. The tool remains; the attention trap is reduced.'
          },
          {
            title: 'Example B — LinkedIn with a purpose',
            body:
              'You use LinkedIn for job research, targeted networking, and posting projects. You do not keep the feed open throughout the day. Two scheduled sessions per week are enough for the professional value you want.'
          }
        ],
        actionPlan: [
          'Write your five highest-priority values.',
          'List the digital tools you use most.',
          'For each tool, state exactly which value it serves.',
          'Remove or restrict tools with weak value and high attention cost.',
          'Create operating rules for every high-risk platform you keep.'
        ]
      },
      {
        title: '2. Reclaim solitude and high-quality leisure',
        shortIdea: 'A mind needs periods without external input to process, plan, and recover.',
        explanation: [
          "Solitude in this context means freedom from other minds entering your attention through messages, feeds, audio, or video. You can be physically alone and still receive continuous external input. Without mental space, reflection becomes harder.",
          "High-quality leisure provides an alternative to passive digital consumption. Exercise, conversation, reading, building something, walking, and practicing a skill can be more satisfying because they require participation.",
          "For study performance, solitude supports memory consolidation and problem solving. A device-free walk after learning can help ideas settle more effectively than immediately moving into another feed."
        ],
        examples: [
          {
            title: 'Example A — Post-study walk',
            body:
              'After a 90-minute SQL block, you walk for twenty minutes without headphones. You mentally review the hardest concept and notice one question to test tomorrow. The walk provides recovery without flooding attention with new information.'
          },
          {
            title: 'Example B — Evening leisure replacement',
            body:
              'Instead of one hour of short videos, you spend thirty minutes with family and thirty minutes reading or planning the next day. The evening feels slower, but sleep and attention improve because stimulation is lower.'
          }
        ],
        actionPlan: [
          'Schedule one daily period with no incoming digital content.',
          'Create a list of five high-quality leisure alternatives.',
          'Keep meals or walks device-free when practical.',
          'Protect the final 30–60 minutes before sleep from short-form feeds.',
          'Use boredom as a cue to choose intentional leisure rather than automatic scrolling.'
        ]
      },
      {
        title: '3. Conduct a deliberate digital reset',
        shortIdea: 'Temporary removal makes it easier to see which tools are genuinely useful.',
        explanation: [
          "Habitual technology use is difficult to evaluate while you are inside the habit. A deliberate reset creates contrast. During the reset, optional technologies are removed or sharply restricted while you rediscover offline activities and observe what you actually miss.",
          "The important step is reintroduction. A tool returns only if it supports something you value and you can define how it will be used. This prevents the reset from becoming a short detox followed by the same old defaults.",
          "For a career-focused period, even a seven-day mini reset can reveal how much time is lost to repeated checking. Longer resets can create stronger evidence."
        ],
        examples: [
          {
            title: 'Example A — Seven-day short-video reset',
            body:
              'You block Instagram Reels, YouTube Shorts, and similar feeds for one week. The recovered time is pre-assigned to walking, family, or a small analytics review session. At the end, you decide whether any of the platforms deserve reintroduction.'
          },
          {
            title: 'Example B — Notification reset',
            body:
              'You disable all nonessential notifications and allow only calls, calendar reminders, and critical messages. After a week you discover that nearly nothing urgent was lost, while concentration becomes noticeably easier.'
          }
        ],
        actionPlan: [
          'Choose a reset period and write the start/end dates.',
          'Remove optional high-distraction tools during that period.',
          'Pre-plan offline or focused replacement activities.',
          'Keep notes on what you genuinely miss and why.',
          'Reintroduce only tools with a clear value and a usage rule.'
        ]
      },
      {
        title: '4. Make attention friction work for you',
        shortIdea: 'Small barriers can stop automatic behavior before it captures your time.',
        explanation: [
          "Many digital products are designed to minimize friction. One tap opens an endless stream. You can reverse the design by adding deliberate friction: logging out, removing apps, blocking sites, disabling recommendations, or using a separate browser profile for study.",
          "The purpose is not to make useful work difficult. It is to create a pause between impulse and action. Even a ten-second barrier can be enough for you to remember your original intention.",
          "For analytics study, a clean digital environment reduces the number of micro-decisions you must resist. This preserves self-control for the actual difficult work."
        ],
        examples: [
          {
            title: 'Example A — Study browser profile',
            body:
              'Your study browser contains only documentation, ChatGPT, GitHub, Power BI resources, and job sites. Social media is not logged in. During a deep block, opening a new tab therefore does not immediately expose a feed.'
          },
          {
            title: 'Example B — Phone outside the room',
            body:
              'The phone remains in another room during a 75-minute practice block. The physical friction removes dozens of tiny decisions about whether to check it.'
          }
        ],
        actionPlan: [
          'Remove high-distraction apps from your home screen or phone.',
          'Use a dedicated study browser profile.',
          'Log out of feeds you want to reduce.',
          'Block distracting sites during deep-work windows.',
          'Keep the phone physically away during your hardest work.'
        ]
      }
    ],
    summary: [
      "Digital Minimalism is a philosophy of intentional technology use. It asks you to protect attention by choosing tools according to values, creating high-quality alternatives, and using explicit operating rules rather than defaults.",
      "For your analytics goals, the benefit is practical: more uninterrupted time, less cognitive fragmentation, and a clearer separation between tools that help you learn and platforms that mainly consume attention.",
      "The objective is not digital purity. It is control. Technology stays when it earns its place."
    ],
    conciseActionPlan: [
      'Define the values your technology should support.',
      'Remove short-form feeds for a trial period.',
      'Use direct-search rules for learning platforms.',
      'Disable nonessential notifications.',
      'Create a study-only browser environment.',
      'Schedule device-free solitude and high-quality leisure daily.'
    ]
  },
  {
    id: 'time-block-planner',
    title: 'The Time-Block Planner',
    shortTitle: 'Time-Block Planner',
    year: 2020,
    focus: 'Structuring daily study time',
    favorite: false,
    readingTime: '14–17 min guide',
    overview: [
      "The Time-Block Planner turns intentions into a visible daily schedule. Instead of keeping a long task list and reacting moment by moment, you assign blocks of time to specific work and revise the plan when reality changes.",
      "The method is especially useful for multi-skill study because it forces tradeoffs. You cannot give the same hour to SQL, Power BI, Python, applications, exercise, and communication. A time-block plan therefore exposes unrealistic expectations before the day begins.",
      "The point is not rigid perfection. A good plan is rewritten when needed. The value comes from repeatedly deciding what your time should be doing rather than allowing the loudest input to make the decision."
    ],
    whyItMatters:
      'Use time blocking to convert your analytics roadmap into a realistic daily operating plan, protect deep-work windows, and keep job search, review, exercise, and recovery from competing randomly.',
    themes: [
      {
        title: '1. Give every important minute a job',
        shortIdea: 'Translate priorities into calendar blocks instead of relying on a task list alone.',
        explanation: [
          "A task list tells you what exists, but not when it will happen or how much can fit into a day. Time blocking combines tasks with capacity. By assigning work to blocks, you immediately see tradeoffs and can protect important activities before reactive work fills the schedule.",
          "Blocks can represent single tasks or categories. A deep-work block might contain one SQL problem set. A shallow-work block might contain email, job applications, and file organization. The level of detail should help action rather than create bureaucracy.",
          "The schedule is a plan, not a contract. Its job is to guide attention."
        ],
        examples: [
          {
            title: 'Example A — Morning analytics block',
            body:
              '6:00–7:30 is assigned to SQL deliberate practice, 7:30–8:00 to review, and 8:00 onward to other responsibilities. Because SQL already owns the block, you do not renegotiate the priority after waking.'
          },
          {
            title: 'Example B — Job search containment',
            body:
              'Applications are assigned to 4:00–4:45 PM. During morning study, a new job notification goes onto a capture list instead of interrupting Power BI work.'
          }
        ],
        actionPlan: [
          'Plan tomorrow in 10–15 minutes the evening before.',
          'Block the hardest cognitive work first.',
          'Group shallow tasks into one or two windows.',
          'Add transition and meal buffers.',
          'Keep the plan visible while you work.'
        ]
      },
      {
        title: '2. Revise the plan instead of abandoning it',
        shortIdea: 'A time-block schedule stays useful because it can be rewritten when the day changes.',
        explanation: [
          "Rigid planning fails because real days contain interruptions, underestimated tasks, and changing energy. The better response is not to abandon planning but to re-plan. When reality changes, draw a new route through the remaining hours.",
          "This habit develops strategic thinking. You repeatedly ask: given the time left, what matters most now? That question is more useful than trying to recover an impossible original schedule.",
          "For learning, re-planning protects the highest-value work. If a two-hour interruption occurs, you may shorten a secondary block while preserving at least forty-five minutes of deep practice."
        ],
        examples: [
          {
            title: 'Example A — Unexpected family task',
            body:
              'A morning responsibility consumes one hour. Instead of declaring the study day lost, you move the Power BI block to the afternoon, reduce administration, and preserve the most important milestone.'
          },
          {
            title: 'Example B — SQL problem takes longer',
            body:
              'A query planned for 45 minutes requires 90. You intentionally extend the block because the learning is valuable, then shorten a low-priority review block later. The schedule adapts to the work.'
          }
        ],
        actionPlan: [
          'When a block breaks, pause for two minutes and redraw the remaining day.',
          'Preserve the highest-value block whenever possible.',
          'Cut or defer low-priority work first.',
          'Record recurring estimation errors.',
          'Use those errors to improve future block sizes.'
        ]
      },
      {
        title: '3. Match blocks to cognitive energy',
        shortIdea: 'Put difficult work where your attention is strongest and routine work where it is weaker.',
        explanation: [
          "Not all hours have equal cognitive value. A time-block system becomes more effective when it respects your energy pattern. If your best concentration is early morning, that is a poor time for email or file cleanup.",
          "You can create block types: deep, collaborative, shallow, recovery, and personal. Matching task type to energy reduces the amount of willpower needed to perform.",
          "This also prevents guilt when energy naturally falls. A lower-energy hour can still be useful if it was intentionally assigned to review, organization, or walking."
        ],
        examples: [
          {
            title: 'Example A — High-energy SQL',
            body:
              'Your strongest morning block is reserved for advanced queries and problem solving. After lunch, when concentration is lower, you review notes, organize project files, or apply for roles.'
          },
          {
            title: 'Example B — Evening review',
            body:
              'Rather than forcing new Python concepts late at night, you use a 30-minute evening block for flashcards, error-log review, and planning the next morning.'
          }
        ],
        actionPlan: [
          'Track your energy for one week.',
          'Identify your best 60–120 minute cognitive window.',
          'Reserve that window for the hardest skill.',
          'Place shallow and administrative work in lower-energy periods.',
          'Protect recovery after sustained deep work.'
        ]
      },
      {
        title: '4. Shut down the day deliberately',
        shortIdea: 'A clear ending reduces mental carryover and makes tomorrow easier to start.',
        explanation: [
          "Unfinished tasks create mental noise when they remain vague. A shutdown routine captures open loops, checks tomorrow’s obligations, and creates a trusted plan for what happens next. Once the work is captured, you can disengage more fully.",
          "For study, shutdown prevents late-night anxiety about whether you did enough. You review the actual outputs, note the first next step, and close the day. The process creates continuity without requiring constant rumination.",
          "A good shutdown is short. It should reduce cognitive load, not become another major project."
        ],
        examples: [
          {
            title: 'Example A — Project continuity note',
            body:
              'Before closing Power BI, you write: “Tomorrow: fix Date-to-Sales relationship, then validate YTD measure against SQL.” The next session begins with a specific action instead of rediscovering context.'
          },
          {
            title: 'Example B — End-of-day scorecard',
            body:
              'You record deep minutes, one output completed, one mistake learned, and tomorrow’s top priority. The review takes five minutes and prevents the day from being judged only by feeling.'
          }
        ],
        actionPlan: [
          'Capture unfinished tasks in one trusted list.',
          'Write tomorrow’s top one to three outcomes.',
          'Record the exact next step for active projects.',
          'Close work apps after the shutdown.',
          'Use the evening for recovery rather than continuous low-grade work.'
        ]
      }
    ],
    summary: [
      "The Time-Block Planner is a practical bridge between goals and hours. It replaces reactive task switching with an explicit plan for what each part of the day is for, while allowing that plan to be revised when reality changes.",
      "For analytics study, time blocking is useful because your roadmap contains more valuable activities than one day can hold. The planner forces priority, protects deep work, contains shallow work, and gives recovery a legitimate place.",
      "The best time-block schedule is not the one followed perfectly. It is the one that helps you repeatedly return your attention to the most important available work."
    ],
    conciseActionPlan: [
      'Plan tomorrow before the current day ends.',
      'Block your highest-value deep work first.',
      'Batch job search and communication.',
      'Use realistic buffers between blocks.',
      'Re-plan immediately when the day changes.',
      'Finish with a five-minute shutdown routine.'
    ]
  }
];

export const FAVORITE_CAL_NEWPORT_BOOKS = CAL_NEWPORT_BOOKS.filter(
  (book) => book.favorite
);

export const CAL_NEWPORT_LIBRARY_UPDATED = '26-Sep-2026';
