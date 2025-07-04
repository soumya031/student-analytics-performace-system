import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const ExamTaking = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Take Exam
      </Typography>
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Exam taking component will be implemented here
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This will include the exam interface with questions, timer, and face detection
        </Typography>
      </Box>
    </Container>
  );
};

export default ExamTaking; 