import express from 'express';
import axios from 'axios';
import Exam from '../models/Exam';
import ExamResult from '../models/ExamResult';
import { requireStudent, requireTeacher } from '../middleware/auth';

const router = express.Router();

function validateStudentIdScope(req: any, res: any) {
  const requestedStudentId = req.query?.studentId || req.body?.studentId;
  if (!requestedStudentId) {
    return true;
  }

  if (!req.user?.studentId) {
    res.status(403).json({ message: 'Student ID is not available for this account' });
    return false;
  }

  if (req.user.studentId !== requestedStudentId) {
    res.status(403).json({ message: 'Student ID does not match authenticated student' });
    return false;
  }

  return true;
}

/* =========================================================
   JUDGE0 LANGUAGE MAP
========================================================= */
function mapLanguageToJudge0Id(lang: string): number {
  const l = (lang || '').toLowerCase();
  switch (l) {
    case 'python':
    case 'python3':
      return 71;
    case 'java':
      return 62;
    case 'cpp':
    case 'c++':
      return 54;
    case 'c':
      return 50;
    case 'javascript':
    case 'node':
      return 63;
    default:
      return 71;
  }
}

/* =========================================================
   RUN CODE (SINGLE)
========================================================= */
async function runCodeOnce(code: string, language: string, stdin: string) {
  try {
    const response = await axios.post(
      process.env.JUDGE0_URL!,
      {
        source_code: code,
        language_id: mapLanguageToJudge0Id(language),
        stdin: stdin ?? ''
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data;

    if (data.status?.id !== 3) {
      return {
        output: '',
        stderr: (data.stderr || data.compile_output || data.status?.description || '').toString()
      };
    }

    return { output: data.stdout?.toString() || '', stderr: '' };
  } catch (err: any) {
    return { output: '', stderr: err.message || 'Execution error' };
  }
}

/* =========================================================
   RUN AGAINST TEST CASES
========================================================= */
async function runCodeAgainstTestCases(
  code: string,
  language: string,
  testCases: { input: string; expectedOutput: string }[]
) {
  let passedCount = 0;
  const outputs: any[] = [];

  for (const tc of testCases) {
    const result = await runCodeOnce(code, language, tc.input);
    const actual = (result.output || '').trim();
    const expected = (tc.expectedOutput || '').trim();
    const passed = actual === expected;

    if (passed) passedCount++;

    outputs.push({
      input: tc.input,
      output: actual,
      expectedOutput: expected,
      passed
    });
  }

  return { passedCount, totalCount: testCases.length, outputs };
}

/* =========================================================
   TEACHER ROUTES
========================================================= */

/**
 * GET TEACHER EXAMS
 */
router.get('/teacher/all', requireTeacher, async (req: any, res) => {
  const now = new Date();

  const exams = await Exam.find({ createdBy: req.user._id })
    .sort({ createdAt: -1 });

  const examsWithStatus = exams.map(exam => {
    let status: 'upcoming' | 'live' | 'expired';

    if (now < exam.startTime) status = 'upcoming';
    else if (now > exam.endTime) status = 'expired';
    else status = 'live';

    return {
      ...exam.toObject(),
      status
    };
  });

  res.json({ exams: examsWithStatus });
});


/**
 * CREATE EXAM
 */
router.post('/teacher/create', requireTeacher, async (req: any, res) => {
  const exam = new Exam({ ...req.body, createdBy: req.user._id });
  await exam.save();
  res.status(201).json({ exam });
});

/**
 * UPDATE EXAM
 */
router.put('/teacher/:examId', requireTeacher, async (req: any, res) => {
  const exam = await Exam.findOneAndUpdate(
    { _id: req.params.examId, createdBy: req.user._id },
    req.body,
    { new: true }
  );

  if (!exam) {
    return res.status(404).json({ message: 'Exam not found' });
  }

  res.json({ exam });
});

/**
 * DELETE EXAM
 */
router.delete('/teacher/:examId', requireTeacher, async (req: any, res) => {
  const exam = await Exam.findOneAndDelete({
    _id: req.params.examId,
    createdBy: req.user._id
  });

  if (!exam) {
    return res.status(404).json({ message: 'Exam not found' });
  }

  res.json({ message: 'Exam deleted successfully' });
});




/* =========================================================
   STUDENT ROUTES
========================================================= */

/**
 * GET AVAILABLE EXAMS (LIVE ONLY)
 */
router.get('/available', requireStudent, async (req, res) => {
  try {
    if (!validateStudentIdScope(req, res)) return;

    const now = new Date();

    const exams = await Exam.find({
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now }
    }).select('-sections.questions.correctAnswer -sections.questions.testCases');

    res.json({ exams });
  } catch {
    res.status(500).json({ message: 'Failed to load exams' });
  }
});

/**
 * GET ALL EXAMS WITH STATUS (STUDENT)
 */
router.get('/all-status', requireStudent, async (req: any, res) => {
  if (!validateStudentIdScope(req, res)) return;

  const now = new Date();

  const exams = await Exam.find({ isActive: true })
    .select('-sections.questions.correctAnswer -sections.questions.testCases')
    .sort({ startTime: 1 });

  const examsWithStatus = exams.map((exam) => {
    let status: 'upcoming' | 'live' | 'expired' = 'upcoming';

    if (now >= exam.startTime && now <= exam.endTime) status = 'live';
    if (now > exam.endTime) status = 'expired';

    return {
      ...exam.toObject(),
      status,
    };
  });

  res.json({ exams: examsWithStatus });
});

/**
 * START EXAM
 */
router.post('/:examId/start', requireStudent, async (req: any, res) => {
  if (!validateStudentIdScope(req, res)) return;

  const exam = await Exam.findById(req.params.examId);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const result = new ExamResult({
    student: req.user._id,
    exam: exam._id,
    totalPoints: exam.totalPoints,
    startTime: new Date(),
    isCompleted: false
  });

  await result.save();
  res.json({ examResultId: result._id });
});

/**
 * COMPILE (RUN BUTTON)
 */
router.post('/:examId/compile', requireStudent, async (req, res) => {
  const { code, language, stdin } = req.body;
  if (!code || !language) {
    return res.status(400).json({ message: 'Code & language required' });
  }

  const result = await runCodeOnce(code, language, stdin || '');
  res.json({ result });
});

/**
 * SUBMIT EXAM
 */
router.post('/:examId/submit', requireStudent, async (req: any, res) => {
  if (!validateStudentIdScope(req, res)) return;

  const { mcqAnswers = [], codingAnswers = [], timeTaken } = req.body;

  const exam = await Exam.findById(req.params.examId);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const examResult = await ExamResult.findOne({
    student: req.user._id,
    exam: exam._id
  });

  if (!examResult) {
    return res.status(404).json({ message: 'Exam not started' });
  }

  let score = 0;

  /* MCQ */
  const mcqProcessed: any[] = [];
  for (const ans of mcqAnswers) {
    const q = exam.sections[ans.sectionIndex]?.questions[ans.questionIndex];
    if (!q || q.questionType !== 'mcq') continue;

    const correct = q.correctAnswer === ans.selectedAnswer;
    const points = correct ? q.points : 0;
    score += points;

    mcqProcessed.push({ ...ans, isCorrect: correct, pointsEarned: points });
  }

  /* CODING */
  const codingProcessed: any[] = [];
  for (const ans of codingAnswers) {
    const q = exam.sections[ans.sectionIndex]?.questions[ans.questionIndex];
    if (!q || q.questionType !== 'coding') continue;

    const run = await runCodeAgainstTestCases(ans.code, ans.language, q.testCases || []);
    const earned = Math.round((run.passedCount / Math.max(1, run.totalCount)) * q.points);
    score += earned;

    codingProcessed.push({
      ...ans,
      passedCount: run.passedCount,
      totalCount: run.totalCount,
      outputPerTest: run.outputs,
      pointsEarned: earned
    });
  }

  examResult.mcqAnswers = mcqProcessed;
  examResult.codingAnswers = codingProcessed;
  examResult.score = score;
  examResult.percentage = Math.round((score / exam.totalPoints) * 100);
  examResult.timeTaken = timeTaken;
  examResult.endTime = new Date();
  examResult.isCompleted = true;

  await examResult.save();

  res.json({
    message: 'Exam submitted successfully',
    score: examResult.score,
    percentage: examResult.percentage
  });
});

/**
 * GET EXAM FOR STUDENT (ONLY IF LIVE & NOT ATTEMPTED)
 */
router.get('/:examId', requireStudent, async (req: any, res) => {
  if (!validateStudentIdScope(req, res)) return;

  const exam = await Exam.findById(req.params.examId);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const now = new Date();
  if (now < exam.startTime || now > exam.endTime) {
    return res.status(403).json({ message: 'Exam not live' });
  }

  const attempted = await ExamResult.findOne({
    student: req.user._id,
    exam: exam._id
  });

  if (attempted) {
    return res.status(400).json({ message: 'Already attempted' });
  }

  const safeExam = {
    ...exam.toObject(),
    sections: exam.sections.map(sec => ({
      sectionType: sec.sectionType,
      title: sec.title,
      instructions: sec.instructions,
      order: sec.order,
      questions: sec.questions.map(q =>
        q.questionType === 'mcq'
          ? {
              questionType: 'mcq',
              question: q.question,
              options: q.options,
              points: q.points
            }
          : {
              questionType: 'coding',
              question: q.question,
              starterCode: q.starterCode,
              language: q.language,
              points: q.points
            }
      )
    }))
  };

  res.json({ exam: safeExam });
});

export default router;
