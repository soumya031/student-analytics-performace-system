import express from 'express';
import mongoose from 'mongoose';
import Exam from '../models/Exam';
import ExamResult from '../models/ExamResult';
import TeacherRemark from '../models/TeacherRemark';
import { requireStudent, requireTeacher } from '../middleware/auth';
import { executeCode, runCodeAgainstTestCases } from '../services/codeExecution';
import { generateCodingRecommendation } from '../services/recommendation';

const router = express.Router();

const ALLOWED_SUBJECTS = ['aptitude', 'dsa', 'computer_science'] as const;

function isValidExamId(examId: string) {
  return mongoose.Types.ObjectId.isValid(examId);
}

function buildValidationError(message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 400;
  return error;
}

function normalizeExamPayload(payload: any) {
  const title = payload?.title?.trim();
  const description = payload?.description?.trim();
  const subject = payload?.subject;
  const duration = Number(payload?.duration);
  const startTime = new Date(payload?.startTime);
  const endTime = new Date(payload?.endTime);
  const rawSections = Array.isArray(payload?.sections) ? payload.sections : [];

  if (!title) throw buildValidationError('Title is required');
  if (!description) throw buildValidationError('Description is required');
  if (!ALLOWED_SUBJECTS.includes(subject)) {
    throw buildValidationError('Subject is invalid');
  }
  if (!Number.isFinite(duration) || duration < 1) {
    throw buildValidationError('Duration must be at least 1 minute');
  }
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw buildValidationError('Start time and end time are required');
  }
  if (endTime <= startTime) {
    throw buildValidationError('End time must be after start time');
  }
  if (!rawSections.length) {
    throw buildValidationError('Add at least one section');
  }

  const sections: any[] = rawSections.map((section: any, sectionIndex: number) => {
    const sectionType = section?.sectionType;
    const titleFallback = sectionType === 'mcq' ? 'MCQ Section' : 'Coding Section';
    const questions = Array.isArray(section?.questions) ? section.questions : [];

    if (!['mcq', 'coding'].includes(sectionType)) {
      throw buildValidationError(`Section ${sectionIndex + 1} has an invalid type`);
    }

    if (!questions.length) {
      throw buildValidationError(`Section ${sectionIndex + 1} must include at least one question`);
    }

    return {
      sectionType,
      title: section?.title?.trim() || titleFallback,
      instructions: section?.instructions?.trim() || '',
      order: Number(section?.order || sectionIndex + 1),
      questions: questions.map((question: any, questionIndex: number) => {
        const prompt = question?.question?.trim();
        const points = Number(question?.points);

        if (!prompt) {
          throw buildValidationError(
            `Section ${sectionIndex + 1}, question ${questionIndex + 1} cannot be empty`
          );
        }

        if (!Number.isFinite(points) || points < 1) {
          throw buildValidationError(
            `Section ${sectionIndex + 1}, question ${questionIndex + 1} must have at least 1 point`
          );
        }

        if (sectionType === 'mcq') {
          const options = Array.isArray(question?.options)
            ? question.options.map((option: any) => String(option || '').trim())
            : [];
          const correctAnswer = Number(question?.correctAnswer);

          if (options.length < 2 || options.some((option: string) => !option)) {
            throw buildValidationError(
              `Section ${sectionIndex + 1}, question ${questionIndex + 1} must include valid options`
            );
          }

          if (
            !Number.isInteger(correctAnswer)
            || correctAnswer < 0
            || correctAnswer >= options.length
          ) {
            throw buildValidationError(
              `Section ${sectionIndex + 1}, question ${questionIndex + 1} must have a valid correct answer`
            );
          }

          return {
            questionType: 'mcq',
            question: prompt,
            options,
            correctAnswer,
            points,
          };
        }

        const language = String(question?.language || '').trim();
        const testCases = Array.isArray(question?.testCases) ? question.testCases : [];

        if (!language) {
          throw buildValidationError(
            `Section ${sectionIndex + 1}, question ${questionIndex + 1} needs a language`
          );
        }

        if (!testCases.length) {
          throw buildValidationError(
            `Section ${sectionIndex + 1}, question ${questionIndex + 1} needs at least one test case`
          );
        }

        return {
          questionType: 'coding',
          question: prompt,
          starterCode: question?.starterCode || '',
          language,
          points,
          testCases: testCases.map((testCase: any, testCaseIndex: number) => {
            const input = String(testCase?.input ?? '');
            const expectedOutput = String(testCase?.expectedOutput ?? '');

            if (!expectedOutput.trim()) {
              throw buildValidationError(
                `Section ${sectionIndex + 1}, question ${questionIndex + 1}, test case ${testCaseIndex + 1} is incomplete`
              );
            }

            return {
              input,
              expectedOutput,
              isHidden: Boolean(testCase?.isHidden),
            };
          }),
        };
      }),
    };
  });

  const totalQuestions = sections.reduce(
    (sum: number, section: any) => sum + section.questions.length,
    0
  );
  const totalPoints = sections.reduce(
    (sum: number, section: any) =>
      sum + section.questions.reduce(
        (questionSum: number, question: any) => questionSum + question.points,
        0
      ),
    0
  );

  return {
    title,
    description,
    subject,
    duration,
    startTime,
    endTime,
    sections,
    totalQuestions,
    totalPoints,
    isActive: payload?.isActive !== false,
    faceDetectionRequired: payload?.faceDetectionRequired !== false,
  };
}

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

