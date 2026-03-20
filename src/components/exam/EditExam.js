import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Divider,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { examAPI } from '../../utils/api';

const emptyMCQ = () => ({
  questionType: 'mcq',
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  points: 1,
});

const emptyCoding = () => ({
  questionType: 'coding',
  question: '',
  starterCode: '',
  language: 'python',
  points: 5,
  testCases: [{ input: '', expectedOutput: '' }],
});

const syncSectionQuestions = (existingQuestions = [], count, createQuestion) =>
  Array.from(
    { length: count },
    (_, index) => existingQuestions[index] || createQuestion()
  );

const buildSectionsFromCounts = (existingSections, mcqCount, codingCount) => {
  const nextSections = [];
  const existingMcqSection = existingSections.find(
    (section) => section.sectionType === 'mcq'
  );
  const existingCodingSection = existingSections.find(
    (section) => section.sectionType === 'coding'
  );

  if (mcqCount > 0) {
    nextSections.push({
      sectionType: 'mcq',
      title: 'MCQ Section',
      instructions: 'Choose the correct option',
      order: 1,
      questions: syncSectionQuestions(
        existingMcqSection?.questions,
        mcqCount,
        emptyMCQ
      ),
    });
  }

  if (codingCount > 0) {
    nextSections.push({
      sectionType: 'coding',
      title: 'Coding Section',
      instructions: 'Write correct code for all test cases',
      order: nextSections.length + 1,
      questions: syncSectionQuestions(
        existingCodingSection?.questions,
        codingCount,
        emptyCoding
      ),
    });
  }

  return nextSections;
};

const validateSections = (sections) => {
  for (const section of sections) {
    for (let qIdx = 0; qIdx < section.questions.length; qIdx += 1) {
      const question = section.questions[qIdx];
      const questionNumber = qIdx + 1;

      if (!question.question.trim()) {
        return `${section.title}: Question ${questionNumber} cannot be empty`;
      }

      if (!Number(question.points) || Number(question.points) < 1) {
        return `${section.title}: Question ${questionNumber} must have at least 1 point`;
      }

      if (question.questionType === 'mcq') {
        if (question.options.some((option) => !option.trim())) {
          return `${section.title}: All options are required for question ${questionNumber}`;
        }
      }

      if (question.questionType === 'coding') {
        if (!question.language?.trim()) {
          return `${section.title}: Question ${questionNumber} needs a language`;
        }

        if (!question.testCases?.length) {
          return `${section.title}: Question ${questionNumber} needs at least one test case`;
        }

        if (
          question.testCases.some(
            (testCase) =>
              !testCase.input.trim() || !testCase.expectedOutput.trim()
          )
        ) {
          return `${section.title}: Complete every test case for question ${questionNumber}`;
        }
      }
    }
  }

  return '';
};

const normalizeExamForEditing = (rawExam) => {
  const sections = rawExam.sections || [];
  const mcqSection = sections.find((section) => section.sectionType === 'mcq');
  const codingSection = sections.find(
    (section) => section.sectionType === 'coding'
  );

  return {
    ...rawExam,
    startTime: rawExam.startTime ? rawExam.startTime.slice(0, 16) : '',
    endTime: rawExam.endTime ? rawExam.endTime.slice(0, 16) : '',
    sections: buildSectionsFromCounts(
      sections.map((section) => ({
        ...section,
        questions: (section.questions || []).map((question) => ({
          ...question,
          options:
            question.questionType === 'mcq'
              ? question.options || ['', '', '', '']
              : question.options,
          testCases:
            question.questionType === 'coding'
              ? question.testCases?.length
                ? question.testCases
                : [{ input: '', expectedOutput: '' }]
              : question.testCases,
          language:
            question.questionType === 'coding'
              ? question.language || 'python'
              : question.language,
          points: Number(question.points || 1),
          correctAnswer: Number(question.correctAnswer || 0),
        })),
      })),
      mcqSection?.questions?.length || 0,
      codingSection?.questions?.length || 0
    ),
  };
};

