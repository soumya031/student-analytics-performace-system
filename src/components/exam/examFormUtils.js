export const toLocalDateTimeInputValue = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

export const toIsoDateTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export const buildExamPayload = (exam) => {
  const sections = (exam.sections || []).map((section, sectionIndex) => ({
    sectionType: section.sectionType,
    title: section.title?.trim() || (section.sectionType === 'mcq' ? 'MCQ Section' : 'Coding Section'),
    instructions: section.instructions?.trim() || '',
    order: Number(section.order || sectionIndex + 1),
    questions: (section.questions || []).map((question) => ({
      questionType: question.questionType,
      question: question.question?.trim() || '',
      options:
        question.questionType === 'mcq'
          ? (question.options || []).map((option) => option.trim())
          : undefined,
      correctAnswer:
        question.questionType === 'mcq'
          ? Number(question.correctAnswer || 0)
          : undefined,
      starterCode:
        question.questionType === 'coding'
          ? question.starterCode || ''
          : undefined,
      language:
        question.questionType === 'coding'
          ? question.language || 'python'
          : undefined,
      testCases:
        question.questionType === 'coding'
          ? (question.testCases || []).map((testCase) => ({
              input: testCase.input ?? '',
              expectedOutput: testCase.expectedOutput,
              isHidden: Boolean(testCase.isHidden),
            }))
          : undefined,
      points: Number(question.points || 0),
    })),
  }));

  const totalQuestions = sections.reduce(
    (sum, section) => sum + section.questions.length,
    0
  );

  const totalPoints = sections.reduce(
    (sum, section) =>
      sum +
      section.questions.reduce(
        (questionSum, question) => questionSum + Number(question.points || 0),
        0
      ),
    0
  );

  return {
    title: exam.title.trim(),
    description: exam.description.trim(),
    subject: exam.subject,
    duration: Number(exam.duration),
    startTime: toIsoDateTime(exam.startTime),
    endTime: toIsoDateTime(exam.endTime),
    sections,
    totalQuestions,
    totalPoints,
    isActive: true,
    faceDetectionRequired: true,
  };
};
