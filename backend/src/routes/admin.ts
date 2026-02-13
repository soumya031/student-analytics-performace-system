import express from 'express';
import User from '../models/User';
import ExamResult from '../models/ExamResult';
import TeacherRemark from '../models/TeacherRemark';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

router.use(requireAdmin);

// Admin can view all teachers and students
router.get('/users', async (req, res) => {
  try {
    const role = req.query.role as string | undefined;
    const filter: any = { role: { $in: ['teacher', 'student'] } };

    if (role && ['teacher', 'student'].includes(role)) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Admin can view complete student/teacher profile details
router.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload: any = { user };

    if (user.role === 'student') {
      const examResults = await ExamResult.find({ student: user._id })
        .populate('exam', 'title subject startTime endTime')
        .sort({ createdAt: -1 });

      const remarks = await TeacherRemark.find({ student: user._id })
        .populate('teacher', 'firstName lastName email')
        .sort({ createdAt: -1 });

      payload.examResults = examResults;
      payload.remarks = remarks;
    }

    if (user.role === 'teacher') {
      const remarksGiven = await TeacherRemark.find({ teacher: user._id })
        .populate('student', 'firstName lastName studentId email')
        .sort({ createdAt: -1 });
      payload.remarksGiven = remarksGiven;
    }

    res.json(payload);
  } catch (error) {
    console.error('Admin user detail fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch user details' });
  }
});

export default router;