const EditExam = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mcqCount, setMcqCount] = useState(0);
  const [codingCount, setCodingCount] = useState(0);

  useEffect(() => {
    loadExam();
  }, []);

  const loadExam = async () => {
    try {
      if (!examId) {
        setError('Invalid exam id');
        return;
      }

      let examData;

      try {
        const res = await examAPI.getTeacherExam(examId);
        examData = res.data.exam;
      } catch (err) {
        if (err.response?.status !== 404) {
          throw err;
        }

        const res = await examAPI.getTeacherExams();
        examData = res.data.exams.find((item) => item._id === examId);

        if (!examData) {
          setError('Exam not found');
          return;
        }
      }

      const normalizedExam = normalizeExamForEditing(examData);
      setExam(normalizedExam);
      setMcqCount(
        normalizedExam.sections.find((section) => section.sectionType === 'mcq')
          ?.questions.length || 0
      );
      setCodingCount(
        normalizedExam.sections.find(
          (section) => section.sectionType === 'coding'
        )?.questions.length || 0
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load exam');
    } finally {
      setLoading(false);
    }
  };

  const updateSections = (updater) => {
    setExam((prevExam) => ({
      ...prevExam,
      sections:
        typeof updater === 'function' ? updater(prevExam.sections) : updater,
    }));
  };

  const handleQuestionCountChange = (type, value) => {
    const parsedValue = Math.max(0, Number(value) || 0);
    const nextMcqCount = type === 'mcq' ? parsedValue : mcqCount;
    const nextCodingCount = type === 'coding' ? parsedValue : codingCount;

    if (type === 'mcq') {
      setMcqCount(parsedValue);
    } else {
      setCodingCount(parsedValue);
    }

    setExam((prevExam) => ({
      ...prevExam,
      sections: buildSectionsFromCounts(
        prevExam.sections,
        nextMcqCount,
        nextCodingCount
      ),
    }));
  };

  const updateQuestion = (sIdx, qIdx, field, value) => {
    updateSections((prevSections) =>
      prevSections.map((section, sectionIndex) =>
        sectionIndex !== sIdx
          ? section
          : {
              ...section,
              questions: section.questions.map((question, questionIndex) =>
                questionIndex !== qIdx
                  ? question
                  : { ...question, [field]: value }
              ),
            }
      )
    );
  };

  const updateOption = (sIdx, qIdx, oIdx, value) => {
    updateSections((prevSections) =>
      prevSections.map((section, sectionIndex) =>
        sectionIndex !== sIdx
          ? section
          : {
              ...section,
              questions: section.questions.map((question, questionIndex) =>
                questionIndex !== qIdx
                  ? question
                  : {
                      ...question,
                      options: question.options.map((option, optionIndex) =>
                        optionIndex === oIdx ? value : option
                      ),
                    }
              ),
            }
      )
    );
  };

  const updateTestCase = (sIdx, qIdx, tIdx, field, value) => {
    updateSections((prevSections) =>
      prevSections.map((section, sectionIndex) =>
        sectionIndex !== sIdx
          ? section
          : {
              ...section,
              questions: section.questions.map((question, questionIndex) =>
                questionIndex !== qIdx
                  ? question
                  : {
                      ...question,
                      testCases: question.testCases.map((testCase, testCaseIndex) =>
                        testCaseIndex !== tIdx
                          ? testCase
                          : { ...testCase, [field]: value }
                      ),
                    }
              ),
            }
      )
    );
  };

  const addTestCase = (sIdx, qIdx) => {
    updateSections((prevSections) =>
      prevSections.map((section, sectionIndex) =>
        sectionIndex !== sIdx
          ? section
          : {
              ...section,
              questions: section.questions.map((question, questionIndex) =>
                questionIndex !== qIdx
                  ? question
                  : {
                      ...question,
                      testCases: [
                        ...(question.testCases || []),
                        { input: '', expectedOutput: '' },
                      ],
                    }
              ),
            }
      )
    );
  };

  const handleSave = async () => {
    try {
      setError('');

      if (!exam.title.trim() || !exam.description.trim()) {
        return setError('Title and description are required');
      }

      if (!exam.startTime || !exam.endTime) {
        return setError('Start time and end time are required');
      }

      if (!Number(exam.duration) || Number(exam.duration) < 1) {
        return setError('Duration must be at least 1 minute');
      }

      const start = new Date(exam.startTime);
      const end = new Date(exam.endTime);

      if (end <= start) {
        return setError('End time must be after start time');
      }

      if (!exam.sections.length) {
        return setError('Add at least one MCQ or Coding question');
      }

      const validationError = validateSections(exam.sections);
      if (validationError) {
        return setError(validationError);
      }

      const totalQuestions = exam.sections.reduce(
        (sum, section) => sum + section.questions.length,
        0
      );

      const totalPoints = exam.sections.reduce(
        (sum, section) =>
          sum +
          section.questions.reduce(
            (questionSum, question) => questionSum + Number(question.points || 0),
            0
          ),
        0
      );

      await examAPI.updateExam(examId, {
        title: exam.title,
        description: exam.description,
        subject: exam.subject,
        duration: Number(exam.duration),
        startTime: exam.startTime,
        endTime: exam.endTime,
        sections: exam.sections,
        totalQuestions,
        totalPoints,
      });

      navigate('/dashboard');
    } catch {
      setError('Failed to update exam');
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!exam) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Edit Exam
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Title"
            sx={{ mb: 2 }}
            value={exam.title}
            onChange={(e) => setExam({ ...exam, title: e.target.value })}
          />

          <TextField
            fullWidth
            label="Description"
            sx={{ mb: 2 }}
            value={exam.description}
            onChange={(e) =>
              setExam({ ...exam, description: e.target.value })
            }
          />

          <TextField
            select
            label="Subject"
            sx={{ mb: 2 }}
            value={exam.subject}
            onChange={(e) => setExam({ ...exam, subject: e.target.value })}
          >
            <MenuItem value="aptitude">Aptitude</MenuItem>
            <MenuItem value="dsa">DSA</MenuItem>
            <MenuItem value="computer_science">Computer Science</MenuItem>
          </TextField>

          <TextField
            fullWidth
            type="number"
            label="Duration (minutes)"
            sx={{ mb: 2 }}
            value={exam.duration}
            onChange={(e) =>
              setExam({ ...exam, duration: Number(e.target.value) })
            }
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Start Time"
                InputLabelProps={{ shrink: true }}
                value={exam.startTime}
                onChange={(e) =>
                  setExam({ ...exam, startTime: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="End Time"
                InputLabelProps={{ shrink: true }}
                value={exam.endTime}
                onChange={(e) =>
                  setExam({ ...exam, endTime: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">Question Configuration</Typography>

          <TextField
            type="number"
            label="Number of MCQ Questions"
            sx={{ mt: 2, mr: 2 }}
            value={mcqCount}
            onChange={(e) => handleQuestionCountChange('mcq', e.target.value)}
          />

          <TextField
            type="number"
            label="Number of Coding Questions"
            sx={{ mt: 2 }}
            value={codingCount}
            onChange={(e) =>
              handleQuestionCountChange('coding', e.target.value)
            }
          />
        </CardContent>
      </Card>

      {exam.sections.map((section, sIdx) => (
        <Card key={`${section.sectionType}-${sIdx}`} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6">{section.title}</Typography>

            {section.questions.map((question, qIdx) => (
              <Box key={qIdx} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label={`Question ${qIdx + 1}`}
                  value={question.question}
                  onChange={(e) =>
                    updateQuestion(sIdx, qIdx, 'question', e.target.value)
                  }
                />

                {question.questionType === 'mcq' && (
                  <>
                    {question.options.map((option, oIdx) => (
                      <TextField
                        key={oIdx}
                        fullWidth
                        sx={{ mt: 1 }}
                        label={`Option ${oIdx + 1}`}
                        value={option}
                        onChange={(e) =>
                          updateOption(sIdx, qIdx, oIdx, e.target.value)
                        }
                      />
                    ))}

                    <TextField
                      select
                      fullWidth
                      sx={{ mt: 1 }}
                      label="Correct Answer"
                      value={question.correctAnswer}
                      onChange={(e) =>
                        updateQuestion(
                          sIdx,
                          qIdx,
                          'correctAnswer',
                          Number(e.target.value)
                        )
                      }
                    >
                      {question.options.map((_, oIdx) => (
                        <MenuItem key={oIdx} value={oIdx}>
                          Option {oIdx + 1}
                        </MenuItem>
                      ))}
                    </TextField>
                  </>
                )}

                <TextField
                  fullWidth
                  type="number"
                  label="Points"
                  sx={{ mt: 1 }}
                  value={question.points}
                  onChange={(e) =>
                    updateQuestion(
                      sIdx,
                      qIdx,
                      'points',
                      Math.max(1, Number(e.target.value) || 1)
                    )
                  }
                />

                {question.questionType === 'coding' && (
                  <>
                    <TextField
                      select
                      fullWidth
                      label="Language"
                      sx={{ mt: 1 }}
                      value={question.language}
                      onChange={(e) =>
                        updateQuestion(sIdx, qIdx, 'language', e.target.value)
                      }
                    >
                      <MenuItem value="python">Python</MenuItem>
                      <MenuItem value="javascript">JavaScript</MenuItem>
                      <MenuItem value="java">Java</MenuItem>
                      <MenuItem value="cpp">C++</MenuItem>
                      <MenuItem value="c">C</MenuItem>
                    </TextField>

                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Starter Code"
                      sx={{ mt: 1 }}
                      value={question.starterCode}
                      onChange={(e) =>
                        updateQuestion(
                          sIdx,
                          qIdx,
                          'starterCode',
                          e.target.value
                        )
                      }
                    />

                    {question.testCases.map((testCase, tIdx) => (
                      <Box key={tIdx} sx={{ mt: 1 }}>
                        <TextField
                          fullWidth
                          label="Input"
                          value={testCase.input}
                          onChange={(e) =>
                            updateTestCase(
                              sIdx,
                              qIdx,
                              tIdx,
                              'input',
                              e.target.value
                            )
                          }
                        />

                        <TextField
                          fullWidth
                          sx={{ mt: 1 }}
                          label="Expected Output"
                          value={testCase.expectedOutput}
                          onChange={(e) =>
                            updateTestCase(
                              sIdx,
                              qIdx,
                              tIdx,
                              'expectedOutput',
                              e.target.value
                            )
                          }
                        />
                      </Box>
                    ))}

                    <Button sx={{ mt: 1 }} onClick={() => addTestCase(sIdx, qIdx)}>
                      Add Test Case
                    </Button>
                  </>
                )}

                <Divider sx={{ mt: 2 }} />
              </Box>
            ))}
          </CardContent>
        </Card>
      ))}

      <Button variant="contained" sx={{ mt: 1 }} onClick={handleSave}>
        Save Changes
      </Button>
    </Container>
  );
};

export default EditExam;