function getVisibleTestCases(
  testCases: { input: string; expectedOutput: string; isHidden?: boolean }[] = []
) {
  return testCases.filter((testCase) => !testCase.isHidden);
}

function buildStudentSnapshot(user: any) {
  return {
    studentId: user?.studentId || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    department: user?.department || '',
  };
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

router.get('/teacher/:examId', requireTeacher, async (req: any, res) => {
  if (!isValidExamId(req.params.examId)) {
    return res.status(404).json({ message: 'Exam not found' });
  }

  const exam = await Exam.findOne({
    _id: req.params.examId,
    createdBy: req.user._id
  });

  if (!exam) {
    return res.status(404).json({ message: 'Exam not found' });
  }

  res.json({ exam });
});


/**
 * CREATE EXAM
 */
router.post('/teacher/create', requireTeacher, async (req: any, res) => {
  try {
    const examPayload = normalizeExamPayload(req.body);
    const exam = new Exam({ ...examPayload, createdBy: req.user._id });
    await exam.save();
    res.status(201).json({ exam });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to create exam'
    });
  }
});

/**
 * UPDATE EXAM
 */
router.put('/teacher/:examId', requireTeacher, async (req: any, res) => {
  try {
    if (!isValidExamId(req.params.examId)) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const examPayload = normalizeExamPayload(req.body);
    const exam = await Exam.findOneAndUpdate(
      { _id: req.params.examId, createdBy: req.user._id },
      examPayload,
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    res.json({ exam });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to update exam'
    });
  }
});

/**
 * DELETE EXAM
 */
router.delete('/teacher/:examId', requireTeacher, async (req: any, res) => {
  try {
    if (!isValidExamId(req.params.examId)) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const exam = await Exam.findOneAndDelete({
      _id: req.params.examId,
      createdBy: req.user._id
    });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    await ExamResult.deleteMany({ exam: exam._id });

    res.json({ message: 'Exam deleted successfully' });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || 'Failed to delete exam'
    });
  }
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
  const recentExpiryCutoff = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  const exams = await Exam.find({ isActive: true })
    .select('-sections.questions.correctAnswer -sections.questions.testCases')
    .sort({ startTime: 1 });

  const examIds = exams.map((exam) => exam._id);
  const examResults = await ExamResult.find({
    student: req.user._id,
    exam: { $in: examIds }
  }).select('exam isCompleted');
  const resultByExamId = new Map(
    examResults.map((result) => [String(result.exam), result])
  );

  const examsWithStatus = exams.map((exam) => {
    let status: 'upcoming' | 'live' | 'expired' = 'upcoming';

    if (now >= exam.startTime && now <= exam.endTime) status = 'live';
    if (now > exam.endTime) status = 'expired';

    const result = resultByExamId.get(String(exam._id));
    const isRecentlyExpired = exam.endTime >= recentExpiryCutoff;

    return {
      ...exam.toObject(),
      status,
      hasStarted: Boolean(result),
      isCompleted: Boolean(result?.isCompleted),
      isRecentlyExpired,
    };
  }).filter((exam) => exam.status !== 'expired' || exam.isRecentlyExpired);

  res.json({ exams: examsWithStatus });
});

