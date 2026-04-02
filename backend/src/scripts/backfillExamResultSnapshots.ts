import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ExamResult from '../models/ExamResult';
import User from '../models/User';

dotenv.config({ path: 'config.env' });

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in backend/config.env');
  }

  await mongoose.connect(mongoUri);

  const results = await ExamResult.find({
    $or: [
      { studentSnapshot: { $exists: false } },
      { 'studentSnapshot.studentId': { $in: [null, ''] } }
    ]
  }).select('_id student studentSnapshot');

  let updated = 0;

  for (const result of results) {
    const user = await User.findById(result.student)
      .select('studentId firstName lastName email department');

    if (!user) {
      continue;
    }

    result.studentSnapshot = {
      studentId: user.studentId || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      department: user.department || '',
    };

    await result.save();
    updated += 1;
  }

  console.log(`Backfill complete. Updated ${updated} exam result documents.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Backfill failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
