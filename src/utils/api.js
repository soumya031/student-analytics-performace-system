import axios from 'axios';

const BACKEND_API_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const backendApi = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 15000,
});

/* Attach JWT */
backendApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* Handle auth expiry */
backendApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/* -------------------- EXAM API -------------------- */
export const examAPI = {
  // Student + Teacher (status aware)
  getAllExamsWithStatus: () => backendApi.get('/exam/all-status'),

  // Student only
  getExam: (examId) => backendApi.get(`/exam/${examId}`),
  startExam: (examId) => backendApi.post(`/exam/${examId}/start`),
  submitExam: (examId, data) =>
    backendApi.post(`/exam/${examId}/submit`, data),

  // Teacher only
  getTeacherExams: () => backendApi.get('/exam/teacher/all'),
  createExam: (data) => backendApi.post('/exam/teacher/create', data),
  updateExam: (id, data) => backendApi.put(`/exam/teacher/${id}`, data),
  deleteExam: (id) => backendApi.delete(`/exam/teacher/${id}`),
};

/* -------------------- STUDENT API -------------------- */
export const studentAPI = {
  getExamHistory: () => backendApi.get('/student/history'),
  getAnalytics: () => backendApi.get('/student/analytics'),
};

/* -------------------- HELPERS -------------------- */
export const formatDate = (date) =>
  new Date(date).toLocaleString('en-IN');

export const getSubjectColor = (subject) => ({
  aptitude: '#2196F3',
  dsa: '#4CAF50',
  computer_science: '#FF9800',
}[subject] || '#757575');

export const getSubjectName = (subject) => ({
  aptitude: 'Aptitude',
  dsa: 'DSA',
  computer_science: 'Computer Science',
}[subject] || subject);

export const getGrade = (percentage) => {
  if (percentage >= 90) return { grade: 'A+', color: '#4CAF50' };
  if (percentage >= 80) return { grade: 'A', color: '#8BC34A' };
  if (percentage >= 70) return { grade: 'B', color: '#FFC107' };
  if (percentage >= 60) return { grade: 'C', color: '#FF9800' };
  return { grade: 'F', color: '#F44336' };
};
