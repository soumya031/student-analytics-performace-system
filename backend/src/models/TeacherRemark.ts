import mongoose, { Document, Schema } from 'mongoose';

export interface ITeacherRemark extends Document {
  teacher: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  remark: string;
  createdAt: Date;
  updatedAt: Date;
}

const teacherRemarkSchema = new Schema<ITeacherRemark>({
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  remark: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: true });

teacherRemarkSchema.index({ student: 1, createdAt: -1 });
teacherRemarkSchema.index({ teacher: 1, createdAt: -1 });

export default mongoose.model<ITeacherRemark>('TeacherRemark', teacherRemarkSchema);
