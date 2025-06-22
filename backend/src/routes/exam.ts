import express from 'express';
import Exam from '../models/Exam';
import ExamResult from '../models/ExamResult';
import { requireStudent, requireTeacher } from '../middleware/auth';

const router = express.Router();

// Get available exams for student
router.get('/available', requireStudent, async (req: any, res) => {
  try {
    const now = new Date();
    const exams = await Exam.find({
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now },
      $or: [
        { allowedDepartments: { $in: [req.user.department] } },
        { allowedDepartments: { $exists: false } }
      ],
      $or: [
        { allowedYears: { $in: [req.user.year] } },
        { allowedYears: { $exists: false } }
      ]
    }).select('-questions');

    res.json({ exams });
  } catch (error) {
    console.error('Fetch exams error:', error);
    res.status(500).json({ message: 'Failed to fetch exams' });
  }
});

// Get exam details (without answers for students)
router.get('/:examId', requireStudent, async (req: any, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if student can take this exam
    if (!exam.isActive) {
      return res.status(400).json({ message: 'Exam is not active' });
    }

    const now = new Date();
    if (now < exam.startTime || now > exam.endTime) {
      return res.status(400).json({ message: 'Exam is not available at this time' });
    }

    // Check if student has already taken this exam
    const existingResult = await ExamResult.findOne({
      student: req.user._id,
      exam: exam._id
    });

    if (existingResult) {
      return res.status(400).json({ message: 'You have already taken this exam' });
    }

    // Remove correct answers for students
    const examForStudent = {
      ...exam.toObject(),
      questions: exam.questions.map(q => ({
        question: q.question,
        options: q.options,
        points: q.points
      }))
    };

    res.json({ exam: examForStudent });
  } catch (error) {
    console.error('Fetch exam error:', error);
    res.status(500).json({ message: 'Failed to fetch exam' });
  }
});

// Start exam
router.post('/:examId/start', requireStudent, async (req: any, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if exam is available
    const now = new Date();
    if (now < exam.startTime || now > exam.endTime) {
      return res.status(400).json({ message: 'Exam is not available at this time' });
    }

    // Check if already started
    const existingResult = await ExamResult.findOne({
      student: req.user._id,
      exam: exam._id
    });

    if (existingResult) {
      return res.status(400).json({ message: 'You have already started this exam' });
    }

    // Create exam result
    const examResult = new ExamResult({
      student: req.user._id,
      exam: exam._id,
      answers: [],
      score: 0,
      totalPoints: exam.totalPoints,
      percentage: 0,
      timeTaken: 0,
      startTime: now,
      faceDetectionEvents: [],
      cheatingAttempts: [],
      isCompleted: false
    });

    await examResult.save();

    res.json({ 
      message: 'Exam started successfully',
      examResultId: examResult._id,
      startTime: now,
      duration: exam.duration
    });
  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({ message: 'Failed to start exam' });
  }
});

// Submit exam
router.post('/:examId/submit', requireStudent, async (req: any, res) => {
  try {
    const { answers, timeTaken, faceDetectionEvents, cheatingAttempts } = req.body;

    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const examResult = await ExamResult.findOne({
      student: req.user._id,
      exam: exam._id
    });

    if (!examResult) {
      return res.status(404).json({ message: 'Exam result not found' });
    }

    if (examResult.isCompleted) {
      return res.status(400).json({ message: 'Exam already completed' });
    }

    // Calculate score
    let score = 0;
    const processedAnswers = answers.map((answer: any, index: number) => {
      const question = exam.questions[index];
      const isCorrect = answer.selectedAnswer === question.correctAnswer;
      if (isCorrect) {
        score += question.points;
      }
      return {
        questionIndex: index,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        timeSpent: answer.timeSpent
      };
    });

    const percentage = (score / exam.totalPoints) * 100;

    // Update exam result
    examResult.answers = processedAnswers;
    examResult.score = score;
    examResult.percentage = percentage;
    examResult.timeTaken = timeTaken;
    examResult.endTime = new Date();
    examResult.faceDetectionEvents = faceDetectionEvents || [];
    examResult.cheatingAttempts = cheatingAttempts || [];
    examResult.isCompleted = true;

    await examResult.save();

    res.json({ 
      message: 'Exam submitted successfully',
      score,
      totalPoints: exam.totalPoints,
      percentage: Math.round(percentage * 100) / 100
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ message: 'Failed to submit exam' });
  }
});

// Get exam results for student
router.get('/:examId/result', requireStudent, async (req: any, res) => {
  try {
    const examResult = await ExamResult.findOne({
      student: req.user._id,
      exam: req.params.examId
    }).populate('exam');

    if (!examResult) {
      return res.status(404).json({ message: 'Exam result not found' });
    }

    res.json({ examResult });
  } catch (error) {
    console.error('Fetch exam result error:', error);
    res.status(500).json({ message: 'Failed to fetch exam result' });
  }
});

// Teacher routes
router.get('/teacher/all', requireTeacher, async (req: any, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ exams });
  } catch (error) {
    console.error('Fetch teacher exams error:', error);
    res.status(500).json({ message: 'Failed to fetch exams' });
  }
});

// Create new exam (teacher only)
router.post('/teacher/create', requireTeacher, async (req: any, res) => {
  try {
    const examData = {
      ...req.body,
      createdBy: req.user._id
    };

    const exam = new Exam(examData);
    await exam.save();

    res.status(201).json({ message: 'Exam created successfully', exam });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ message: 'Failed to create exam' });
  }
});

export default router; 