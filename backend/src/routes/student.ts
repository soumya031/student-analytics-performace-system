import express from 'express';
import mongoose from 'mongoose';
import ExamResult from '../models/ExamResult';
import TeacherRemark from '../models/TeacherRemark';
import User from '../models/User';
import { requireStudent, requireTeacher } from '../middleware/auth';

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
    const examResults = await ExamResult.find({
      student: req.user._id,
      isCompleted: true
    })
      .populate('exam', 'title subject startTime endTime')
      .sort({ endTime: -1, createdAt: -1 });

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

    const examResults = await ExamResult.find({
      student: student._id,
      isCompleted: true
    })
      .populate('exam', 'title subject startTime endTime')
      .sort({ endTime: -1, createdAt: -1 });

    res.json({ studentId: student.studentId, examResults });
  } catch (error) {
    console.error('Fetch exam history by studentId error:', error);
    res.status(500).json({ message: 'Failed to fetch exam history' });
  }
});

// Get student's performance analytics
router.get('/analytics', requireStudent, async (req: any, res) => {
  try {
    const examResults = await ExamResult.find({
      student: req.user._id,
      isCompleted: true
    })
      .populate('exam', 'subject title');

    const targetStudentId = new mongoose.Types.ObjectId(String(req.user._id));

    // Calculate performance by subject
    const subjectPerformance: any = {};
    let totalExams = 0;
    let totalScore = 0;
    let totalCodingQuestions = 0;
    let totalCodingPassed = 0;
    let totalCodingTests = 0;
    let totalVisiblePassed = 0;
    let totalVisibleTests = 0;
    let totalHiddenPassed = 0;
    let totalHiddenTests = 0;
    const languageMap: Record<string, { attempts: number; passed: number; total: number }> = {};
    const examTimeline: any[] = [];

    examResults.forEach((result: any) => {
      if (!result.exam) return;

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

      examTimeline.push({
        examTitle: result.exam.title,
        subject,
        percentage: result.percentage,
        score: result.score,
        totalPoints: result.totalPoints,
        submittedAt: result.endTime || result.createdAt
      });

      (result.codingAnswers || []).forEach((answer: any) => {
        totalCodingQuestions++;
        totalCodingPassed += Number(answer.passedCount || 0);
        totalCodingTests += Number(answer.totalCount || 0);
        totalVisiblePassed += Number(answer.visiblePassedCount || 0);
        totalVisibleTests += Number(answer.visibleTotalCount || 0);
        totalHiddenPassed += Number(answer.hiddenPassedCount || 0);
        totalHiddenTests += Number(answer.hiddenTotalCount || 0);

        const language = answer.language || 'unknown';
        if (!languageMap[language]) {
          languageMap[language] = { attempts: 0, passed: 0, total: 0 };
        }
        languageMap[language].attempts += 1;
        languageMap[language].passed += Number(answer.passedCount || 0);
        languageMap[language].total += Number(answer.totalCount || 0);
      });
    });

    // Calculate averages
    Object.keys(subjectPerformance).forEach(subject => {
      subjectPerformance[subject].averageScore = 
        subjectPerformance[subject].totalScore / subjectPerformance[subject].totalExams;
    });

    const overallAverage = totalExams > 0 ? totalScore / totalExams : 0;
    const classStats = await ExamResult.aggregate([
      { $match: { isCompleted: true } },
      {
        $group: {
          _id: '$student',
          averagePercentage: { $avg: '$percentage' }
        }
      }
    ]);
    const sortedAverages = classStats
      .map((item: any) => ({
        student: String(item._id),
        averagePercentage: Number(item.averagePercentage || 0)
      }))
      .sort((a, b) => b.averagePercentage - a.averagePercentage);
    const currentRankIndex = sortedAverages.findIndex((item) => item.student === String(targetStudentId));
    const classAverage = sortedAverages.length
      ? sortedAverages.reduce((sum, item) => sum + item.averagePercentage, 0) / sortedAverages.length
      : 0;
    const percentile = sortedAverages.length && currentRankIndex >= 0
      ? Math.round(((sortedAverages.length - currentRankIndex) / sortedAverages.length) * 100)
      : 0;

    const strengths = Object.entries(subjectPerformance)
      .sort(([, a]: any, [, b]: any) => b.averageScore - a.averageScore)
      .slice(0, 2)
      .map(([subject, data]: any) => ({
        subject,
        averageScore: Math.round(data.averageScore)
      }));

    const weaknesses = Object.entries(subjectPerformance)
      .sort(([, a]: any, [, b]: any) => a.averageScore - b.averageScore)
      .slice(0, 2)
      .map(([subject, data]: any) => ({
        subject,
        averageScore: Math.round(data.averageScore)
      }));

    const languagePerformance = Object.entries(languageMap).map(([language, stats]) => ({
      language,
      attempts: stats.attempts,
      accuracy: stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
    }));

    res.json({
      subjectPerformance,
      overallStats: {
        totalExams,
        averageScore: overallAverage,
        totalScore
      },
      examTimeline,
      codingStats: {
        totalCodingQuestions,
        codingAccuracy: totalCodingTests ? Math.round((totalCodingPassed / totalCodingTests) * 100) : 0,
        visibleAccuracy: totalVisibleTests ? Math.round((totalVisiblePassed / totalVisibleTests) * 100) : 0,
        hiddenAccuracy: totalHiddenTests ? Math.round((totalHiddenPassed / totalHiddenTests) * 100) : 0,
        languagePerformance
      },
      comparisonStats: {
        classAverage: Math.round(classAverage),
        studentAverage: Math.round(overallAverage),
        percentile,
        rank: currentRankIndex >= 0 ? currentRankIndex + 1 : null,
        totalStudents: sortedAverages.length
      },
      strengths,
      weaknesses
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

    const examResults = await ExamResult.find({
      student: student._id,
      isCompleted: true
    })
      .populate('exam', 'subject title');

    const subjectPerformance: any = {};
    let totalExams = 0;
    let totalScore = 0;
    let totalCodingQuestions = 0;
    let totalCodingPassed = 0;
    let totalCodingTests = 0;
    let totalVisiblePassed = 0;
    let totalVisibleTests = 0;
    let totalHiddenPassed = 0;
    let totalHiddenTests = 0;
    const languageMap: Record<string, { attempts: number; passed: number; total: number }> = {};
    const examTimeline: any[] = [];

    examResults.forEach((result: any) => {
      if (!result.exam) return;

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

      examTimeline.push({
        examTitle: result.exam.title,
        subject,
        percentage: result.percentage,
        score: result.score,
        totalPoints: result.totalPoints,
        submittedAt: result.endTime || result.createdAt
      });

      (result.codingAnswers || []).forEach((answer: any) => {
        totalCodingQuestions++;
        totalCodingPassed += Number(answer.passedCount || 0);
        totalCodingTests += Number(answer.totalCount || 0);
        totalVisiblePassed += Number(answer.visiblePassedCount || 0);
        totalVisibleTests += Number(answer.visibleTotalCount || 0);
        totalHiddenPassed += Number(answer.hiddenPassedCount || 0);
        totalHiddenTests += Number(answer.hiddenTotalCount || 0);

        const language = answer.language || 'unknown';
        if (!languageMap[language]) {
          languageMap[language] = { attempts: 0, passed: 0, total: 0 };
        }
        languageMap[language].attempts += 1;
        languageMap[language].passed += Number(answer.passedCount || 0);
        languageMap[language].total += Number(answer.totalCount || 0);
      });
    });

    Object.keys(subjectPerformance).forEach(subject => {
      subjectPerformance[subject].averageScore =
        subjectPerformance[subject].totalScore / subjectPerformance[subject].totalExams;
    });

    const overallAverage = totalExams > 0 ? totalScore / totalExams : 0;
    const classStats = await ExamResult.aggregate([
      { $match: { isCompleted: true } },
      {
        $group: {
          _id: '$student',
          averagePercentage: { $avg: '$percentage' }
        }
      }
    ]);
    const sortedAverages = classStats
      .map((item: any) => ({
        student: String(item._id),
        averagePercentage: Number(item.averagePercentage || 0)
      }))
      .sort((a, b) => b.averagePercentage - a.averagePercentage);
    const currentRankIndex = sortedAverages.findIndex((item) => item.student === String(student._id));
    const classAverage = sortedAverages.length
      ? sortedAverages.reduce((sum, item) => sum + item.averagePercentage, 0) / sortedAverages.length
      : 0;
    const percentile = sortedAverages.length && currentRankIndex >= 0
      ? Math.round(((sortedAverages.length - currentRankIndex) / sortedAverages.length) * 100)
      : 0;

    const strengths = Object.entries(subjectPerformance)
      .sort(([, a]: any, [, b]: any) => b.averageScore - a.averageScore)
      .slice(0, 2)
      .map(([subject, data]: any) => ({
        subject,
        averageScore: Math.round(data.averageScore)
      }));

    const weaknesses = Object.entries(subjectPerformance)
      .sort(([, a]: any, [, b]: any) => a.averageScore - b.averageScore)
      .slice(0, 2)
      .map(([subject, data]: any) => ({
        subject,
        averageScore: Math.round(data.averageScore)
      }));

    const languagePerformance = Object.entries(languageMap).map(([language, stats]) => ({
      language,
      attempts: stats.attempts,
      accuracy: stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
    }));

    res.json({
      studentId: student.studentId,
      subjectPerformance,
      overallStats: {
        totalExams,
        averageScore: overallAverage,
        totalScore
      },
      examTimeline,
      codingStats: {
        totalCodingQuestions,
        codingAccuracy: totalCodingTests ? Math.round((totalCodingPassed / totalCodingTests) * 100) : 0,
        visibleAccuracy: totalVisibleTests ? Math.round((totalVisiblePassed / totalVisibleTests) * 100) : 0,
        hiddenAccuracy: totalHiddenTests ? Math.round((totalHiddenPassed / totalHiddenTests) * 100) : 0,
        languagePerformance
      },
      comparisonStats: {
        classAverage: Math.round(classAverage),
        studentAverage: Math.round(overallAverage),
        percentile,
        rank: currentRankIndex >= 0 ? currentRankIndex + 1 : null,
        totalStudents: sortedAverages.length
      },
      strengths,
      weaknesses
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
    const examId = req.body?.examId;
    const examResultId = req.body?.examResultId;
    if (!remarkText) {
      return res.status(400).json({ message: 'Remark is required' });
    }

    let linkedExamId = undefined;
    let linkedExamResultId = undefined;

    if (examResultId) {
      const examResult = await ExamResult.findOne({
        _id: examResultId,
        student: student._id,
        isCompleted: true
      }).select('_id exam');

      if (!examResult) {
        return res.status(404).json({ message: 'Exam result not found for this student' });
      }

      linkedExamResultId = examResult._id;
      linkedExamId = examResult.exam;
    } else if (examId) {
      const matchingExamResult = await ExamResult.findOne({
        exam: examId,
        student: student._id,
        isCompleted: true
      }).select('_id exam');

      if (!matchingExamResult) {
        return res.status(404).json({ message: 'Exam result not found for this student' });
      }

      linkedExamResultId = matchingExamResult._id;
      linkedExamId = matchingExamResult.exam;
    }

    const remark = new TeacherRemark({
      teacher: req.user._id,
      student: student._id,
      exam: linkedExamId,
      examResult: linkedExamResultId,
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

    const filters: any = { student: student._id };
    if (req.query?.examResultId) {
      filters.examResult = req.query.examResultId;
    } else if (req.query?.examId) {
      filters.exam = req.query.examId;
    }

    const remarks = await TeacherRemark.find(filters)
      .populate('teacher', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ studentId: student.studentId, remarks });
  } catch (error) {
    console.error('Get teacher remarks error:', error);
    res.status(500).json({ message: 'Failed to fetch remarks' });
  }
});

router.get('/teacher/students', requireTeacher, async (_req: any, res) => {
  try {
    const students = await User.find({ role: 'student', isActive: true })
      .select('firstName lastName studentId department year semester email')
      .sort({ firstName: 1, lastName: 1 });

    res.json({ students });
  } catch (error) {
    console.error('Teacher students fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

router.get('/teacher/analytics-reference', requireTeacher, async (_req: any, res) => {
  try {
    const completedResults = await ExamResult.find({ isCompleted: true })
      .populate('exam', 'subject title');

    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalRemarks = await TeacherRemark.countDocuments({});
    const studentIds = [...new Set(completedResults.map((result: any) => String(result.student)))];
    const students = await User.find({ _id: { $in: studentIds } })
      .select('studentId firstName lastName');
    const studentLookup = new Map(
      students.map((student: any) => [
        String(student._id),
        {
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName
        }
      ])
    );

    const subjectSummary: Record<string, { attempts: number; totalScore: number; averageScore: number }> = {};
    const studentSummary: Record<string, {
      studentId?: string;
      firstName?: string;
      lastName?: string;
      attempts: number;
      averageScore: number;
      totalScore: number;
    }> = {};
    const languageUsage: Record<string, number> = {};
    let totalCodingPassed = 0;
    let totalCodingTests = 0;
    let totalVisiblePassed = 0;
    let totalVisibleTests = 0;
    let totalHiddenPassed = 0;
    let totalHiddenTests = 0;
    let studentsWithRecommendations = 0;
    let studentsWithRemarks = 0;
    const recommendationStudents = new Set<string>();

    for (const result of completedResults as any[]) {
      const exam = result.exam;
      if (!exam) continue;

      const subject = exam.subject;
      if (!subjectSummary[subject]) {
        subjectSummary[subject] = { attempts: 0, totalScore: 0, averageScore: 0 };
      }
      subjectSummary[subject].attempts += 1;
      subjectSummary[subject].totalScore += Number(result.percentage || 0);

      const studentId = String(result.student);
      if (!studentSummary[studentId]) {
        const student = studentLookup.get(studentId);
        studentSummary[studentId] = {
          studentId: student?.studentId,
          firstName: student?.firstName,
          lastName: student?.lastName,
          attempts: 0,
          averageScore: 0,
          totalScore: 0
        };
      }
      studentSummary[studentId].attempts += 1;
      studentSummary[studentId].totalScore += Number(result.percentage || 0);

      if (result.recommendationSummary) {
        recommendationStudents.add(studentId);
      }

      for (const answer of result.codingAnswers || []) {
        totalCodingPassed += Number(answer.passedCount || 0);
        totalCodingTests += Number(answer.totalCount || 0);
        totalVisiblePassed += Number(answer.visiblePassedCount || 0);
        totalVisibleTests += Number(answer.visibleTotalCount || 0);
        totalHiddenPassed += Number(answer.hiddenPassedCount || 0);
        totalHiddenTests += Number(answer.hiddenTotalCount || 0);

        const language = answer.language || 'unknown';
        languageUsage[language] = (languageUsage[language] || 0) + 1;
      }
    }

    const remarkedStudentIds = await TeacherRemark.distinct('student');
    studentsWithRemarks = remarkedStudentIds.length;
    studentsWithRecommendations = recommendationStudents.size;

    Object.values(subjectSummary).forEach((item) => {
      item.averageScore = item.attempts ? Math.round(item.totalScore / item.attempts) : 0;
    });

    Object.values(studentSummary).forEach((item) => {
      item.averageScore = item.attempts ? Math.round(item.totalScore / item.attempts) : 0;
    });

    const topStudents = Object.values(studentSummary)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);

    const needsAttention = Object.values(studentSummary)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5);

    const scoreDistribution = {
      excellent: Object.values(studentSummary).filter((item) => item.averageScore >= 85).length,
      good: Object.values(studentSummary).filter((item) => item.averageScore >= 70 && item.averageScore < 85).length,
      average: Object.values(studentSummary).filter((item) => item.averageScore >= 50 && item.averageScore < 70).length,
      needsSupport: Object.values(studentSummary).filter((item) => item.averageScore < 50).length,
    };

    const languageSummary = Object.entries(languageUsage)
      .map(([language, attempts]) => ({ language, attempts }))
      .sort((a, b) => b.attempts - a.attempts);

    res.json({
      overview: {
        totalStudents,
        totalCompletedExams: completedResults.length,
        totalRemarks,
        studentsWithRecommendations,
        studentsWithRemarks
      },
      subjectSummary,
      scoreDistribution,
      codingOverview: {
        codingAccuracy: totalCodingTests ? Math.round((totalCodingPassed / totalCodingTests) * 100) : 0,
        visibleAccuracy: totalVisibleTests ? Math.round((totalVisiblePassed / totalVisibleTests) * 100) : 0,
        hiddenAccuracy: totalHiddenTests ? Math.round((totalHiddenPassed / totalHiddenTests) * 100) : 0,
        languageSummary
      },
      topStudents,
      needsAttention
    });
  } catch (error) {
    console.error('Teacher analytics reference error:', error);
    res.status(500).json({ message: 'Failed to fetch teacher analytics reference' });
  }
});

router.get('/teacher/analytics-reference/:studentId', requireTeacher, async (req: any, res) => {
  try {
    const student = await User.findOne({
      studentId: req.params.studentId,
      role: 'student'
    }).select('-password');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const examResults = await ExamResult.find({
      student: student._id,
      isCompleted: true
    })
      .populate('exam', 'title subject startTime endTime')
      .sort({ endTime: -1, createdAt: -1 });

    const remarks = await TeacherRemark.find({ student: student._id })
      .populate('teacher', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const recommendationHistory = examResults
      .filter((result: any) => result.recommendationSummary)
      .map((result: any) => ({
        examId: result.exam?._id,
        examTitle: result.exam?.title,
        subject: result.exam?.subject,
        recommendationSummary: result.recommendationSummary,
        recommendationDetails: result.recommendationDetails,
        performanceMetrics: result.performanceMetrics,
        percentage: result.percentage,
        endTime: result.endTime || result.createdAt
      }));

    const totalCodingPassed = examResults.reduce(
      (sum: number, result: any) => sum + (result.codingAnswers || []).reduce(
        (answerSum: number, answer: any) => answerSum + Number(answer.passedCount || 0),
        0
      ),
      0
    );
    const totalCodingTests = examResults.reduce(
      (sum: number, result: any) => sum + (result.codingAnswers || []).reduce(
        (answerSum: number, answer: any) => answerSum + Number(answer.totalCount || 0),
        0
      ),
      0
    );
    const subjectPerformance = examResults.reduce((acc: Record<string, { attempts: number; totalScore: number; averageScore: number }>, result: any) => {
      const subject = result.exam?.subject;
      if (!subject) {
        return acc;
      }

      if (!acc[subject]) {
        acc[subject] = { attempts: 0, totalScore: 0, averageScore: 0 };
      }

      acc[subject].attempts += 1;
      acc[subject].totalScore += Number(result.percentage || 0);
      acc[subject].averageScore = Math.round(acc[subject].totalScore / acc[subject].attempts);
      return acc;
    }, {});

    res.json({
      student,
      examResults,
      remarks,
      recommendationHistory,
      analyticsSnapshot: {
        totalExams: examResults.length,
        averageScore: examResults.length
          ? Math.round(
              examResults.reduce((sum: number, result: any) => sum + Number(result.percentage || 0), 0)
              / examResults.length
            )
          : 0,
        codingAccuracy: totalCodingTests ? Math.round((totalCodingPassed / totalCodingTests) * 100) : 0,
        subjectPerformance,
        latestRecommendation: recommendationHistory[0] || null
      }
    });
  } catch (error) {
    console.error('Teacher student analytics reference error:', error);
    res.status(500).json({ message: 'Failed to fetch student analytics reference' });
  }
});

export default router; 
