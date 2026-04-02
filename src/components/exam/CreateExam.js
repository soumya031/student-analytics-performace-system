import React, { useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Checkbox,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Divider,
  Alert,
  Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../../utils/api';
import { buildExamPayload, toIsoDateTime } from './examFormUtils';

/* ---------- Templates ---------- */

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
  testCases: [{ input: '', expectedOutput: '', isHidden: false }],
});

const syncSectionQuestions = (existingQuestions = [], count, createQuestion) =>
  Array.from({ length: count }, (_, index) => existingQuestions[index] || createQuestion());

const buildSectionsFromCounts = (existingSections, mcqCount, codingCount) => {
  const nextSections = [];
  const existingMcqSection = existingSections.find((section) => section.sectionType === 'mcq');
  const existingCodingSection = existingSections.find((section) => section.sectionType === 'coding');

  if (mcqCount > 0) {
    nextSections.push({
      sectionType: 'mcq',
      title: 'MCQ Section',
      instructions: 'Choose the correct option',
      order: 1,
      questions: syncSectionQuestions(existingMcqSection?.questions, mcqCount, emptyMCQ),
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
              !testCase.expectedOutput.trim()
          )
        ) {
          return `${section.title}: Complete every test case for question ${questionNumber}`;
        }
      }
    }
  }

  return '';
};

const CreateExam = () => {
  const navigate = useNavigate();

  /* ---------- STATE ---------- */

  const [exam, setExam] = useState({
    title: '',
    description: '',
    subject: 'computer_science',
    duration: 60,
    startTime: '',
    endTime: '',
    sections: [],
  });

  const [mcqCount, setMcqCount] = useState(0);
  const [codingCount, setCodingCount] = useState(0);
  const [error, setError] = useState('');

  /* ---------- HELPERS ---------- */

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
                        { input: '', expectedOutput: '', isHidden: false },
                      ],
                    }
              ),
            }
      )
    );
  };

  const removeTestCase = (sIdx, qIdx, tIdx) => {
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
                      testCases:
                        (question.testCases || []).length > 1
                          ? question.testCases.filter(
                              (_, testCaseIndex) => testCaseIndex !== tIdx
                            )
                          : question.testCases,
                    }
              ),
            }
      )
    );
  };

  /* ---------- SUBMIT ---------- */

  const handleCreateExam = async () => {
    try {
      setError('');

      if (!exam.startTime || !exam.endTime) {
        return setError('Start time and end time are required');
      }

      if (!exam.title.trim() || !exam.description.trim()) {
        return setError('Title and description are required');
      }

      if (!Number(exam.duration) || Number(exam.duration) < 1) {
        return setError('Duration must be at least 1 minute');
      }

      const start = new Date(toIsoDateTime(exam.startTime));
      const end = new Date(toIsoDateTime(exam.endTime));

      if (start <= new Date()) {
        return setError('Start time must be in the future');
      }

      if (end <= start) {
        return setError('End time must be after start time');
      }

      const sections = exam.sections;

      if (sections.length === 0) {
        return setError('Add at least one MCQ or Coding question');
      }

      const validationError = validateSections(sections);
      if (validationError) {
        return setError(validationError);
      }

      const payload = buildExamPayload({ ...exam, sections });

      await examAPI.createExam(payload);

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create exam');
    }
  };

  /* ---------- UI ---------- */

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Create Exam
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {/* BASIC INFO */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Exam Title"
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
            type="number"
            label="Duration (minutes)"
            sx={{ mb: 2 }}
            value={exam.duration}
            onChange={(e) =>
              setExam({ ...exam, duration: Number(e.target.value) })
            }
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                type="datetime-local"
                label="Start Time"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={exam.startTime}
                onChange={(e) =>
                  setExam({ ...exam, startTime: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                type="datetime-local"
                label="End Time"
                fullWidth
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

      {/* QUESTION COUNTS */}
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
            onChange={(e) => handleQuestionCountChange('coding', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* QUESTIONS */}
      {exam.sections.map((section, sIdx) => (
        <Card key={sIdx} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6">{section.title}</Typography>

            {section.questions.map((q, qIdx) => (
              <Box key={qIdx} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label={`Question ${qIdx + 1}`}
                  value={q.question}
                  onChange={(e) =>
                    updateQuestion(sIdx, qIdx, 'question', e.target.value)
                  }
                />

                {q.questionType === 'mcq' &&
                  <>
                    {q.options.map((opt, oIdx) => (
                      <TextField
                        key={oIdx}
                        fullWidth
                        sx={{ mt: 1 }}
                        label={`Option ${oIdx + 1}`}
                        value={opt}
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
                      value={q.correctAnswer}
                      onChange={(e) =>
                        updateQuestion(
                          sIdx,
                          qIdx,
                          'correctAnswer',
                          Number(e.target.value)
                        )
                      }
                    >
                      {q.options.map((_, oIdx) => (
                        <MenuItem key={oIdx} value={oIdx}>
                          Option {oIdx + 1}
                        </MenuItem>
                      ))}
                    </TextField>
                  </>}

                <TextField
                  fullWidth
                  type="number"
                  label="Points"
                  sx={{ mt: 1 }}
                  value={q.points}
                  onChange={(e) =>
                    updateQuestion(
                      sIdx,
                      qIdx,
                      'points',
                      Math.max(1, Number(e.target.value) || 1)
                    )
                  }
                />

                {q.questionType === 'coding' && (
                  <>
                    <TextField
                      select
                      fullWidth
                      label="Language"
                      sx={{ mt: 1 }}
                      value={q.language}
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
                      value={q.starterCode}
                      onChange={(e) =>
                        updateQuestion(
                          sIdx,
                          qIdx,
                          'starterCode',
                          e.target.value
                        )
                      }
                    />

                    {q.testCases.map((tc, tIdx) => (
                      <Box key={tIdx} sx={{ mt: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <Typography variant="subtitle2">
                            Test Case {tIdx + 1}
                          </Typography>
                          <Button
                            color="error"
                            size="small"
                            disabled={q.testCases.length === 1}
                            onClick={() => removeTestCase(sIdx, qIdx, tIdx)}
                          >
                            Remove
                          </Button>
                        </Box>
                        <TextField
                          fullWidth
                          label="Input"
                          value={tc.input}
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
                          value={tc.expectedOutput}
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
                        <FormControlLabel
                          sx={{ mt: 1 }}
                          control={
                            <Checkbox
                              checked={Boolean(tc.isHidden)}
                              onChange={(e) =>
                                updateTestCase(
                                  sIdx,
                                  qIdx,
                                  tIdx,
                                  'isHidden',
                                  e.target.checked
                                )
                              }
                            />
                          }
                          label="Hidden from students"
                        />
                      </Box>
                    ))}

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Visible test cases are shown to students. Hidden ones are used only for evaluation.
                    </Typography>

                    <Button onClick={() => addTestCase(sIdx, qIdx)}>
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

      <Button variant="contained" size="large" onClick={handleCreateExam}>
        Create Exam
      </Button>
    </Container>
  );
};

export default CreateExam;
