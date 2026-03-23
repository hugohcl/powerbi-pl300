// ─── State ───
export const S = {
  tab: 'home',
  // Formation
  chapterIdx: null, // null = chapter list
  // Quiz
  quizMode: 'training', // training | exam
  quizFilter: 'all', // all | PQ | MO | VA | DE | ch1-ch7
  quizQuestions: [],
  qi: 0,
  sel: null,
  shown: false,
  score: 0,
  total: 0,
  quizHistory: [], // {wrong question indices for review}
  multiSel: [],    // selected indices for type:"multi"
  orderSel: [],    // selected indices for type:"order"
  // Case studies
  caseMode: false,
  caseIdx: null,    // which case is selected
  caseQi: 0,        // current question in case
  caseSel: null,
  caseShown: false,
  caseScore: 0,
  caseTotal: 0,
  // Exam
  examActive: false,
  examTimer: null,
  examTimeLeft: 0,
  examAnswers: [],
  // Flashcards
  fcFilter: 'all',
  fcIdx: 0,
  fcFlipped: false,
  // Progress
  missions: {},    // {missionId: true}
  checklist: {},   // {cl-chId-idx: true} — checklist séparée des missions
  known: {},       // {flashcardIdx: {ef, interval, repetitions, nextReview}} SM-2 data (migrated from old 0|1|2|3)
  quizStats: {},   // {questionHash: {right, wrong}}
  examHistory: [], // [{date, score, total, pct, byDomain}]
  examUserAnswers: [], // user answers during exam (parallel to quizQuestions)
  examReview: false,
  examFullReview: false,
  examReviewData: [],
  // Exercises
  exMode: false,
  exFilter: 'all',
  exDiffFilter: 0,
  exIdx: 0,
  exInput: '',
  exChecked: false,
  exCorrect: false,
  exHintLevel: 0,
  exShowSolution: false,
  exCompleted: {},
  // Guided mode
  exGuided: false,
  exGuidedStep: 0,
  exGuidedHints: {},  // {stepIdx: true} — hints revealed per step
  // Gamification
  xp: 0,
  level: 0,
  badges: [],
  streak: 0,
  lastActiveDate: null,
  xpHistory: [],
  // Interview tab
  interviewFilter: 'all',
  interviewReviewed: {},
  // Daily Mix
  dailyMixActive: false,
  dailyMixSteps: [],
  dailyMixIdx: 0,
  dailyMixScore: 0,
  dailyMixTotal: 0,
  dailyMixFlipped: false,
  dailyMixSel: null,
  dailyMixShown: false,
  // Streak enhanced
  streakFreezes: 1,
  dailyGoal: 50, // XP per day
  // Weekly challenge
  weeklyChallenge: null,
  weeklyChallengeDate: null,
  // Flashcard QCM mode
  fcQuizMode: true,
  fcQuizOptions: [],
  fcQuizSel: null,
  fcQuizShown: false,
  // Pomodoro
  pomodoro: {
    active: false,
    mode: 'work',
    timeLeft: 25 * 60,
    cycle: 0,
    interval: null,
    paused: false,
    dropdownOpen: false
  },
};

// ─── Supabase config ───
export const SUPABASE_URL = 'https://ciajqbaufrypvewzcwof.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpYWpxYmF1ZnJ5cHZld3pjd29mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzE5MzgsImV4cCI6MjA4OTg0NzkzOH0.6REuqCgb5XBqANsS0BVNtYf0ggGK6pKBWBhS7S5-UIc';
export const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ─── Sync callback (injected by main app) ───
let _syncCallback = null;
export function setSyncCallback(fn) { _syncCallback = fn; }

// ─── Persistence ───
export function getSaveData() {
  return { missions: S.missions, checklist: S.checklist, known: S.known, quizStats: S.quizStats, examHistory: S.examHistory, exCompleted: S.exCompleted, xp: S.xp, level: S.level, badges: S.badges, streak: S.streak, lastActiveDate: S.lastActiveDate, xpHistory: S.xpHistory, interviewReviewed: S.interviewReviewed, streakFreezes: S.streakFreezes, dailyGoal: S.dailyGoal, weeklyChallenge: S.weeklyChallenge, weeklyChallengeDate: S.weeklyChallengeDate, weeklyQuizLog: S.weeklyQuizLog };
}

export function save() {
  const data = getSaveData();
  try { localStorage.setItem('pbi-pl300', JSON.stringify(data)); } catch(e) {}
  // Debounced cloud sync via callback
  if (_syncCallback) _syncCallback();
}

export function applyData(d) {
  if (!d) return;
  S.missions = d.missions || {};
  // Migration : déplacer les entrées cl-* de missions vers checklist
  Object.keys(S.missions).forEach(k => {
    if (k.startsWith('cl-')) {
      if (!d.checklist) d.checklist = {};
      d.checklist[k] = S.missions[k];
      delete S.missions[k];
    }
  });
  S.checklist = d.checklist || {};
  S.known = d.known || {};
  S.quizStats = d.quizStats || {};
  S.examHistory = d.examHistory || [];
  S.exCompleted = d.exCompleted || {};
  S.xp = d.xp || 0;
  S.level = d.level || 0;
  S.badges = d.badges || [];
  S.streak = d.streak || 0;
  S.lastActiveDate = d.lastActiveDate || null;
  S.xpHistory = d.xpHistory || [];
  S.interviewReviewed = d.interviewReviewed || {};
  S.streakFreezes = d.streakFreezes != null ? d.streakFreezes : 1;
  S.dailyGoal = d.dailyGoal || 50;
  S.weeklyChallenge = d.weeklyChallenge || null;
  S.weeklyChallengeDate = d.weeklyChallengeDate || null;
  S.weeklyQuizLog = d.weeklyQuizLog || [];
}

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem('pbi-pl300'));
    if (d) applyData(d);
  } catch(e) {}
}
