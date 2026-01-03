import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  School,
  Person,
  PlayArrow,
  Analytics,
  Add,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { examAPI, studentAPI } from '../utils/api';
import {
  getSubjectColor,
  getSubjectName,
  getGrade,
  formatDate,
} from '../utils/api';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [availableExams, setAvailableExams] = useState([]);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  /* ============================
     POINT 9 – DATA CHANGE
     ============================ */
  const loadData = async () => {
    try {
      setLoading(true);

      const exams =
        user.role === 'teacher'
          ? await examAPI.getTeacherExams()
          : await examAPI.getAllExamsWithStatus();

      setAvailableExams(exams.data.exams || []);

      if (user.role === 'student') {
        const h = await studentAPI.getExamHistory();
        const a = await studentAPI.getAnalytics();
        setHistory(h.data.examResults || []);
        setAnalytics(a.data);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user.firstName}! 👋
      </Typography>

      <Typography color="text.secondary" gutterBottom>
        {user.role === 'teacher'
          ? 'Manage and monitor exams'
          : 'Track performance and take exams'}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* QUICK ACTIONS */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Quick Actions</Typography>

              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {user.role === 'student' && (
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={() => navigate('/exam')}
                  >
                    Take Exam
                  </Button>
                )}

                {user.role === 'teacher' && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate('/exam/create')}
                  >
                    Create Exam
                  </Button>
                )}

                <Button
                  variant="outlined"
                  startIcon={<Analytics />}
                  onClick={() => navigate('/analytics')}
                >
                  Analytics
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Person />}
                  onClick={() => navigate('/profile')}
                >
                  Profile
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* EXAMS LIST */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                {user.role === 'teacher' ? 'My Exams' : 'Available Exams'}
              </Typography>

              {availableExams.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No exams found
                </Alert>
              ) : (
                <List>
                  {availableExams.map((exam, i) => {
                    const status = exam.status || 'draft';

                    return (
                      <React.Fragment key={exam._id}>
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: getSubjectColor(exam.subject) }}>
                              <School />
                            </Avatar>
                          </ListItemAvatar>

                          <ListItemText
                            primary={exam.title}
                            secondary={
                              user.role === 'teacher'
                                ? `Status: ${status.toUpperCase()} | Duration: ${exam.duration} mins`
                                : `${getSubjectName(exam.subject)} • ${exam.duration} mins`
                            }
                          />

                          {user.role === 'teacher' && (
                            <>
                              <Chip
                                label={status}
                                color={
                                  status === 'live'
                                    ? 'success'
                                    : status === 'upcoming'
                                    ? 'warning'
                                    : 'default'
                                }
                                sx={{ mr: 2 }}
                              />

                              <Button
                                size="small"
                                variant="outlined"
                                sx={{ mr: 1 }}
                                onClick={() =>
                                  navigate(`/exam/edit/${exam._id}`)
                                }
                              >
                                Edit
                              </Button>

                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={async () => {
                                  if (window.confirm('Delete this exam?')) {
                                    await examAPI.deleteExam(exam._id);
                                    loadData();
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            </>
                          )}

                          {user.role === 'student' && (
                            <Button
                              variant="contained"
                              disabled={status !== 'live'}
                              onClick={() =>
                                navigate(`/exam/${exam._id}`)
                              }
                            >
                              {status === 'live' ? 'Start' : 'Not Live'}
                            </Button>
                          )}
                        </ListItem>

                        {i < availableExams.length - 1 && <Divider />}
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* STUDENT RECENT EXAMS */}
        {user.role === 'student' && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6">Recent Exams</Typography>

                {history.length === 0 ? (
                  <Alert severity="info">No attempts yet</Alert>
                ) : (
                  <List>
                    {history.map((res) => (
                      <ListItem key={res._id}>
                        <ListItemText
                          primary={res.exam.title}
                          secondary={`${formatDate(res.createdAt)} • ${res.percentage}%`}
                        />
                        <Chip
                          label={getGrade(res.percentage).grade}
                          sx={{
                            bgcolor: getGrade(res.percentage).color,
                            color: '#fff',
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default Dashboard;
