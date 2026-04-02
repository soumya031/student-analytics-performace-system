const HIDDEN_EXPIRED_EXAMS_KEY = 'hiddenExpiredExamIds';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const readHiddenExpiredExamIds = () => {
  try {
    const value = localStorage.getItem(HIDDEN_EXPIRED_EXAMS_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHiddenExpiredExamIds = (examIds) => {
  localStorage.setItem(HIDDEN_EXPIRED_EXAMS_KEY, JSON.stringify(examIds));
};

export const hideExpiredExam = (examId) => {
  const currentIds = readHiddenExpiredExamIds();
  if (!currentIds.includes(examId)) {
    writeHiddenExpiredExamIds([...currentIds, examId]);
  }
};

export const isExpiredExamVisible = (exam) => {
  if (exam?.status !== 'expired') return true;

  const hiddenIds = readHiddenExpiredExamIds();
  if (hiddenIds.includes(exam._id)) return false;

  const endTime = new Date(exam.endTime);
  if (Number.isNaN(endTime.getTime())) return false;

  return Date.now() - endTime.getTime() <= ONE_DAY_MS;
};

export const filterStudentVisibleExams = (exams = []) =>
  exams.filter((exam) => exam.status !== 'expired' || isExpiredExamVisible(exam));
