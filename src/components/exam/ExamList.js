import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../../utils/api';

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      const res = await examAPI.getAllExamsWithStatus();
      setExams(res.data.exams || []);
    } catch (err) {
      setError('Failed to load exams');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Exams
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {exams.length === 0 && !error && (
        <Alert severity="info">No exams available</Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {exams.map((exam) => (
          <Grid item xs={12} md={6} key={exam._id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{exam.title}</Typography>
                <Typography color="text.secondary">
                  {exam.description}
                </Typography>

                <Chip
                  label={exam.status.toUpperCase()}
                  color={
                    exam.status === 'live'
                      ? 'success'
                      : exam.status === 'upcoming'
                      ? 'warning'
                      : 'default'
                  }
                  sx={{ mt: 1 }}
                />

                <Typography sx={{ mt: 1 }}>
                  Duration: {exam.duration} mins
                </Typography>

                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  disabled={exam.status !== 'live'}
                  onClick={() => navigate(`/exam/${exam._id}`)}
                >
                  {exam.status === 'live' ? 'Start Exam' : 'Not Live'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default ExamList;
