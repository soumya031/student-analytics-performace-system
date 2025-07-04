import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const Analytics = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Performance Analytics
      </Typography>
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Analytics component will be implemented here
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This will show detailed performance analytics, charts, and recommendations
        </Typography>
      </Box>
    </Container>
  );
};

export default Analytics; 