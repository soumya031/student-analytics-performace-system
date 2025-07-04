import axios from 'axios';

// Backend API base URL
const BACKEND_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Python service API base URL
const PYTHON_API_URL = process.env.REACT_APP_PYTHON_API_URL || 'http://localhost:5001';

// Create axios instances
const backendApi = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 10000,
});

const pythonApi = axios.create({
  baseURL: PYTHON_API_URL,
  timeout: 15000,
});

// Add auth token to backend requests
backendApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
backendApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Backend API functions
export const examAPI = {
  // Get available exams
  getAvailableExams: () => backendApi.get('/exam/available'),
  
  // Get exam details
  getExam: (examId) => backendApi.get(`/exam/${examId}`),
  
  // Start exam
  startExam: (examId) => backendApi.post(`/exam/${examId}/start`),
  
  // Submit exam
  submitExam: (examId, data) => backendApi.post(`/exam/${examId}/submit`, data),
  
  // Get exam result
  getExamResult: (examId) => backendApi.get(`/exam/${examId}/result`),
  
  // Get teacher's exams
  getTeacherExams: () => backendApi.get('/exam/teacher/all'),
  
  // Create new exam
  createExam: (examData) => backendApi.post('/exam/teacher/create', examData),
};

export const studentAPI = {
  // Get exam history
  getExamHistory: () => backendApi.get('/student/history'),
  
  // Get student analytics
  getAnalytics: () => backendApi.get('/student/analytics'),
  
  // Get detailed exam result
  getDetailedResult: (examResultId) => backendApi.get(`/student/exam/${examResultId}`),
};

export const analyticsAPI = {
  // Get peer comparison
  getPeerComparison: () => backendApi.get('/analytics/peer-comparison'),
  
  // Get recommendations
  getRecommendations: () => backendApi.get('/analytics/recommendations'),
};

// Python service API functions
export const pythonAPI = {
  // Health check
  healthCheck: () => pythonApi.get('/health'),
  
  // Get recommendations
  getRecommendations: (userId) => pythonApi.get(`/recommendations/${userId}`),
  
  // Face detection
  detectFaces: (imageBase64) => pythonApi.post('/face-detection/detect', { image: imageBase64 }),
  
  // Verify identity
  verifyIdentity: (imageBase64, studentId) => 
    pythonApi.post('/face-detection/verify', { image: imageBase64, student_id: studentId }),
  
  // Register face
  registerFace: (imageBase64, studentId) => 
    pythonApi.post('/face-detection/register', { image: imageBase64, student_id: studentId }),
  
  // Get performance trends
  getPerformanceTrends: () => pythonApi.get('/analytics/performance-trends'),
};

// Utility functions
export const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getSubjectColor = (subject) => {
  const colors = {
    aptitude: '#2196F3',
    dsa: '#4CAF50',
    computer_science: '#FF9800',
  };
  return colors[subject] || '#757575';
};

export const getSubjectName = (subject) => {
  const names = {
    aptitude: 'Aptitude',
    dsa: 'Data Structures & Algorithms',
    computer_science: 'Computer Science',
  };
  return names[subject] || subject;
};

export const calculatePercentage = (score, total) => {
  return total > 0 ? Math.round((score / total) * 100) : 0;
};

export const getGrade = (percentage) => {
  if (percentage >= 90) return { grade: 'A+', color: '#4CAF50' };
  if (percentage >= 80) return { grade: 'A', color: '#4CAF50' };
  if (percentage >= 70) return { grade: 'B', color: '#8BC34A' };
  if (percentage >= 60) return { grade: 'C', color: '#FFC107' };
  if (percentage >= 50) return { grade: 'D', color: '#FF9800' };
  return { grade: 'F', color: '#F44336' };
}; 