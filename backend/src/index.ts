import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { apiRateLimiter } from './middleware/rateLimit';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth';
import examRoutes from './routes/exam';
import studentRoutes from './routes/student';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());

// global rate limiter (can also be applied per-route)
app.use(apiRateLimiter);

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student_analytics')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle exam monitoring
  socket.on('join-exam', (examId: string) => {
    socket.join(`exam-${examId}`);
    console.log(`User ${socket.id} joined exam ${examId}`);
  });

  // Handle face detection events
  socket.on('face-detected', (data) => {
    socket.to(`exam-${data.examId}`).emit('student-present', {
      studentId: data.studentId,
      timestamp: new Date(),
      confidence: data.confidence
    });
  });

  // Handle exam submission
  socket.on('exam-submitted', (data) => {
    socket.to(`exam-${data.examId}`).emit('exam-completed', {
      studentId: data.studentId,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exam', authenticateToken, examRoutes);
app.use('/api/student', authenticateToken, studentRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

export { io }; 
