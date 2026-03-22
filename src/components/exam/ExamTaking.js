import React, { useEffect, useRef, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  RadioGroup,
  Radio,
  FormControlLabel,
  Button,
  Divider,
  Alert
} from '@mui/material';
import Editor from '@monaco-editor/react';
import { useNavigate, useParams } from 'react-router-dom';
import { examAPI } from '../../utils/api';

const ExamTaking = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  const [mcqAnswers, setMcqAnswers] = useState([]);
  const [codingAnswers, setCodingAnswers] = useState([]);
  const [runOutput, setRunOutput] = useState({});
  const [violations, setViolations] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  
  useEffect(() => {
    const loadExam = async () => {
      try {
        const res = await examAPI.getExam(examId);
        setExam(res.data.exam);

        await examAPI.startExam(examId);

        setTimeLeft(res.data.exam.duration * 60);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load exam');
      }
    };
    loadExam();
  }, [examId]);

  
  useEffect(() => {
    if (timeLeft <= 0 && exam) {
      handleSubmit(true);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  
  useEffect(() => {
    const onBlur = () => {
      setViolations(v => v + 1);
      alert('⚠ Tab switch detected!');
    };

    const onCopy = e => {
      e.preventDefault();
      setViolations(v => v + 1);
      alert('⚠ Copy disabled!');
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);

    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
    };
  }, []);

  
  const handleMcq = (sIdx, qIdx, selectedAnswer) => {
    setMcqAnswers(prev => [
      ...prev.filter(a => !(a.sectionIndex === sIdx && a.questionIndex === qIdx)),
      { sectionIndex: sIdx, questionIndex: qIdx, selectedAnswer, timeSpent: 0 }
    ]);
  };

  
  const runCode = async (sIdx, qIdx, code, language) => {
    try {
      const res = await examAPI.compileExam(examId, { code, language });

      setRunOutput(prev => ({
        ...prev,
        [`${sIdx}-${qIdx}`]: res.data.result.output || res.data.result.stderr
      }));
    } catch (err) {
      setRunOutput(prev => ({
        ...prev,
        [`${sIdx}-${qIdx}`]: err.response?.data?.message || 'Failed to run code'
      }));
    }
  };

  
  const handleSubmit = async () => {
    if (submitting) return;

    clearInterval(timerRef.current);
    setSubmitting(true);
    setError('');

    try {
      const response = await examAPI.submitExam(examId, {
        mcqAnswers,
        codingAnswers: codingAnswers.map((answer) => ({
          ...answer,
          code: answer.code || '',
          timeSpent: answer.timeSpent || 0,
        })),
        timeTaken: exam.duration - Math.floor(timeLeft / 60),
        cheatingAttempts: [
          {
            timestamp: new Date(),
            type: 'tab_switch',
            description: `${violations} violations`
          }
        ]
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
    }
  };

  if (!exam) {
    return (
      <Container sx={{ mt: 4 }}>
        {error ? <Alert severity="error">{error}</Alert> : <Typography>Loading...</Typography>}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4">{exam.title}</Typography>
      <Typography color="error">
        ⏱ Time Left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
      </Typography>

      {violations > 0 && (
        <Alert severity="warning">Violations: {violations}</Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {exam.sections.map((sec, sIdx) => (
        <Box key={sIdx} sx={{ mt: 4 }}>
          <Typography variant="h5">{sec.title}</Typography>

          {sec.questions.map((q, qIdx) => (
            <Box key={qIdx} sx={{ mt: 3 }}>
              <Typography>{qIdx + 1}. {q.question}</Typography>

              {q.questionType === 'mcq' && (
                <RadioGroup
                  onChange={e => handleMcq(sIdx, qIdx, Number(e.target.value))}
                >
                  {q.options.map((opt, i) => (
                    <FormControlLabel
                      key={i}
                      value={i}
                      control={<Radio />}
                      label={opt}
                    />
                  ))}
                </RadioGroup>
              )}

              {q.questionType === 'coding' && (
                <>
                  <Editor
                    height="300px"
                    language={q.language || 'python'}
                    defaultValue={q.starterCode || ''}
                    onChange={value => {
                      setCodingAnswers(prev => [
                        ...prev.filter(a => !(a.sectionIndex === sIdx && a.questionIndex === qIdx)),
                        {
                          sectionIndex: sIdx,
                          questionIndex: qIdx,
                          code: value || '',
                          language: q.language || 'python',
                          timeSpent: 0
                        }
                      ]);
                    }}
                  />

                  <Button sx={{ mt: 1 }} onClick={() => {
                    const ans = codingAnswers.find(
                      a => a.sectionIndex === sIdx && a.questionIndex === qIdx
                    );
                    if (ans) runCode(sIdx, qIdx, ans.code, ans.language);
                  }}>
                    Run Code
                  </Button>

                  {runOutput[`${sIdx}-${qIdx}`] && (
                    <pre>{runOutput[`${sIdx}-${qIdx}`]}</pre>
                  )}
                </>
              )}

              <Divider sx={{ mt: 3 }} />
            </Box>
          ))}
        </Box>
      ))}

      <Button
        color="error"
        variant="contained"
        sx={{ mt: 4 }}
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Submitting...' : 'Submit Exam'}
      </Button>
    </Container>
  );
};

export default ExamTaking;
