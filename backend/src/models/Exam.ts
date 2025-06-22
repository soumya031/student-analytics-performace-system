import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  points: number;
}

export interface IExam extends Document {
  title: string;
  description: string;
  subject: 'aptitude' | 'dsa' | 'computer_science';
  duration: number; // in minutes
  totalQuestions: number;
  totalPoints: number;
  questions: IQuestion[];
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

const questionSchema = new Schema<IQuestion>({
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: true
  }],
  correctAnswer: {
    type: Number,
    required: true,
    min: 0
  },
  explanation: {
    type: String
  },
  points: {
    type: Number,
    required: true,
    default: 1
  }
});

const examSchema = new Schema<IExam>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    enum: ['aptitude', 'dsa', 'computer_science'],
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 1
  },
  totalPoints: {
    type: Number,
    required: true,
    min: 1
  },
  questions: [questionSchema],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  allowedDepartments: [{
    type: String,
    enum: ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil']
  }],
  allowedYears: [{
    type: Number,
    min: 1,
    max: 4
  }],
  faceDetectionRequired: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
examSchema.index({ subject: 1, isActive: 1 });
examSchema.index({ startTime: 1, endTime: 1 });
examSchema.index({ createdBy: 1 });

export default mongoose.model<IExam>('Exam', examSchema); 