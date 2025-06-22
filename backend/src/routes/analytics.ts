import express from 'express';
import ExamResult from '../models/ExamResult';
import User from '../models/User';
import { requireStudent } from '../middleware/auth';

const router = express.Router();

// Get performance comparison with peers
router.get('/peer-comparison', requireStudent, async (req: any, res) => {
  try {
    const student = await User.findById(req.user._id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get all students in the same department and year
    const peers = await User.find({
      role: 'student',
      department: student.department,
      year: student.year,
      _id: { $ne: student._id }
    });

    const peerIds = peers.map(peer => peer._id);

    // Get exam results for peers
    const peerResults = await ExamResult.find({
      student: { $in: peerIds }
    }).populate('exam', 'subject title');

    // Get student's results
    const studentResults = await ExamResult.find({
      student: student._id
    }).populate('exam', 'subject title');

    // Calculate peer averages by subject
    const peerAverages: any = {};
    const peerCounts: any = {};

    peerResults.forEach((result: any) => {
      const subject = result.exam.subject;
      if (!peerAverages[subject]) {
        peerAverages[subject] = 0;
        peerCounts[subject] = 0;
      }
      peerAverages[subject] += result.percentage;
      peerCounts[subject]++;
    });

    Object.keys(peerAverages).forEach(subject => {
      peerAverages[subject] = peerAverages[subject] / peerCounts[subject];
    });

    // Calculate student averages
    const studentAverages: any = {};
    const studentCounts: any = {};

    studentResults.forEach((result: any) => {
      const subject = result.exam.subject;
      if (!studentAverages[subject]) {
        studentAverages[subject] = 0;
        studentCounts[subject] = 0;
      }
      studentAverages[subject] += result.percentage;
      studentCounts[subject]++;
    });

    Object.keys(studentAverages).forEach(subject => {
      studentAverages[subject] = studentAverages[subject] / studentCounts[subject];
    });

    res.json({
      studentAverages,
      peerAverages,
      comparison: Object.keys(studentAverages).map(subject => ({
        subject,
        studentAverage: studentAverages[subject],
        peerAverage: peerAverages[subject] || 0,
        difference: studentAverages[subject] - (peerAverages[subject] || 0)
      }))
    });
  } catch (error) {
    console.error('Peer comparison error:', error);
    res.status(500).json({ message: 'Failed to fetch peer comparison' });
  }
});

// Get improvement recommendations
router.get('/recommendations', requireStudent, async (req: any, res) => {
  try {
    const examResults = await ExamResult.find({ student: req.user._id })
      .populate('exam', 'subject title questions');

    if (examResults.length === 0) {
      return res.json({
        recommendations: [
          {
            type: 'general',
            title: 'Start Taking Exams',
            description: 'Begin taking exams to get personalized recommendations.',
            priority: 'high'
          }
        ]
      });
    }

    const recommendations = [];

    // Analyze weak subjects
    const subjectPerformance: any = {};
    examResults.forEach((result: any) => {
      const subject = result.exam.subject;
      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = [];
      }
      subjectPerformance[subject].push(result.percentage);
    });

    Object.keys(subjectPerformance).forEach(subject => {
      const average = subjectPerformance[subject].reduce((a: number, b: number) => a + b, 0) / subjectPerformance[subject].length;
      if (average < 70) {
        recommendations.push({
          type: 'subject',
          title: `Improve ${subject.replace('_', ' ')} Performance`,
          description: `Your average score in ${subject.replace('_', ' ')} is ${average.toFixed(1)}%. Focus on this subject to improve your overall performance.`,
          priority: 'high',
          subject
        });
      }
    });

    // Analyze time management
    const slowExams = examResults.filter((result: any) => {
      const exam = result.exam;
      const timeUtilization = (result.timeTaken / exam.duration) * 100;
      return timeUtilization > 90;
    });

    if (slowExams.length > 0) {
      recommendations.push({
        type: 'time',
        title: 'Improve Time Management',
        description: `You're running out of time in ${slowExams.length} exam(s). Practice time management skills.`,
        priority: 'medium'
      });
    }

    // Analyze cheating attempts
    const examsWithCheating = examResults.filter((result: any) => result.cheatingAttempts.length > 0);
    if (examsWithCheating.length > 0) {
      recommendations.push({
        type: 'behavior',
        title: 'Maintain Exam Integrity',
        description: 'Ensure you follow exam guidelines to avoid any issues.',
        priority: 'high'
      });
    }

    // Analyze recent performance trends
    const recentResults = examResults
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    if (recentResults.length >= 2) {
      const recentAverage = recentResults.reduce((sum: number, result: any) => sum + result.percentage, 0) / recentResults.length;
      const olderResults = examResults.slice(3, 6);
      
      if (olderResults.length >= 2) {
        const olderAverage = olderResults.reduce((sum: number, result: any) => sum + result.percentage, 0) / olderResults.length;
        
        if (recentAverage < olderAverage) {
          recommendations.push({
            type: 'trend',
            title: 'Performance Declining',
            description: 'Your recent performance has declined. Consider reviewing your study habits.',
            priority: 'high'
          });
        } else if (recentAverage > olderAverage + 10) {
          recommendations.push({
            type: 'trend',
            title: 'Great Improvement!',
            description: 'Your performance has improved significantly. Keep up the good work!',
            priority: 'low'
          });
        }
      }
    }

    res.json({ recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ message: 'Failed to fetch recommendations' });
  }
});

export default router; 