import mongoose, { Document, Schema } from 'mongoose';

export type QuestionType = 'mcq' | 'coding';
export type SectionType = 'mcq' | 'coding' | 'other';

export interface ICodingTestCase {
  input: string;
  expectedOutput: string;
}

export interface IQuestion {
  questionType: QuestionType;
  question: string;
  
  options?: string[];         
  correctAnswer?: number;     
  explanation?: string;
  points: number;

  
  starterCode?: string;
  language?: string;       
  testCases?: ICodingTestCase[];
  timeLimitSeconds?: number;  
}

export interface ISection {
  sectionType: SectionType;
  title: string;
  instructions?: string;
  questions: IQuestion[];
  order: number;
  timeLimitMinutes?: number; 
}

export interface IExam extends Document {
  title: string;
  description: string;
  subject: 'aptitude' | 'dsa' | 'computer_science';
  duration: number; 
  sections: ISection[];
  totalQuestions: number;
  totalPoints: number;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  allowedDepartments?: string[];
  allowedYears?: number[];
  faceDetectionRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const codingTestCaseSchema = new Schema<ICodingTestCase>({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true }
}, { _id: false });

const questionSchema = new Schema<IQuestion>({
  questionType: { type: String, enum: ['mcq', 'coding'], required: true, default: 'mcq' },
  question: { type: String, required: true },
  options: [{ type: String }],      
  correctAnswer: { type: Number, min: 0 }, 
  explanation: { type: String },
  points: { type: Number, required: true, default: 1 },

  
  starterCode: { type: String },
  language: { type: String }, 
  testCases: [codingTestCaseSchema],
  timeLimitSeconds: { type: Number, min: 1 }
}, { _id: false });

const sectionSchema = new Schema<ISection>({
  sectionType: { type: String, enum: ['mcq', 'coding', 'other'], required: true },
  title: { type: String, required: true },
  instructions: { type: String },
  questions: [questionSchema],
  order: { type: Number, required: true, default: 0 },
  timeLimitMinutes: { type: Number, min: 1 }
}, { _id: false });

const examSchema = new Schema<IExam>({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  subject: { type: String, enum: ['aptitude', 'dsa', 'computer_science'], required: true },
  duration: { type: Number, required: true, min: 1 },
  sections: [sectionSchema],
  totalQuestions: { type: Number, required: true, min: 1 },
  totalPoints: { type: Number, required: true, min: 1 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  allowedDepartments: [{ type: String, enum: ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil'] }],
  allowedYears: [{ type: Number, min: 1, max: 4 }],
  faceDetectionRequired: { type: Boolean, default: true }
}, { timestamps: true });


examSchema.index({ 'sections.sectionType': 1, isActive: 1 });
examSchema.index({ startTime: 1, endTime: 1 });
examSchema.index({ createdBy: 1 });

export default mongoose.model<IExam>('Exam', examSchema);
