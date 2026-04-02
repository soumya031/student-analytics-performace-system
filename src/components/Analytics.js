import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { getSubjectName, studentAPI } from '../utils/api';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#0288d1', '#6a1b9a'];

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-IN');
};

const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

const formatMetric = (value, digits = 2) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
};

const formatRecommendationLabel = (value) => String(value || '').trim().replace(/\s*-\s*/g, ' - ');

const Analytics = () => {
  const { user } = useAuth();

  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [teacherReference, setTeacherReference] = useState(null);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentReference, setSelectedStudentReference] = useState(null);
  const [selectedExamResultId, setSelectedExamResultId] = useState('');
  const [remark, setRemark] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [studentLoading, setStudentLoading] = useState(false);
  const [error, setError] = useState('');

  const metabaseUrl = process.env.REACT_APP_METABASE_URL || 'http://localhost:3001';

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        if (user?.role === 'student') {
          const response = await studentAPI.getAnalytics();
          setStudentAnalytics(response.data);
          return;
        }

        if (user?.role === 'teacher' || user?.role === 'admin') {
          const [referenceResponse, studentsResponse] = await Promise.all([
            studentAPI.getTeacherAnalyticsReference(),
            studentAPI.getTeacherStudents(),
          ]);

          setTeacherReference(referenceResponse.data);
          setTeacherStudents(studentsResponse.data.students || []);
          return;
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.role]);

  useEffect(() => {
    const loadStudentReference = async () => {
      if (!selectedStudentId) {
        setSelectedStudentReference(null);
        setSelectedExamResultId('');
        return;
      }

      try {
        setStudentLoading(true);
        setMessage({ type: '', text: '' });
        const response = await studentAPI.getTeacherStudentReference(selectedStudentId);
        setSelectedStudentReference(response.data);
      } catch (err) {
        setMessage({
          type: 'error',
          text: err.response?.data?.message || 'Failed to load student reference',
        });
      } finally {
        setStudentLoading(false);
      }
    };

    if (user?.role === 'teacher' || user?.role === 'admin') {
      loadStudentReference();
    }
  }, [selectedStudentId, user?.role]);

  const handleAddRemark = async () => {
    if (!selectedStudentId || !remark.trim()) return;

    try {
      const selectedExamResult = (selectedStudentReference?.examResults || []).find(
        (item) => String(item._id) === String(selectedExamResultId)
      );

      await studentAPI.addRemark(selectedStudentId, {
        remark: remark.trim(),
        examResultId: selectedExamResultId || undefined,
        examId: selectedExamResult?.exam?._id || undefined,
      });
      setMessage({ type: 'success', text: 'Remark added successfully.' });
      setRemark('');

      const response = await studentAPI.getTeacherStudentReference(selectedStudentId);
      setSelectedStudentReference(response.data);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to add remark',
      });
    }
  };

  const studentSubjectChartData = useMemo(
    () =>
      Object.entries(studentAnalytics?.subjectPerformance || {}).map(([subject, data]) => ({
        subject: getSubjectName(subject),
        averageScore: Math.round(data.averageScore || 0),
        bestScore: Math.round(data.bestScore || 0),
        worstScore: Math.round(data.worstScore || 0),
      })),
    [studentAnalytics]
  );

  const studentTimelineData = useMemo(
    () =>
      (studentAnalytics?.examTimeline || []).map((item) => ({
        exam: item.examTitle,
        percentage: item.percentage,
        subject: getSubjectName(item.subject),
      })),
    [studentAnalytics]
  );

  const studentCodingAccuracyData = useMemo(
    () =>
      studentAnalytics?.codingStats
        ? [
            { name: 'Overall', value: studentAnalytics.codingStats.codingAccuracy || 0 },
            { name: 'Visible', value: studentAnalytics.codingStats.visibleAccuracy || 0 },
            { name: 'Hidden', value: studentAnalytics.codingStats.hiddenAccuracy || 0 },
          ]
        : [],
    [studentAnalytics]
  );

  const latestStudentRecommendation = useMemo(
    () => studentAnalytics?.latestRecommendation || studentAnalytics?.analyticsSnapshot?.latestRecommendation || null,
    [studentAnalytics]
  );

  const teacherSubjectSummary = useMemo(
    () =>
      Object.entries(teacherReference?.subjectSummary || {}).map(([subject, data]) => ({
        subject: getSubjectName(subject),
        averageScore: data.averageScore || 0,
        attempts: data.attempts || 0,
      })),
    [teacherReference]
  );

  const teacherScoreDistribution = useMemo(
    () => [
      { name: 'Excellent', value: teacherReference?.scoreDistribution?.excellent || 0 },
      { name: 'Good', value: teacherReference?.scoreDistribution?.good || 0 },
      { name: 'Average', value: teacherReference?.scoreDistribution?.average || 0 },
      { name: 'Needs Support', value: teacherReference?.scoreDistribution?.needsSupport || 0 },
    ],
    [teacherReference]
  );

  const teacherLanguageSummary = useMemo(
    () => teacherReference?.codingOverview?.languageSummary || [],
    [teacherReference]
  );

  const selectedStudentTrend = useMemo(
    () =>
      (selectedStudentReference?.examResults || [])
        .map((result) => ({
          exam: result.exam?.title || 'Exam',
          percentage: result.percentage || 0,
          subject: getSubjectName(result.exam?.subject),
        }))
        .reverse(),
    [selectedStudentReference]
  );

  const selectedStudentSubjectData = useMemo(
    () =>
      Object.entries(selectedStudentReference?.analyticsSnapshot?.subjectPerformance || {}).map(
        ([subject, data]) => ({
          subject: getSubjectName(subject),
          averageScore: data.averageScore || 0,
          attempts: data.attempts || 0,
        })
      ),
    [selectedStudentReference]
  );

  const selectedExamResultOptions = useMemo(
    () =>
      (selectedStudentReference?.examResults || []).map((result) => ({
        examResultId: result._id,
        label: `${result.exam?.title || 'Exam'} (${getSubjectName(result.exam?.subject)}) - ${result.percentage || 0}%`,
      })),
    [selectedStudentReference]
  );

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading analytics...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (user?.role === 'student') {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Performance Analytics
        </Typography>

        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Average Score
                </Typography>
                <Typography variant="h4">
                  {formatPercent(studentAnalytics?.overallStats?.averageScore)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Class Comparison
                </Typography>
                <Typography variant="h4">
                  {formatPercent(studentAnalytics?.comparisonStats?.studentAverage)} / {formatPercent(studentAnalytics?.comparisonStats?.classAverage)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You vs class average
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Percentile
                </Typography>
                <Typography variant="h4">
                  {studentAnalytics?.comparisonStats?.percentile || 0}th
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rank {studentAnalytics?.comparisonStats?.rank || '-'} of {studentAnalytics?.comparisonStats?.totalStudents || '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Progress Over Time
                </Typography>
                <Box sx={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={studentTimelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="exam" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="percentage" stroke="#1976d2" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Coding Accuracy
                </Typography>
                <Box sx={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={studentCodingAccuracyData} dataKey="value" nameKey="name" outerRadius={100} label>
                        {studentCodingAccuracyData.map((entry, index) => (
                          <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Subject-wise Scores
                </Typography>
                <Box sx={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={studentSubjectChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="averageScore" fill="#1976d2" name="Average" />
                      <Bar dataKey="bestScore" fill="#2e7d32" name="Best" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Language Performance
                </Typography>
                <List dense>
                  {(studentAnalytics?.codingStats?.languagePerformance || []).map((item) => (
                    <ListItem key={item.language} disableGutters>
                      <ListItemText
                        primary={item.language}
                        secondary={`Attempts: ${item.attempts} | Accuracy: ${formatPercent(item.accuracy)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {latestStudentRecommendation && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Latest Recommendation
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1.5 }}>
                    {latestStudentRecommendation.recommendationSummary}
                  </Typography>
                  {latestStudentRecommendation.recommendationDetails?.recommendedTopics?.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                      {latestStudentRecommendation.recommendationDetails.recommendedTopics.slice(0, 5).map((topic, index) => (
                        <Chip
                          key={`latest-topic-${index}`}
                          label={formatRecommendationLabel(topic)}
                          color="secondary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Chip label={`Attempt score: ${formatPercent(latestStudentRecommendation.percentage)}`} />
                    {typeof latestStudentRecommendation.performanceMetrics?.averageExecutionTimeMs === 'number' && (
                      <Chip label={`Avg execution: ${formatMetric(latestStudentRecommendation.performanceMetrics.averageExecutionTimeMs)} ms`} />
                    )}
                    {typeof latestStudentRecommendation.performanceMetrics?.averageOptimalityScore === 'number' && (
                      <Chip label={`Optimality: ${formatMetric(latestStudentRecommendation.performanceMetrics.averageOptimalityScore, 3)}`} />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Strength Areas
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(studentAnalytics?.strengths || []).map((item) => (
                    <Chip
                      key={`strength-${item.subject}`}
                      color="success"
                      variant="outlined"
                      label={`${getSubjectName(item.subject)} (${item.averageScore}%)`}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Focus Areas
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(studentAnalytics?.weaknesses || []).map((item) => (
                    <Chip
                      key={`weakness-${item.subject}`}
                      color="warning"
                      variant="outlined"
                      label={`${getSubjectName(item.subject)} (${item.averageScore}%)`}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Teacher Analytics Reference
      </Typography>

      {message.text && (
        <Alert severity={message.type || 'info'} sx={{ mt: 2 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Total Students
              </Typography>
              <Typography variant="h4">
                {teacherReference?.overview?.totalStudents || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Completed Exams
              </Typography>
              <Typography variant="h4">
                {teacherReference?.overview?.totalCompletedExams || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Teacher Remarks Logged
              </Typography>
              <Typography variant="h4">
                {teacherReference?.overview?.totalRemarks || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Students With Recommendations
              </Typography>
              <Typography variant="h4">
                {teacherReference?.overview?.studentsWithRecommendations || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Class Subject Performance
              </Typography>
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={teacherSubjectSummary}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averageScore" fill="#1976d2" name="Average Score" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Coding Overview
                </Typography>
                <List dense>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Overall coding accuracy"
                      secondary={`${teacherReference?.codingOverview?.codingAccuracy || 0}%`}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Visible test accuracy"
                      secondary={`${teacherReference?.codingOverview?.visibleAccuracy || 0}%`}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Hidden test accuracy"
                      secondary={`${teacherReference?.codingOverview?.hiddenAccuracy || 0}%`}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Students with remarks"
                      secondary={`${teacherReference?.overview?.studentsWithRemarks || 0}`}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Students
                </Typography>
                <List dense>
                  {(teacherReference?.topStudents || []).map((student) => (
                    <ListItem key={`top-${student.studentId}`} disableGutters>
                      <ListItemText
                        primary={`${student.firstName || ''} ${student.lastName || ''}`.trim() || student.studentId}
                        secondary={`${student.studentId || 'No ID'} | Avg ${student.averageScore}%`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Needs Attention
                </Typography>
                <List dense>
                  {(teacherReference?.needsAttention || []).map((student) => (
                    <ListItem key={`attention-${student.studentId}`} disableGutters>
                      <ListItemText
                        primary={`${student.firstName || ''} ${student.lastName || ''}`.trim() || student.studentId}
                        secondary={`${student.studentId || 'No ID'} | Avg ${student.averageScore}%`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Class Score Distribution
              </Typography>
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={teacherScoreDistribution} dataKey="value" nameKey="name" outerRadius={100} label>
                      {teacherScoreDistribution.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Coding Language Usage
              </Typography>
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={teacherLanguageSummary}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="language" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="attempts" fill="#2e7d32" name="Attempts" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                <Typography variant="h6">Student Reference Workspace</Typography>
                <TextField
                  select
                  label="Select Student"
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  sx={{ minWidth: 260 }}
                >
                  {teacherStudents.map((student) => (
                    <MenuItem key={student.studentId} value={student.studentId}>
                      {student.firstName} {student.lastName} ({student.studentId})
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  component="a"
                  href={metabaseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Metabase
                </Button>
              </Stack>

              <Alert severity="info" sx={{ mt: 2 }}>
                Metabase reference URL: {metabaseUrl}
              </Alert>

              {studentLoading && (
                <Typography sx={{ mt: 2 }}>Loading student reference...</Typography>
              )}

              {selectedStudentReference && (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={12} lg={7}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1">
                          {selectedStudentReference.student.firstName} {selectedStudentReference.student.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedStudentReference.student.studentId} | {selectedStudentReference.student.department || 'Department N/A'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                          <Chip label={`Average score: ${selectedStudentReference.analyticsSnapshot?.averageScore || 0}%`} />
                          <Chip label={`Coding accuracy: ${selectedStudentReference.analyticsSnapshot?.codingAccuracy || 0}%`} />
                          <Chip label={`Total exams: ${selectedStudentReference.analyticsSnapshot?.totalExams || 0}`} />
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ width: '100%', height: 280 }}>
                          <ResponsiveContainer>
                            <LineChart data={selectedStudentTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="exam" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="percentage" stroke="#1976d2" strokeWidth={3} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} lg={5}>
                    <Stack spacing={2}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            Subject Breakdown
                          </Typography>
                          <Box sx={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer>
                              <BarChart data={selectedStudentSubjectData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="subject" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Bar dataKey="averageScore" fill="#0288d1" name="Average Score" />
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>
                        </CardContent>
                      </Card>

                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            Recommendation History
                          </Typography>
                          <List dense>
                            {(selectedStudentReference.recommendationHistory || []).slice(0, 4).map((item, index) => (
                              <ListItem key={`rec-${index}`} disableGutters>
                                <ListItemText
                                  primary={`${item.examTitle} (${getSubjectName(item.subject)})`}
                                  secondary={`${item.recommendationSummary} | Score ${formatPercent(item.percentage)}`}
                                />
                              </ListItem>
                            ))}
                            {(selectedStudentReference.recommendationHistory || []).length === 0 && (
                              <Typography variant="body2" color="text.secondary">
                                No recommendation history yet.
                              </Typography>
                            )}
                          </List>
                        </CardContent>
                      </Card>

                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            Add Teacher Remark
                          </Typography>
                          <TextField
                            select
                            fullWidth
                            sx={{ mb: 2 }}
                            label="Attach remark to exam result"
                            value={selectedExamResultId}
                            onChange={(event) => setSelectedExamResultId(event.target.value)}
                            helperText="Optional. If selected, the remark will appear on that student's exam result page."
                          >
                            <MenuItem value="">General student remark</MenuItem>
                            {selectedExamResultOptions.map((option) => (
                              <MenuItem key={option.examResultId} value={option.examResultId}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            fullWidth
                            multiline
                            rows={4}
                            value={remark}
                            onChange={(event) => setRemark(event.target.value)}
                            placeholder="Write a student-specific remark based on the analytics and recommendation history."
                          />
                          <Button variant="contained" sx={{ mt: 2 }} onClick={handleAddRemark}>
                            Save Remark
                          </Button>
                        </CardContent>
                      </Card>
                    </Stack>
                  </Grid>

                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          Existing Remarks
                        </Typography>
                        <List dense>
                          {(selectedStudentReference.remarks || []).map((item) => {
                            const teacherName = `${item.teacher?.firstName || ''} ${item.teacher?.lastName || ''}`.trim();
                            return (
                              <ListItem key={item._id} disableGutters>
                                <ListItemText
                                  primary={item.remark}
                                  secondary={`${teacherName || 'Teacher'} | ${formatDateTime(item.createdAt)}${item.examResult ? ' | Linked to exam result' : ''}`}
                                />
                              </ListItem>
                            );
                          })}
                          {(selectedStudentReference.remarks || []).length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                              No remarks added yet.
                            </Typography>
                          )}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Analytics;
