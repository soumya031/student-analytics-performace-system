import mongoose, { Document, Schema } from 'mongoose';

export interface IMcqAnswer {
  sectionIndex: number;
  questionIndex: number;
  selectedAnswer?: number; 
  isCorrect: boolean;
  pointsEarned: number;
  timeSpent: number; 
}

export interface ICodingTestOutput {
  input: string;
  output: string;
  expectedOutput: string;
  passed: boolean;
}

export interface ICodingAnswer {
  sectionIndex: number;
  questionIndex: number;
  code: string;
  language: string;
  outputPerTest: ICodingTestOutput[];
  passedCount: number;
  totalCount: number;
  pointsEarned: number;
  timeSpent: number; 
}

export interface IExamResult extends Document {
  student: mongoose.Types.ObjectId;
  exam: mongoose.Types.ObjectId;
  mcqAnswers: IMcqAnswer[];
  codingAnswers: ICodingAnswer[];
  score: number;
  totalPoints: number;
  percentage: number;
  timeTaken: number; 
  startTime: Date;
  endTime?: Date;
  faceDetectionEvents: { timestamp: Date; confidence: number; present: boolean; }[];
  cheatingAttempts: { timestamp: Date; type: string; description: string; }[];
  isCompleted: boolean;
  isDisqualified: boolean;
  disqualificationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const mcqAnswerSchema = new Schema<IMcqAnswer>({
  sectionIndex: { type: Number, required: true, min: 0 },
  questionIndex: { type: Number, required: true, min: 0 },
  selectedAnswer: { type: Number, min: 0 },
  isCorrect: { type: Boolean, required: true },
  pointsEarned: { type: Number, required: true, min: 0 },
  timeSpent: { type: Number, required: true, min: 0 }
}, { _id: false });

const codingTestOutputSchema = new Schema<ICodingTestOutput>({
  input: { type: String, required: true },
  output: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  passed: { type: Boolean, required: true }
}, { _id: false });

const codingAnswerSchema = new Schema<ICodingAnswer>({
  sectionIndex: { type: Number, required: true, min: 0 },
  questionIndex: { type: Number, required: true, min: 0 },
  code: { type: String, required: true },
  language: { type: String, required: true },
  outputPerTest: [codingTestOutputSchema],
  passedCount: { type: Number, min: 0 },
  totalCount: { type: Number, min: 0 },
  pointsEarned: { type: Number, min: 0 },
  timeSpent: { type: Number, required: true, min: 0 }
}, { _id: false });

const examResultSchema = new Schema<IExamResult>({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  mcqAnswers: [mcqAnswerSchema],
  codingAnswers: [codingAnswerSchema],
  score: { type: Number, required: true, min: 0, default: 0 },
  totalPoints: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 0, max: 100, default: 0 },
  timeTaken: { type: Number, required: true, min: 0, default: 0 },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  faceDetectionEvents: [{ timestamp: { type: Date }, confidence: { type: Number }, present: { type: Boolean } }],
  cheatingAttempts: [{ timestamp: { type: Date }, type: { type: String }, description: { type: String } }],
  isCompleted: { type: Boolean, default: false },
  isDisqualified: { type: Boolean, default: false },
  disqualificationReason: { type: String }
}, { timestamps: true });


examResultSchema.index({ student: 1, exam: 1 }, { unique: true });
examResultSchema.index({ exam: 1, score: -1 });
examResultSchema.index({ student: 1, createdAt: -1 });

export default mongoose.model<IExamResult>('ExamResult', examResultSchema);