/**
 * START EXAM
 */
router.post('/:examId/start', requireStudent, async (req: any, res) => {
  if (!validateStudentIdScope(req, res)) return;

  const exam = await Exam.findById(req.params.examId);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const now = new Date();
  if (!exam.isActive || now < exam.startTime || now > exam.endTime) {
    return res.status(403).json({ message: 'Exam is not available to start' });
  }

  const existingResult = await ExamResult.findOne({
    student: req.user._id,
    exam: exam._id
  });

  if (existingResult) {
    existingResult.studentSnapshot = buildStudentSnapshot(req.user);
    await existingResult.save();
    return res.json({
      examResultId: existingResult._id,
      isCompleted: existingResult.isCompleted
    });
  }

  const result = new ExamResult({
    student: req.user._id,
    studentSnapshot: buildStudentSnapshot(req.user),
    exam: exam._id,
    totalPoints: exam.totalPoints,
    startTime: new Date(),
    isCompleted: false
  });

  await result.save();
  res.json({ examResultId: result._id, isCompleted: false });
});

/**
 * COMPILE (RUN BUTTON)
 */
router.post('/:examId/compile', requireStudent, async (req, res) => {
  try {
    const { code, language, stdin, sectionIndex, questionIndex } = req.body;
    if (!code || !language) {
      return res.status(400).json({ message: 'Code & language required' });
    }

    if (Number.isInteger(sectionIndex) && Number.isInteger(questionIndex)) {
      const exam = await Exam.findById(req.params.examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      const question = exam.sections[sectionIndex]?.questions[questionIndex];
      if (!question || question.questionType !== 'coding') {
        return res.status(404).json({ message: 'Coding question not found' });
      }

      const visibleTestCases = getVisibleTestCases(question.testCases || []);
      if (visibleTestCases.length > 0) {
        const run = await runCodeAgainstTestCases(code, language, visibleTestCases);
        return res.json({
          result: {
            output: run.outputs
              .map(
                (output, index) =>
                  [
                    `Sample ${index + 1}: ${output.passed ? 'Passed' : 'Failed'}`,
                    `Expected: ${output.expectedOutput}`,
                    `Actual: ${output.output || '(empty)'}`,
                    output.stderr ? `Error: ${output.stderr}` : ''
                  ]
                    .filter(Boolean)
                    .join('\n')
              )
              .join('\n\n'),
            stderr: '',
            passedCount: run.passedCount,
            totalCount: run.totalCount,
            outputs: run.outputs,
          }
        });
      }
    }

    const result = await executeCode(code, language, stdin || '');
    res.json({ result });
  } catch (error: any) {
    console.error('Compile exam error:', error);
    res.status(500).json({ message: error.message || 'Failed to run code' });
  }
});

/**
 * SUBMIT EXAM
 */
router.post('/:examId/submit', requireStudent, async (req: any, res) => {
  try {
    if (!validateStudentIdScope(req, res)) return;
    if (!isValidExamId(req.params.examId)) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const {
      mcqAnswers = [],
      codingAnswers = [],
      timeTaken = 0,
      cheatingAttempts = []
    } = req.body;

    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const now = new Date();
    if (!exam.isActive) {
      return res.status(403).json({ message: 'Exam is not active' });
    }
    if (now < exam.startTime) {
      return res.status(403).json({ message: 'Exam has not started yet' });
    }
    if (now > exam.endTime) {
      return res.status(403).json({ message: 'Exam time is over' });
    }

    let examResult = await ExamResult.findOne({
      student: req.user._id,
      exam: exam._id
    });

    if (examResult?.isCompleted) {
      return res.status(409).json({ message: 'Exam has already been submitted' });
    }

    if (!examResult) {
      examResult = new ExamResult({
        student: req.user._id,
        exam: exam._id,
        totalPoints: exam.totalPoints,
        startTime: new Date(),
        isCompleted: false
      });
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

      mcqProcessed.push({
        ...ans,
        timeSpent: Number(ans.timeSpent || 0),
        isCorrect: correct,
        pointsEarned: points
      });
    }

    /* CODING */
    const codingProcessed: any[] = [];
    for (const ans of codingAnswers) {
      const q = exam.sections[ans.sectionIndex]?.questions[ans.questionIndex];
      if (!q || q.questionType !== 'coding') continue;

      const allTestCases = q.testCases || [];
      const run = await runCodeAgainstTestCases(ans.code, ans.language, allTestCases);
      const earned = Math.round((run.passedCount / Math.max(1, run.totalCount)) * q.points);
      score += earned;
      const visibleOutputs = run.outputs.filter((_, index) => !allTestCases[index]?.isHidden);
      const hiddenOutputs = run.outputs.filter((_, index) => Boolean(allTestCases[index]?.isHidden));
      const visiblePassedCount = visibleOutputs.filter((output) => output.passed).length;
      const hiddenPassedCount = hiddenOutputs.filter((output) => output.passed).length;

      codingProcessed.push({
        ...ans,
        timeSpent: Number(ans.timeSpent || 0),
        visiblePassedCount,
        visibleTotalCount: visibleOutputs.length,
        hiddenPassedCount,
        hiddenTotalCount: hiddenOutputs.length,
        averageExecutionTimeMs: run.averageExecutionTimeMs,
        maxMemoryKb: run.maxMemoryKb,
        passedCount: run.passedCount,
        totalCount: run.totalCount,
        outputPerTest: visibleOutputs,
        pointsEarned: earned
      });
    }

    const performanceMetrics = {
      codingAccuracy: codingProcessed.length
        ? Math.round(
            (
              codingProcessed.reduce(
                (sum, item) => sum + (item.passedCount / Math.max(1, item.totalCount)),
                0
              ) / codingProcessed.length
            ) * 100
          )
        : 0,
      visibleAccuracy: codingProcessed.length
        ? Math.round(
            (
              codingProcessed.reduce(
                (sum, item) => sum + (item.visiblePassedCount / Math.max(1, item.visibleTotalCount || 1)),
                0
              ) / codingProcessed.length
            ) * 100
          )
        : 0,
      hiddenAccuracy: codingProcessed.length
        ? Math.round(
            (
              codingProcessed.reduce(
                (sum, item) => sum + (item.hiddenPassedCount / Math.max(1, item.hiddenTotalCount || 1)),
                0
              ) / codingProcessed.length
            ) * 100
          )
        : 0,
      languagesUsed: [...new Set(codingProcessed.map((item) => item.language).filter(Boolean))],
      totalCodingQuestions: codingProcessed.length,
      averageExecutionTimeMs: codingProcessed.length
        ? Math.round(
            codingProcessed.reduce(
              (sum, item) => sum + Number(item.averageExecutionTimeMs || 0),
              0
            ) / codingProcessed.length
          )
        : undefined,
      peakMemoryKb: codingProcessed.reduce(
        (peak, item) => Math.max(peak, Number(item.maxMemoryKb || 0)),
        0
      ) || undefined,
      averageOptimalityScore: undefined as number | undefined,
    };

    const studentHistoryResults = await ExamResult.find({
      student: req.user._id,
      isCompleted: true,
      exam: { $ne: exam._id }
    })
      .populate('exam', 'subject')
      .sort({ endTime: -1, createdAt: -1 })
      .limit(10);

    const recommendation = await generateCodingRecommendation({
      studentId: String(req.user.studentId || req.user._id),
      examId: String(exam._id),
      examTitle: exam.title,
      subject: exam.subject,
      timeTaken: Number(timeTaken || 0),
      totalPoints: exam.totalPoints,
      score,
      percentage: Math.round((score / exam.totalPoints) * 100),
      studentHistory: studentHistoryResults
        .filter((result: any) => result.exam?.subject)
        .map((result: any) => ({
          subject: result.exam.subject,
          percentage: Number(result.percentage || 0),
          submittedAt: (result.endTime || result.createdAt)?.toISOString?.(),
        })),
      codingQuestions: codingProcessed.map((item) => ({
        sectionIndex: item.sectionIndex,
        questionIndex: item.questionIndex,
        language: item.language,
        code: item.code,
        passedCount: item.passedCount,
        totalCount: item.totalCount,
        visiblePassedCount: item.visiblePassedCount || 0,
        visibleTotalCount: item.visibleTotalCount || 0,
        hiddenPassedCount: item.hiddenPassedCount || 0,
        hiddenTotalCount: item.hiddenTotalCount || 0,
        pointsEarned: item.pointsEarned || 0,
        totalPoints: exam.sections[item.sectionIndex]?.questions[item.questionIndex]?.points || 0,
        averageExecutionTimeMs: item.averageExecutionTimeMs,
        maxMemoryKb: item.maxMemoryKb,
        optimalityScore: item.optimalityScore,
        errors: (item.outputPerTest || [])
          .map((output: any) => output?.stderr)
          .filter(Boolean)
      }))
    });

    examResult.mcqAnswers = mcqProcessed;
    examResult.codingAnswers = codingProcessed;
    examResult.score = score;
    examResult.percentage = Math.round((score / exam.totalPoints) * 100);
    examResult.studentSnapshot = buildStudentSnapshot(req.user);
    examResult.timeTaken = Number(timeTaken || 0);
    examResult.cheatingAttempts = Array.isArray(cheatingAttempts) ? cheatingAttempts : [];
    examResult.endTime = new Date();
    performanceMetrics.averageOptimalityScore = recommendation.runtimeMetrics?.optimalityScore;
    examResult.performanceMetrics = performanceMetrics;
    examResult.recommendationSummary = recommendation.summary;
    examResult.recommendationDetails = recommendation;
    examResult.isCompleted = true;

    await examResult.save();

    res.json({
      message: 'Exam submitted successfully',
      examResultId: examResult._id,
      score: examResult.score,
      percentage: examResult.percentage,
      examTitle: exam.title,
      totalPoints: exam.totalPoints,
      recommendation
    });
  } catch (error: any) {
    console.error('Submit exam error:', error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Exam has already been submitted' });
    }

    const message =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Failed to submit exam';

    res.status(500).json({ message });
  }
});

router.get('/:examId/result', requireStudent, async (req: any, res) => {
  const examResult = await ExamResult.findOne({
    exam: req.params.examId,
    student: req.user._id,
    isCompleted: true
  }).populate('exam');

  if (!examResult) {
    return res.status(404).json({ message: 'Exam result not found' });
  }

  const teacherRemarks = await TeacherRemark.find({
    student: req.user._id,
    $or: [
      { examResult: examResult._id },
      { exam: examResult.exam?._id || req.params.examId }
    ]
  })
    .populate('teacher', 'firstName lastName email')
    .sort({ createdAt: -1 });

  res.json({ examResult, teacherRemarks });
});

/**
 * GET EXAM FOR STUDENT (ONLY IF LIVE & NOT ATTEMPTED)
 */
router.get('/:examId', requireStudent, async (req: any, res) => {
  if (!validateStudentIdScope(req, res)) return;

  const exam = await Exam.findById(req.params.examId);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const now = new Date();
  if (!exam.isActive || now < exam.startTime || now > exam.endTime) {
    return res.status(403).json({ message: 'Exam not live' });
  }

  const attempted = await ExamResult.findOne({
    student: req.user._id,
    exam: exam._id
  });

  if (attempted?.isCompleted) {
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
              points: q.points,
              visibleTestCases: getVisibleTestCases(q.testCases || []).map((testCase) => ({
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
              })),
            }
      )
    }))
  };

  res.json({ exam: safeExam });
});

export default router;
