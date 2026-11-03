export const defaultQuestions = [
  ['Which method creates a new array?', ['map()', 'push()', 'pop()', 'shift()'], 0],
  ['Which keyword declares a block-scoped variable?', ['var', 'let', 'function', 'return'], 1],
  ['What does React use to pass data to components?', ['Props', 'SQL', 'Routes', 'Cookies'], 0],
];
export const defaultLessons = [
  'Introduction & learning goals',
  'Components and props',
  'State and events',
  'Building your first application',
];
export const initialWorkflows = {
  queries: [
    {
      id: 'query-1',
      course: 'Full Stack Web Development',
      student: 'Kavin Raj',
      title: 'How do I lift state between components?',
      message: 'I need two components to share their selected value.',
      status: 'Resolved',
      replies: [
        {
          author: 'Arjun Kumar',
          message: 'Move shared state to the closest common parent and pass it through props.',
        },
      ],
    },
  ],
  submissions: [],
  evaluations: {},
  assessmentConfigs: {},
  assessmentResults: [],
  courseContent: {},
  resources: [],
  batches: {
    'FSWD · Sep 2026': {
      course: 'Full Stack Web Development',
      mentor: 'Arjun Kumar',
      students: ['Kavin Raj', 'Ananya Iyer', 'Rahul Menon'],
    },
    'UXD · Sep 2026': {
      course: 'UI/UX Design Fundamentals',
      mentor: 'Priya Sharma',
      students: ['Divya Suresh', 'Meera Nair'],
    },
  },
  certificates: {
    'Git & GitHub Essentials': {
      name: 'Kavin Raj',
      number: 'CE-2026-00421',
      date: '2026-08-30',
      status: 'Issued',
      events: [{ action: 'Issued', date: '2026-08-30' }],
    },
  },
  opportunities: {},
  applications: [],
  announcements: {},
  bank: defaultQuestions,
};
