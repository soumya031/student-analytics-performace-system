import mongoose, { Document, Schema } from 'mongoose';

export interface IAnswer {
  questionIndex: number;
  selectedAnswer: number;
  isCorrect: boolean;
  timeSpent: number; // in seconds
}

export interface IExamResult extends Document {
  student: mongoose.Types.ObjectId;
  exam: mongoose.Types.ObjectId;
  answers: IAnswer[];
  score: number;
  totalPoints: number;
  percentage: number;
  timeTaken: number; // in minutes
  startTime: Date;
  endTime: Date;
  faceDetectionEvents: {
    timestamp: Date;
    confidence: number;
    present: boolean;
  }[];
  cheatingAttempts: {
    timestamp: Date;
    type: 'multiple_faces' | 'no_face' | 'face_away' | 'suspicious_activity';
    description: string;
  }[];
  isCompleted: boolean;
  isDisqualified: boolean;
  disqualificationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnswer>({
  questionIndex: {
    type: Number,
    required: true,
    min: 0
  },
  selectedAnswer: {
    type: Number,
    required: true,
    min: 0
  },
  isCorrect: {
    type: Boolean,
    required: true
  },
  timeSpent: {
    type: Number,
    required: true,
    min: 0
  }
});

const faceDetectionEventSchema = new Schema({
  timestamp: {
    type: Date,
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  present: {
    type: Boolean,
    required: true
  }
});

const cheatingAttemptSchema = new Schema({
  timestamp: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple_faces', 'no_face', 'face_away', 'suspicious_activity'],
    required: true
  },
  description: {
    type: String,
    required: true
  }
});

const examResultSchema = new Schema<IExamResult>({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  answers: [answerSchema],
  score: {
    type: Number,
    required: true,
    min: 0
  },
  totalPoints: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  timeTaken: {
    type: Number,
    required: true,
    min: 0
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  faceDetectionEvents: [faceDetectionEventSchema],
  cheatingAttempts: [cheatingAttemptSchema],
  isCompleted: {
    type: Boolean,
    default: false
  },
  isDisqualified: {
    type: Boolean,
    default: false
  },
  disqualificationReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
examResultSchema.index({ student: 1, exam: 1 }, { unique: true });
examResultSchema.index({ student: 1, createdAt: -1 });
examResultSchema.index({ exam: 1, score: -1 });
examResultSchema.index({ percentage: -1 });

export default mongoose.model<IExamResult>('ExamResult', examResultSchema); 