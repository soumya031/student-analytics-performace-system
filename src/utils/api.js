import axios from 'axios';

const BACKEND_API_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const backendApi = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 30000,
});

const isAuthEndpoint = (url = '') => (
  url.includes('/auth/login')
  || url.includes('/auth/register')
  || url.includes('/auth/forgot-password')
);

const getRequestToken = (config) => {
  const authHeader = config?.headers?.Authorization || config?.headers?.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
};

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
  async (err) => {
    const requestMethod = (err.config?.method || '').toLowerCase();
    const requestStatus = err.response?.status;
    const shouldRetry =
      err.config
      && !err.config.__retry
      && requestMethod === 'get'
      && (
        !err.response
        || requestStatus === 429
        || requestStatus >= 500
        || err.code === 'ECONNABORTED'
      );

    if (shouldRetry) {
      err.config.__retry = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return backendApi(err.config);
    }

    const token = localStorage.getItem('token');
    const requestUrl = err.config?.url || '';
    const requestToken = getRequestToken(err.config);
    const shouldClearSession =
      err.response?.status === 401
      && token
      && requestToken
      && token === requestToken
      && !isAuthEndpoint(requestUrl);

    if (shouldClearSession) {
      localStorage.removeItem('token');
      localStorage.removeItem('latestSubmittedExamResult');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
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
  compileExam: (examId, data) => backendApi.post(`/exam/${examId}/compile`, data),
  submitExam: (examId, data) =>
    backendApi.post(`/exam/${examId}/submit`, data),
  getExamResult: (examId) => backendApi.get(`/exam/${examId}/result`),

  // Teacher only
  getTeacherExams: () => backendApi.get('/exam/teacher/all'),
  getTeacherExam: (id) => backendApi.get(`/exam/teacher/${id}`),
  createExam: (data) => backendApi.post('/exam/teacher/create', data),
  updateExam: (id, data) => backendApi.put(`/exam/teacher/${id}`, data),
  deleteExam: (id) => backendApi.delete(`/exam/teacher/${id}`),
};

/* -------------------- STUDENT API -------------------- */
export const studentAPI = {
  getExamHistory: () => backendApi.get('/student/history'),
  getAnalytics: () => backendApi.get('/student/analytics'),
  getExamHistoryByStudentId: (studentId) =>
    backendApi.get(`/student/history/${studentId}`),
  getAnalyticsByStudentId: (studentId) =>
    backendApi.get(`/student/analytics/${studentId}`),
  getRemarks: (studentId, params = {}) =>
    backendApi.get(`/student/remarks/${studentId}`, { params }),
  addRemark: (studentId, payload) =>
    backendApi.post(
      `/student/remarks/${studentId}`,
      typeof payload === 'string' ? { remark: payload } : payload
    ),
  getTeacherStudents: () => backendApi.get('/student/teacher/students'),
  getTeacherAnalyticsReference: () => backendApi.get('/student/teacher/analytics-reference'),
  getTeacherStudentReference: (studentId) =>
    backendApi.get(`/student/teacher/analytics-reference/${studentId}`),
};

export const adminAPI = {
  getUsers: (role) => backendApi.get('/admin/users', { params: role ? { role } : {} }),
  getUserDetails: (userId) => backendApi.get(`/admin/users/${userId}`),
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
