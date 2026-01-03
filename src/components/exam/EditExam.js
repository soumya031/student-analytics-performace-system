import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { examAPI } from '../../utils/api';

const EditExam = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExam();
  }, []);

  const loadExam = async () => {
    try {
      const res = await examAPI.getTeacherExams();
      const found = res.data.exams.find((e) => e._id === examId);
      if (!found) {
        setError('Exam not found');
      } else {
        setExam(found);
      }
    } catch {
      setError('Failed to load exam');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await examAPI.updateExam(examId, {
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        startTime: exam.startTime,
        endTime: exam.endTime,
      });
      navigate('/dashboard');
    } catch {
      setError('Failed to update exam');
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!exam) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Edit Exam
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        fullWidth
        label="Title"
        sx={{ mt: 2 }}
        value={exam.title}
        onChange={(e) => setExam({ ...exam, title: e.target.value })}
      />

      <TextField
        fullWidth
        label="Description"
        sx={{ mt: 2 }}
        value={exam.description}
        onChange={(e) =>
          setExam({ ...exam, description: e.target.value })
        }
      />

      <TextField
        fullWidth
        type="number"
        label="Duration (minutes)"
        sx={{ mt: 2 }}
        value={exam.duration}
        onChange={(e) =>
          setExam({ ...exam, duration: Number(e.target.value) })
        }
      />

      <TextField
        fullWidth
        type="datetime-local"
        label="Start Time"
        sx={{ mt: 2 }}
        InputLabelProps={{ shrink: true }}
        value={exam.startTime?.slice(0, 16)}
        onChange={(e) =>
          setExam({ ...exam, startTime: e.target.value })
        }
      />

      <Button
        variant="contained"
        sx={{ mt: 3 }}
        onClick={handleSave}
      >
        Save Changes
      </Button>
    </Container>
  );
};

export default EditExam;
