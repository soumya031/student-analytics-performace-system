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
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

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

  
  useEffect(() => {
    const loadExam = async () => {
      const res = await axios.get(`/api/exam/${examId}`, {
        withCredentials: true
      });
      setExam(res.data.exam);

      await axios.post(`/api/exam/${examId}/start`, {}, { withCredentials: true });

      setTimeLeft(res.data.exam.duration * 60);
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
      { sectionIndex: sIdx, questionIndex: qIdx, selectedAnswer }
    ]);
  };

  
  const runCode = async (sIdx, qIdx, code, language) => {
    const res = await axios.post(
      `/api/exam/${examId}/compile`,
      { code, language },
      { withCredentials: true }
    );

    setRunOutput(prev => ({
      ...prev,
      [`${sIdx}-${qIdx}`]: res.data.result.output || res.data.result.stderr
    }));
  };

  
  const handleSubmit = async () => {
    clearInterval(timerRef.current);

    await axios.post(
      `/api/exam/${examId}/submit`,
      {
        mcqAnswers,
        codingAnswers,
        timeTaken: exam.duration - Math.floor(timeLeft / 60),
        cheatingAttempts: [
          {
            timestamp: new Date(),
            type: 'tab_switch',
            description: `${violations} violations`
          }
        ]
      },
      { withCredentials: true }
    );

    navigate(`/exam/${examId}/result`);
  };

  if (!exam) return <Typography>Loading...</Typography>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4">{exam.title}</Typography>
      <Typography color="error">
        ⏱ Time Left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
      </Typography>

      {violations > 0 && (
        <Alert severity="warning">Violations: {violations}</Alert>
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
                        { sectionIndex: sIdx, questionIndex: qIdx, code: value, language: q.language }
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
        onClick={handleSubmit}
      >
        Submit Exam
      </Button>
    </Container>
  );
};

export default ExamTaking;
