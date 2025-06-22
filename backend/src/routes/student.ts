import express from 'express';
import ExamResult from '../models/ExamResult';
import { requireStudent } from '../middleware/auth';

const router = express.Router();

// Get student's exam history
router.get('/history', requireStudent, async (req: any, res) => {
  try {
    const examResults = await ExamResult.find({ student: req.user._id })
      .populate('exam', 'title subject startTime endTime')
      .sort({ createdAt: -1 });

    res.json({ examResults });
  } catch (error) {
    console.error('Fetch exam history error:', error);
    res.status(500).json({ message: 'Failed to fetch exam history' });
  }
});

// Get student's performance analytics
router.get('/analytics', requireStudent, async (req: any, res) => {
  try {
    const examResults = await ExamResult.find({ student: req.user._id })
      .populate('exam', 'subject title');

    // Calculate performance by subject
    const subjectPerformance: any = {};
    let totalExams = 0;
    let totalScore = 0;

    examResults.forEach((result: any) => {
      const subject = result.exam.subject;
      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = {
          totalExams: 0,
          totalScore: 0,
          averageScore: 0,
          bestScore: 0,
          worstScore: 100
        };
      }

      subjectPerformance[subject].totalExams++;
      subjectPerformance[subject].totalScore += result.percentage;
      subjectPerformance[subject].bestScore = Math.max(subjectPerformance[subject].bestScore, result.percentage);
      subjectPerformance[subject].worstScore = Math.min(subjectPerformance[subject].worstScore, result.percentage);

      totalExams++;
      totalScore += result.percentage;
    });

    // Calculate averages
    Object.keys(subjectPerformance).forEach(subject => {
      subjectPerformance[subject].averageScore = 
        subjectPerformance[subject].totalScore / subjectPerformance[subject].totalExams;
    });

    const overallAverage = totalExams > 0 ? totalScore / totalExams : 0;

    res.json({
      subjectPerformance,
      overallStats: {
        totalExams,
        averageScore: overallAverage,
        totalScore
      }
    });
  } catch (error) {
    console.error('Fetch analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

// Get detailed exam result
router.get('/exam/:examResultId', requireStudent, async (req: any, res) => {
  try {
    const examResult = await ExamResult.findOne({
      _id: req.params.examResultId,
      student: req.user._id
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

export default router; 