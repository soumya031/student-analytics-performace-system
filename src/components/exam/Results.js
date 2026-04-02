import React, { useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, Container, Divider, Stack, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { examAPI } from '../../utils/api';

const formatMetric = (value, digits = 2) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
};

const formatMemory = (kb) => {
  if (typeof kb !== 'number' || Number.isNaN(kb)) return null;
  if (kb >= 1024) {
    return `${formatMetric(kb / 1024)} MB`;
  }
  return `${formatMetric(kb)} KB`;
};

const formatRecommendationLabel = (value) => String(value || '').trim().replace(/\s*-\s*/g, ' - ');

const Results = () => {
  const { examId } = useParams();
  const [result, setResult] = useState(null);
  const [teacherRemarks, setTeacherRemarks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadResult = async () => {
      try {
        const res = await examAPI.getExamResult(examId);
        setResult(res.data.examResult);
        setTeacherRemarks(res.data.teacherRemarks || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load result');
      }
    };

    loadResult();
  }, [examId]);

  if (!result) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography>{error || 'Loading result...'}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4">Exam Result</Typography>

      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Chip label={`Score: ${result.score}`} color="primary" />
        <Chip label={`Percentage: ${result.percentage}%`} />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6">MCQ Summary</Typography>
      {(result.mcqAnswers || []).map((answer, index) => (
        <Typography key={`mcq-${index}`}>
          Q{index + 1}: {answer.isCorrect ? 'Correct' : 'Wrong'}
        </Typography>
      ))}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6">Coding Summary</Typography>
      {(result.codingAnswers || []).map((answer, index) => (
        <Box key={`coding-${index}`} sx={{ mb: 2 }}>
          <Typography>
            Q{index + 1}: {answer.passedCount}/{answer.totalCount} test cases passed
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visible tests passed: {answer.visiblePassedCount || 0}/{answer.visibleTotalCount || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hidden tests passed: {answer.hiddenPassedCount || 0}/{answer.hiddenTotalCount || 0}
          </Typography>
          {typeof answer.averageExecutionTimeMs === 'number' && (
            <Typography variant="body2" color="text.secondary">
              Avg execution time: {formatMetric(answer.averageExecutionTimeMs)} ms
            </Typography>
          )}
          {typeof answer.maxMemoryKb === 'number' && (
            <Typography variant="body2" color="text.secondary">
              Peak memory: {formatMemory(answer.maxMemoryKb)}
            </Typography>
          )}
          {answer.outputPerTest?.some((test) => test.stderr) && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Some sample tests returned compiler or runtime errors. Review your implementation carefully.
            </Alert>
          )}
        </Box>
      ))}

      {(result.recommendationSummary || result.recommendationDetails) && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Coding Recommendation
          </Typography>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body1">
                {result.recommendationSummary || result.recommendationDetails?.summary}
              </Typography>
            </CardContent>
          </Card>

          <Stack spacing={2}>
            {result.recommendationDetails?.strengths?.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Strengths
                  </Typography>
                  {result.recommendationDetails.strengths.map((item, index) => (
                    <Box key={`strength-${index}`} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.detail}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}

            {result.recommendationDetails?.weaknesses?.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Areas To Improve
                  </Typography>
                  {result.recommendationDetails.weaknesses.map((item, index) => (
                    <Box key={`weakness-${index}`} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.detail}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}

            {result.recommendationDetails?.recommendedTopics?.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Recommended Topics
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {result.recommendationDetails.recommendedTopics.map((topic, index) => (
                      <Chip
                        key={`topic-${index}`}
                        label={formatRecommendationLabel(topic)}
                        color="secondary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            {result.recommendationDetails?.nextPracticeSuggestion && (
              <Alert severity="info">
                {result.recommendationDetails.nextPracticeSuggestion}
              </Alert>
            )}

            {result.recommendationDetails?.modelInsights?.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Model Insights
                  </Typography>
                  {result.recommendationDetails.modelInsights.map((item, index) => (
                    <Typography key={`insight-${index}`} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {item}
                    </Typography>
                  ))}
                </CardContent>
              </Card>
            )}
          </Stack>
        </>
      )}

      {result.performanceMetrics && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Performance Metrics
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip label={`Coding accuracy: ${result.performanceMetrics.codingAccuracy || 0}%`} />
            <Chip label={`Visible accuracy: ${result.performanceMetrics.visibleAccuracy || 0}%`} />
            <Chip label={`Hidden accuracy: ${result.performanceMetrics.hiddenAccuracy || 0}%`} />
            {typeof result.performanceMetrics.averageExecutionTimeMs === 'number' && (
              <Chip label={`Avg execution: ${formatMetric(result.performanceMetrics.averageExecutionTimeMs)} ms`} />
            )}
            {typeof result.performanceMetrics.peakMemoryKb === 'number' && (
              <Chip label={`Peak memory: ${formatMemory(result.performanceMetrics.peakMemoryKb)}`} />
            )}
            {typeof result.performanceMetrics.averageOptimalityScore === 'number' && (
              <Chip label={`Optimality score: ${formatMetric(result.performanceMetrics.averageOptimalityScore, 3)}`} />
            )}
          </Box>
        </>
      )}

      {teacherRemarks.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Teacher Remarks
          </Typography>
          <Stack spacing={2}>
            {teacherRemarks.map((item) => {
              const teacherName = `${item.teacher?.firstName || ''} ${item.teacher?.lastName || ''}`.trim();
              return (
                <Card key={item._id}>
                  <CardContent>
                    <Typography variant="body1">{item.remark}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {`${teacherName || 'Teacher'} | ${new Date(item.createdAt).toLocaleString('en-IN')}`}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </>
      )}
    </Container>
  );
};

export default Results;
