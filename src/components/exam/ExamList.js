import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const ExamList = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Available Exams
      </Typography>
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Exam list component will be implemented here
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This will show all available exams for the student to take
        </Typography>
      </Box>
    </Container>
  );
};

export default ExamList; 