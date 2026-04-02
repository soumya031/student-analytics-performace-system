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
  stderr?: string;
  executionTimeMs?: number;
  memoryKb?: number;
}

export interface ICodingAnswer {
  sectionIndex: number;
  questionIndex: number;
  code: string;
  language: string;
  outputPerTest: ICodingTestOutput[];
  visiblePassedCount?: number;
  visibleTotalCount?: number;
  hiddenPassedCount?: number;
  hiddenTotalCount?: number;
  averageExecutionTimeMs?: number;
  maxMemoryKb?: number;
  optimalityScore?: number;
  passedCount: number;
  totalCount: number;
  pointsEarned: number;
  timeSpent: number; 
}

export interface IRecommendationItem {
  title: string;
  detail: string;
}

export interface IRecommendationDetails {
  strengths: IRecommendationItem[];
  weaknesses: IRecommendationItem[];
  recommendedTopics: string[];
  nextPracticeSuggestion: string;
  summary: string;
  modelInsights?: string[];
}

export interface IPerformanceMetrics {
  codingAccuracy: number;
  visibleAccuracy: number;
  hiddenAccuracy: number;
  languagesUsed: string[];
  totalCodingQuestions: number;
  averageExecutionTimeMs?: number;
  peakMemoryKb?: number;
  averageOptimalityScore?: number;
}

export interface IExamResult extends Document {
  student: mongoose.Types.ObjectId;
  studentSnapshot?: {
    studentId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    department?: string;
  };
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
  recommendationSummary?: string;
  recommendationDetails?: IRecommendationDetails;
  performanceMetrics?: IPerformanceMetrics;
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
  passed: { type: Boolean, required: true },
  stderr: { type: String }
  ,
  executionTimeMs: { type: Number, min: 0 },
  memoryKb: { type: Number, min: 0 }
}, { _id: false });

const codingAnswerSchema = new Schema<ICodingAnswer>({
  sectionIndex: { type: Number, required: true, min: 0 },
  questionIndex: { type: Number, required: true, min: 0 },
  code: { type: String, required: true },
  language: { type: String, required: true },
  outputPerTest: [codingTestOutputSchema],
  visiblePassedCount: { type: Number, min: 0, default: 0 },
  visibleTotalCount: { type: Number, min: 0, default: 0 },
  hiddenPassedCount: { type: Number, min: 0, default: 0 },
  hiddenTotalCount: { type: Number, min: 0, default: 0 },
  averageExecutionTimeMs: { type: Number, min: 0 },
  maxMemoryKb: { type: Number, min: 0 },
  optimalityScore: { type: Number, min: 0, max: 1 },
  passedCount: { type: Number, min: 0 },
  totalCount: { type: Number, min: 0 },
  pointsEarned: { type: Number, min: 0 },
  timeSpent: { type: Number, required: true, min: 0 }
}, { _id: false });

const recommendationItemSchema = new Schema<IRecommendationItem>({
  title: { type: String, required: true },
  detail: { type: String, required: true }
}, { _id: false });

const recommendationDetailsSchema = new Schema<IRecommendationDetails>({
  strengths: { type: [recommendationItemSchema], default: [] },
  weaknesses: { type: [recommendationItemSchema], default: [] },
  recommendedTopics: { type: [String], default: [] },
  nextPracticeSuggestion: { type: String, default: '' },
  summary: { type: String, default: '' },
  modelInsights: { type: [String], default: [] }
}, { _id: false });

const performanceMetricsSchema = new Schema<IPerformanceMetrics>({
  codingAccuracy: { type: Number, min: 0, max: 100, default: 0 },
  visibleAccuracy: { type: Number, min: 0, max: 100, default: 0 },
  hiddenAccuracy: { type: Number, min: 0, max: 100, default: 0 },
  languagesUsed: { type: [String], default: [] },
  totalCodingQuestions: { type: Number, min: 0, default: 0 },
  averageExecutionTimeMs: { type: Number, min: 0 },
  peakMemoryKb: { type: Number, min: 0 },
  averageOptimalityScore: { type: Number, min: 0, max: 1 }
}, { _id: false });

const studentSnapshotSchema = new Schema({
  studentId: { type: String, trim: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  email: { type: String, trim: true },
  department: { type: String, trim: true }
}, { _id: false });

const examResultSchema = new Schema<IExamResult>({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studentSnapshot: studentSnapshotSchema,
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
  recommendationSummary: { type: String, trim: true },
  recommendationDetails: recommendationDetailsSchema,
  performanceMetrics: performanceMetricsSchema,
  isCompleted: { type: Boolean, default: false },
  isDisqualified: { type: Boolean, default: false },
  disqualificationReason: { type: String }
}, { timestamps: true });


examResultSchema.index({ student: 1, exam: 1 }, { unique: true });
examResultSchema.index({ exam: 1, score: -1 });
examResultSchema.index({ student: 1, createdAt: -1 });
examResultSchema.index({ 'studentSnapshot.studentId': 1, createdAt: -1 });

export default mongoose.model<IExamResult>('ExamResult', examResultSchema);
