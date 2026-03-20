import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Divider, Chip } from '@mui/material';
import { useParams } from 'react-router-dom';
import { examAPI } from '../../utils/api';

const Results = () => {
  const { examId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadResult = async () => {
      try {
        const res = await examAPI.getExamResult(examId);
        setResult(res.data.examResult);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load result');
      }
    };
    loadResult();
  }, [examId]);

  if (!result) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>{error || 'Loading result...'}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4">Exam Result</Typography>

      <Box sx={{ mt: 2 }}>
        <Chip label={`Score: ${result.score}`} color="primary" />
        <Chip label={`Percentage: ${result.percentage}%`} sx={{ ml: 2 }} />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6">MCQ Summary</Typography>
      {result.mcqAnswers.map((a, i) => (
        <Typography key={i}>
          Q{i + 1}: {a.isCorrect ? '✅ Correct' : '❌ Wrong'}
        </Typography>
      ))}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6">Coding Summary</Typography>
      {result.codingAnswers.map((c, i) => (
        <Typography key={i}>
          Q{i + 1}: {c.passedCount}/{c.totalCount} testcases passed
        </Typography>
      ))}
    </Container>
  );
};

export default Results;
