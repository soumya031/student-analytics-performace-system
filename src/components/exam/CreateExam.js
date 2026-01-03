import React, { useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Card,
  CardContent,
  MenuItem,
  Divider,
  Alert,
  Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../../utils/api';

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
  testCases: [{ input: '', expectedOutput: '' }],
});

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

  const buildSections = () => {
    const sections = [];

    if (mcqCount > 0) {
      sections.push({
        sectionType: 'mcq',
        title: 'MCQ Section',
        instructions: 'Choose the correct option',
        order: 1,
        questions: Array.from({ length: mcqCount }, emptyMCQ),
      });
    }

    if (codingCount > 0) {
      sections.push({
        sectionType: 'coding',
        title: 'Coding Section',
        instructions: 'Write correct code for all test cases',
        order: sections.length + 1,
        questions: Array.from({ length: codingCount }, emptyCoding),
      });
    }

    return sections;
  };

  const updateQuestion = (sIdx, qIdx, field, value) => {
    const sections = [...exam.sections];
    sections[sIdx].questions[qIdx][field] = value;
    setExam({ ...exam, sections });
  };

  const updateOption = (sIdx, qIdx, oIdx, value) => {
    const sections = [...exam.sections];
    sections[sIdx].questions[qIdx].options[oIdx] = value;
    setExam({ ...exam, sections });
  };

  const updateTestCase = (sIdx, qIdx, tIdx, field, value) => {
    const sections = [...exam.sections];
    sections[sIdx].questions[qIdx].testCases[tIdx][field] = value;
    setExam({ ...exam, sections });
  };

  const addTestCase = (sIdx, qIdx) => {
    const sections = [...exam.sections];
    sections[sIdx].questions[qIdx].testCases.push({
      input: '',
      expectedOutput: '',
    });
    setExam({ ...exam, sections });
  };

  /* ---------- SUBMIT ---------- */

  const handleCreateExam = async () => {
    try {
      setError('');

      if (!exam.startTime || !exam.endTime) {
        return setError('Start time and end time are required');
      }

      const start = new Date(exam.startTime);
      const end = new Date(exam.endTime);

      if (start <= new Date()) {
        return setError('Start time must be in the future');
      }

      if (end <= start) {
        return setError('End time must be after start time');
      }

      const sections = buildSections();

      if (sections.length === 0) {
        return setError('Add at least one MCQ or Coding question');
      }

      const totalQuestions = sections.reduce(
        (sum, s) => sum + s.questions.length,
        0
      );

      const totalPoints = sections.reduce(
        (sum, s) =>
          sum +
          s.questions.reduce((qSum, q) => qSum + Number(q.points || 0), 0),
        0
      );

      const payload = {
        ...exam,
        sections,
        totalQuestions,
        totalPoints,
        isActive: true,
        faceDetectionRequired: true,
      };

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
            onChange={(e) => setMcqCount(Number(e.target.value))}
          />

          <TextField
            type="number"
            label="Number of Coding Questions"
            sx={{ mt: 2 }}
            value={codingCount}
            onChange={(e) => setCodingCount(Number(e.target.value))}
          />
        </CardContent>
      </Card>

      {/* QUESTIONS */}
      {buildSections().map((section, sIdx) => (
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
                  q.options.map((opt, oIdx) => (
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

                {q.questionType === 'coding' && (
                  <>
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
                      </Box>
                    ))}

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
