import React, { useEffect, useMemo, useState } from 'react';
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
  Stack,
} from '@mui/material';
import {
  School,
  Person,
  PlayArrow,
  Analytics,
  Add,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { examAPI, studentAPI } from '../utils/api';
import {
  getSubjectColor,
  getSubjectName,
  getGrade,
  formatDate,
} from '../utils/api';

const getStoredSubmittedResult = () => {
  try {
    const value = localStorage.getItem('latestSubmittedExamResult');
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const buildFallbackResult = (submittedResult) => {
  if (!submittedResult) return null;

  return {
    _id: submittedResult.examResultId || `local-${submittedResult.examId || Date.now()}`,
    exam: {
      _id: submittedResult.examId,
      title: submittedResult.examTitle || 'Exam',
      subject: submittedResult.subject || 'computer_science',
    },
    score: submittedResult.score || 0,
    totalPoints: submittedResult.totalPoints || 0,
    percentage: submittedResult.percentage || 0,
    endTime: submittedResult.submittedAt,
    createdAt: submittedResult.submittedAt,
    isLocalFallback: true,
  };
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [availableExams, setAvailableExams] = useState([]);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const submittedResult = location.state?.submittedResult || getStoredSubmittedResult();
  const displayResults = useMemo(() => {
    const fallbackResult = buildFallbackResult(submittedResult);
    if (!fallbackResult) return history;

    const alreadyPresent = history.some((item) => (
      String(item._id) === String(fallbackResult._id)
      || String(item.exam?._id) === String(fallbackResult.exam?._id)
    ));

    return alreadyPresent ? history : [fallbackResult, ...history];
  }, [history, submittedResult]);

  const latestResult = useMemo(() => displayResults[0] || null, [displayResults]);

  const calculatedOverviewStats = useMemo(() => ({
    totalExams: displayResults.length,
    averageScore: displayResults.length
      ? displayResults.reduce((sum, item) => sum + (item.percentage || 0), 0) / displayResults.length
      : 0,
    totalScore: displayResults.reduce((sum, item) => sum + (item.percentage || 0), 0),
  }), [displayResults]);

  const overviewStats = analytics?.overallStats?.totalExams
    ? analytics.overallStats
    : calculatedOverviewStats;

  useEffect(() => {
    if (!submittedResult?.examResultId) return;

    const isPersisted = history.some(
      (item) => String(item._id) === String(submittedResult.examResultId)
    );

    if (isPersisted) {
      localStorage.removeItem('latestSubmittedExamResult');
    }
  }, [history, submittedResult]);

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
        Welcome back, {user.firstName}!
      </Typography>

      <Typography color="text.secondary" gutterBottom>
        {user.role === 'teacher'
          ? 'Manage and monitor exams'
          : 'Track performance and take exams'}
      </Typography>

      {user.role === 'student' && submittedResult && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {submittedResult.examTitle || 'Exam'} submitted successfully. Score:
          {' '}
          {submittedResult.score}/{submittedResult.totalPoints}
          {' '}
          ({submittedResult.percentage}%).
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
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
                                : `${getSubjectName(exam.subject)} | ${exam.duration} mins`
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
                                onClick={() => navigate(`/exam/edit/${exam._id}`)}
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
                              onClick={() => navigate(`/exam/${exam._id}`)}
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

        {user.role === 'student' && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6">Performance Overview</Typography>
                <Typography sx={{ mt: 2 }}>
                  Total Exams: {overviewStats.totalExams || 0}
                </Typography>
                <Typography>
                  Average Score: {(overviewStats.averageScore || 0).toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {user.role === 'student' && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6">Submitted Results</Typography>

                {latestResult && (
                  <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                    Latest result: {latestResult.exam?.title || 'Untitled Exam'} scored {latestResult.score}/{latestResult.totalPoints} ({latestResult.percentage}%) on {formatDate(latestResult.endTime || latestResult.createdAt)}.
                  </Alert>
                )}

                {displayResults.length === 0 ? (
                  <Alert severity="info">No attempts yet</Alert>
                ) : (
                  <List>
                    {displayResults.map((res, index) => (
                      <React.Fragment key={res._id}>
                        <ListItem>
                          <ListItemText
                            primary={res.exam?.title || 'Untitled Exam'}
                            secondary={`${formatDate(res.endTime || res.createdAt)} | ${getSubjectName(res.exam?.subject)} | ${res.score}/${res.totalPoints} | ${res.percentage}%${res.isLocalFallback ? ' | Syncing saved result' : ''}`}
                          />
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={getGrade(res.percentage).grade}
                              sx={{
                                bgcolor: getGrade(res.percentage).color,
                                color: '#fff',
                              }}
                            />
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!res.exam?._id}
                              onClick={() => navigate(`/exam/${res.exam._id}/result`)}
                            >
                              View Result
                            </Button>
                          </Stack>
                        </ListItem>
                        {index < displayResults.length - 1 && <Divider />}
                      </React.Fragment>
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
