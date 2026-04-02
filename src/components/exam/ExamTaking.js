import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import Editor from '@monaco-editor/react';
import { useNavigate, useParams } from 'react-router-dom';
import { examAPI } from '../../utils/api';

const ExamTaking = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState([]);
  const [codingAnswers, setCodingAnswers] = useState([]);
  const [runOutput, setRunOutput] = useState({});
  const [violations, setViolations] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef(null);
  const hasAutoSubmittedRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (!exam || submitting) return;

    clearInterval(timerRef.current);
    setSubmitting(true);
    setError('');

    try {
      const durationMinutes = Number(exam.duration || 0);
      const timeTaken = Math.max(0, durationMinutes - Math.floor(timeLeft / 60));

      const response = await examAPI.submitExam(examId, {
        mcqAnswers,
        codingAnswers: codingAnswers.map((answer) => ({
          ...answer,
          code: answer.code || '',
          timeSpent: answer.timeSpent || 0,
        })),
        timeTaken,
        cheatingAttempts: violations > 0
          ? [
              {
                timestamp: new Date(),
                type: 'tab_switch',
                description: `${violations} violation(s) detected`,
              },
            ]
          : [],
      });

      localStorage.setItem(
        'latestSubmittedExamResult',
        JSON.stringify({
          ...response.data,
          examId,
          subject: exam.subject,
          submittedAt: new Date().toISOString(),
        })
      );

      navigate('/dashboard', {
        state: {
          submittedResult: response.data,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit exam');
      setSubmitting(false);
      hasAutoSubmittedRef.current = false;
    }
  }, [codingAnswers, exam, examId, mcqAnswers, navigate, submitting, timeLeft, violations]);

  useEffect(() => {
    const loadExam = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await examAPI.getExam(examId);
        setExam(res.data.exam);
        setTimeLeft(Number(res.data.exam.duration || 0) * 60);

        const startResponse = await examAPI.startExam(examId);
        if (startResponse.data?.isCompleted) {
          navigate(`/exam/${examId}/result`);
          return;
        }
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load exam';
        setError(message);

        if (message === 'Already attempted') {
          navigate(`/exam/${examId}/result`);
        }
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [examId, navigate]);

  useEffect(() => {
    if (!exam || submitting) return undefined;

    timerRef.current = setInterval(() => {
      setTimeLeft((currentTime) => {
        if (currentTime <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return currentTime - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [exam, submitting]);

  useEffect(() => {
    if (!exam || submitting || timeLeft > 0 || hasAutoSubmittedRef.current) {
      return;
    }

    hasAutoSubmittedRef.current = true;
    handleSubmit();
  }, [exam, handleSubmit, submitting, timeLeft]);

  useEffect(() => {
    const onBlur = () => {
      setViolations((value) => value + 1);
    };

    const onCopy = (event) => {
      event.preventDefault();
      setViolations((value) => value + 1);
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);

    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
    };
  }, []);

  const handleMcq = (sectionIndex, questionIndex, selectedAnswer) => {
    setMcqAnswers((previousAnswers) => [
      ...previousAnswers.filter(
        (answer) =>
          !(answer.sectionIndex === sectionIndex && answer.questionIndex === questionIndex)
      ),
      {
        sectionIndex,
        questionIndex,
        selectedAnswer,
        timeSpent: 0,
      },
    ]);
  };

  const handleCodingChange = (sectionIndex, questionIndex, code, language) => {
    setCodingAnswers((previousAnswers) => [
      ...previousAnswers.filter(
        (answer) =>
          !(answer.sectionIndex === sectionIndex && answer.questionIndex === questionIndex)
      ),
      {
        sectionIndex,
        questionIndex,
        code: code || '',
        language: language || 'python',
        timeSpent: 0,
      },
    ]);
  };

  const runCode = async (sectionIndex, questionIndex, code, language) => {
    try {
      const res = await examAPI.compileExam(examId, {
        code,
        language,
        sectionIndex,
        questionIndex,
      });
      setRunOutput((previousOutput) => ({
        ...previousOutput,
        [`${sectionIndex}-${questionIndex}`]:
          res.data.result.output || res.data.result.stderr || 'No output',
      }));
    } catch (err) {
      setRunOutput((previousOutput) => ({
        ...previousOutput,
        [`${sectionIndex}-${questionIndex}`]:
          err.response?.data?.message || 'Failed to run code',
      }));
    }
  };

  const selectedMcqAnswers = useMemo(
    () =>
      new Map(
        mcqAnswers.map((answer) => [
          `${answer.sectionIndex}-${answer.questionIndex}`,
          String(answer.selectedAnswer),
        ])
      ),
    [mcqAnswers]
  );

  const selectedCodingAnswers = useMemo(
    () =>
      new Map(
        codingAnswers.map((answer) => [
          `${answer.sectionIndex}-${answer.questionIndex}`,
          answer,
        ])
      ),
    [codingAnswers]
  );

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>Loading exam...</Typography>
      </Container>
    );
  }

  if (!exam) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error || 'Exam not found'}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4">{exam.title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {exam.description}
      </Typography>
      <Typography color="error" sx={{ mt: 2 }}>
        Time Left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
      </Typography>

      {violations > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Violations detected: {violations}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {exam.sections.map((section, sectionIndex) => (
        <Box key={`${section.sectionType}-${sectionIndex}`} sx={{ mt: 4 }}>
          <Typography variant="h5">{section.title}</Typography>
          {section.instructions && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {section.instructions}
            </Typography>
          )}

          {section.questions.map((question, questionIndex) => {
            const questionKey = `${sectionIndex}-${questionIndex}`;
            const codingAnswer = selectedCodingAnswers.get(questionKey);
            const sampleTestCases =
              question.visibleTestCases || question.testCases || [];

            return (
              <Box key={questionKey} sx={{ mt: 3 }}>
                <Typography>
                  {questionIndex + 1}. {question.question}
                </Typography>

                {question.questionType === 'mcq' && (
                  <RadioGroup
                    value={selectedMcqAnswers.get(questionKey) || ''}
                    onChange={(event) =>
                      handleMcq(sectionIndex, questionIndex, Number(event.target.value))
                    }
                  >
                    {question.options.map((option, optionIndex) => (
                      <FormControlLabel
                        key={optionIndex}
                        value={String(optionIndex)}
                        control={<Radio />}
                        label={option}
                      />
                    ))}
                  </RadioGroup>
                )}

                {question.questionType === 'coding' && (
                  <>
                    {sampleTestCases.length > 0 && (
                      <Box
                        sx={{
                          mt: 2,
                          mb: 2,
                          p: 2,
                          bgcolor: '#f8fafc',
                          borderRadius: 1,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Sample Test Cases
                        </Typography>
                        {sampleTestCases.map((testCase, testCaseIndex) => (
                          <Box key={testCaseIndex} sx={{ mb: 1.5 }}>
                            <Typography variant="body2">
                              Input: {testCase.input || '(empty)'}
                            </Typography>
                            <Typography variant="body2">
                              Expected Output: {testCase.expectedOutput || '(empty)'}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}

                    <Editor
                      height="300px"
                      language={question.language || 'python'}
                      value={codingAnswer?.code ?? question.starterCode ?? ''}
                      onChange={(value) =>
                        handleCodingChange(
                          sectionIndex,
                          questionIndex,
                          value,
                          question.language || 'python'
                        )
                      }
                    />

                    <Button
                      sx={{ mt: 1 }}
                      onClick={() =>
                        runCode(
                          sectionIndex,
                          questionIndex,
                          codingAnswer?.code ?? question.starterCode ?? '',
                          question.language || 'python'
                        )
                      }
                    >
                      Run Code
                    </Button>

                    {runOutput[questionKey] && (
                      <Box
                        component="pre"
                        sx={{
                          mt: 2,
                          p: 2,
                          bgcolor: '#111827',
                          color: '#f9fafb',
                          borderRadius: 1,
                          overflowX: 'auto',
                        }}
                      >
                        {runOutput[questionKey]}
                      </Box>
                    )}
                  </>
                )}

                <Divider sx={{ mt: 3 }} />
              </Box>
            );
          })}
        </Box>
      ))}

      <Button
        color="error"
        variant="contained"
        sx={{ mt: 4, mb: 6 }}
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Submitting...' : 'Submit Exam'}
      </Button>
    </Container>
  );
};

export default ExamTaking;
