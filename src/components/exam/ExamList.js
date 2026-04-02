import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../../utils/api';
import {
  filterStudentVisibleExams,
  hideExpiredExam,
} from './studentExamVisibility';

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadExams = useCallback(async () => {
    try {
      setError('');
      const res = await examAPI.getAllExamsWithStatus();
      setExams(res.data.exams || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load exams');
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const visibleExams = useMemo(
    () => filterStudentVisibleExams(exams),
    [exams]
  );

  const dismissExpiredExam = (examId) => {
    hideExpiredExam(examId);
    setExams((currentExams) => currentExams.filter((exam) => exam._id !== examId));
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Exams
      </Typography>

      <Typography color="text.secondary">
        Upcoming and live exams stay visible. Expired exams remain here for 24 hours unless you dismiss them sooner.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {visibleExams.length === 0 && !error && (
        <Alert severity="info">No exams available</Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {visibleExams.map((exam) => (
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

                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Starts: {new Date(exam.startTime).toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ends: {new Date(exam.endTime).toLocaleString('en-IN')}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                  {exam.status === 'live' && !exam.isCompleted && (
                    <Button
                      variant="contained"
                      onClick={() => navigate(`/exam/${exam._id}`)}
                    >
                      {exam.hasStarted ? 'Resume Exam' : 'Start Exam'}
                    </Button>
                  )}

                  {exam.isCompleted && (
                    <Button
                      variant="outlined"
                      onClick={() => navigate(`/exam/${exam._id}/result`)}
                    >
                      View Result
                    </Button>
                  )}

                  {exam.status === 'upcoming' && (
                    <Button variant="outlined" disabled>
                      Upcoming
                    </Button>
                  )}

                  {exam.status === 'expired' && (
                    <Button
                      color="error"
                      variant="outlined"
                      onClick={() => dismissExpiredExam(exam._id)}
                    >
                      Remove
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default ExamList;
