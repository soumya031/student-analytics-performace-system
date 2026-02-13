import express from 'express';
import ExamResult from '../models/ExamResult';
import TeacherRemark from '../models/TeacherRemark';
import User from '../models/User';
import { requireStudent } from '../middleware/auth';

const router = express.Router();

const ALLOWED_ANALYTICS_ROLES = ['student', 'teacher', 'admin'];

const getTargetStudent = async (req: any) => {
  const { studentId } = req.params;

  if (!studentId) {
    if (req.user.role !== 'student') {
      return null;
    }
    return User.findOne({ _id: req.user._id, role: 'student' });
  }

  const student = await User.findOne({ studentId, role: 'student' });
  if (!student) {
    return null;
  }

  if (req.user.role === 'student' && String(student._id) !== String(req.user._id)) {
    return null;
  }

  if (!ALLOWED_ANALYTICS_ROLES.includes(req.user.role)) {
    return null;
  }

  return student;
};

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

// Get student's exam history by studentId (teacher/admin + self student)
router.get('/history/:studentId', async (req: any, res) => {
  try {
    const student = await getTargetStudent(req);
    if (!student) {
      return res.status(404).json({ message: 'Student not found or access denied' });
    }

    const examResults = await ExamResult.find({ student: student._id })
      .populate('exam', 'title subject startTime endTime')
      .sort({ createdAt: -1 });

    res.json({ studentId: student.studentId, examResults });
  } catch (error) {
    console.error('Fetch exam history by studentId error:', error);
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

// Get student's performance analytics by studentId (teacher/admin + self student)
router.get('/analytics/:studentId', async (req: any, res) => {
  try {
    const student = await getTargetStudent(req);
    if (!student) {
      return res.status(404).json({ message: 'Student not found or access denied' });
    }

    const examResults = await ExamResult.find({ student: student._id })
      .populate('exam', 'subject title');

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

    Object.keys(subjectPerformance).forEach(subject => {
      subjectPerformance[subject].averageScore =
        subjectPerformance[subject].totalScore / subjectPerformance[subject].totalExams;
    });

    const overallAverage = totalExams > 0 ? totalScore / totalExams : 0;

    res.json({
      studentId: student.studentId,
      subjectPerformance,
      overallStats: {
        totalExams,
        averageScore: overallAverage,
        totalScore
      }
    });
  } catch (error) {
    console.error('Fetch analytics by studentId error:', error);
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

// Teacher/admin can add remarks for a student by studentId
router.post('/remarks/:studentId', async (req: any, res) => {
  try {
    if (!['teacher', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const student = await User.findOne({ studentId: req.params.studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const remarkText = (req.body?.remark || '').trim();
    if (!remarkText) {
      return res.status(400).json({ message: 'Remark is required' });
    }

    const remark = new TeacherRemark({
      teacher: req.user._id,
      student: student._id,
      remark: remarkText
    });

    await remark.save();

    res.status(201).json({ message: 'Remark added successfully', remark });
  } catch (error) {
    console.error('Add teacher remark error:', error);
    res.status(500).json({ message: 'Failed to add remark' });
  }
});

// Get remarks by studentId (student self + teacher/admin)
router.get('/remarks/:studentId', async (req: any, res) => {
  try {
    const student = await User.findOne({ studentId: req.params.studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const isOwnerStudent = req.user.role === 'student' && String(student._id) === String(req.user._id);
    const isTeacherOrAdmin = ['teacher', 'admin'].includes(req.user.role);
    if (!isOwnerStudent && !isTeacherOrAdmin) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const remarks = await TeacherRemark.find({ student: student._id })
      .populate('teacher', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ studentId: student.studentId, remarks });
  } catch (error) {
    console.error('Get teacher remarks error:', error);
    res.status(500).json({ message: 'Failed to fetch remarks' });
  }
});

export default router; 
