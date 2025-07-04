import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  School,
  Assessment,
  TrendingUp,
  Schedule,
  Person,
  PlayArrow,
  History,
  Analytics,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { examAPI, studentAPI, pythonAPI } from '../utils/api';
import { getSubjectColor, getSubjectName, getGrade, formatDate } from '../utils/api';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [examHistory, setExamHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [availableExams, setAvailableExams] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load exam history
      const historyResponse = await studentAPI.getExamHistory();
      setExamHistory(historyResponse.data.examResults || []);

      // Load analytics
      const analyticsResponse = await studentAPI.getAnalytics();
      setAnalytics(analyticsResponse.data);

      // Load available exams
      const examsResponse = await examAPI.getAvailableExams();
      setAvailableExams(examsResponse.data.exams || []);

      // Load recommendations from Python service
      try {
        const recResponse = await pythonAPI.getRecommendations(user._id);
        setRecommendations(recResponse.data.recommendations || []);
      } catch (error) {
        console.log('Python service not available for recommendations');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverallGrade = () => {
    if (!analytics?.overallStats?.averageScore) return { grade: 'N/A', color: '#757575' };
    return getGrade(analytics.overallStats.averageScore);
  };

  const getRecentExams = () => {
    return examHistory.slice(0, 5);
  };

  const getSubjectPerformance = () => {
    if (!analytics?.subjectPerformance) return [];
    return Object.entries(analytics.subjectPerformance).map(([subject, data]) => ({
      subject,
      ...data,
    }));
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome back, {user.firstName}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's your performance overview and recent activity.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Performance Overview */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Overview
              </Typography>
              
              {analytics ? (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <Box textAlign="center">
                      <Typography variant="h3" color="primary" gutterBottom>
                        {analytics.overallStats?.totalExams || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Exams
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box textAlign="center">
                      <Typography variant="h3" color="secondary" gutterBottom>
                        {analytics.overallStats?.averageScore?.toFixed(1) || 0}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Average Score
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box textAlign="center">
                      <Typography variant="h3" style={{ color: getOverallGrade().color }} gutterBottom>
                        {getOverallGrade().grade}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Overall Grade
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="info">
                  No exam data available. Start taking exams to see your performance!
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => navigate('/exams')}
                  fullWidth
                >
                  Take Exam
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Analytics />}
                  onClick={() => navigate('/analytics')}
                  fullWidth
                >
                  View Analytics
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Person />}
                  onClick={() => navigate('/profile')}
                  fullWidth
                >
                  Update Profile
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Subject Performance */}
        {analytics?.subjectPerformance && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Subject Performance
                </Typography>
                <Grid container spacing={2}>
                  {getSubjectPerformance().map((subject) => (
                    <Grid item xs={12} sm={6} md={4} key={subject.subject}>
                      <Paper sx={{ p: 2, borderLeft: `4px solid ${getSubjectColor(subject.subject)}` }}>
                        <Typography variant="subtitle1" gutterBottom>
                          {getSubjectName(subject.subject)}
                        </Typography>
                        <Typography variant="h4" color="primary" gutterBottom>
                          {subject.averageScore?.toFixed(1) || 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {subject.totalExams} exams taken
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={subject.averageScore || 0}
                          sx={{ mt: 1 }}
                        />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Available Exams */}
        {availableExams.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Available Exams
                </Typography>
                <List>
                  {availableExams.slice(0, 3).map((exam, index) => (
                    <React.Fragment key={exam._id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: getSubjectColor(exam.subject) }}>
                            <School />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={exam.title}
                          secondary={`${getSubjectName(exam.subject)} • ${exam.duration} minutes`}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => navigate(`/exam/${exam._id}`)}
                        >
                          Start
                        </Button>
                      </ListItem>
                      {index < availableExams.slice(0, 3).length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
                {availableExams.length > 3 && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/exams')}
                    >
                      View All ({availableExams.length})
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Recent Exams */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Exams
              </Typography>
              {getRecentExams().length > 0 ? (
                <List>
                  {getRecentExams().map((result, index) => (
                    <React.Fragment key={result._id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: getSubjectColor(result.exam.subject) }}>
                            <Assessment />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={result.exam.title}
                          secondary={`${formatDate(result.createdAt)} • ${result.percentage.toFixed(1)}%`}
                        />
                        <Chip
                          label={getGrade(result.percentage).grade}
                          size="small"
                          sx={{ bgcolor: getGrade(result.percentage).color, color: 'white' }}
                        />
                      </ListItem>
                      {index < getRecentExams().length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  No recent exams. Start taking exams to see your history!
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Personalized Recommendations
                </Typography>
                <Grid container spacing={2}>
                  {recommendations.slice(0, 3).map((rec, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          {rec.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {rec.description}
                        </Typography>
                        <Chip
                          label={rec.priority}
                          size="small"
                          color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'success'}
                          sx={{ mt: 1 }}
                        />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default Dashboard; 