import axios from 'axios';

type RecommendationItem = {
  title: string;
  detail: string;
};

type RecommendationResponse = {
  summary: string;
  strengths: RecommendationItem[];
  weaknesses: RecommendationItem[];
  recommendedTopics: string[];
  nextPracticeSuggestion: string;
  modelInsights?: string[];
  runtimeMetrics?: {
    averageExecutionTimeMs?: number;
    peakMemoryKb?: number;
    optimalityScore?: number;
    timeScore?: number;
    spaceScore?: number;
  };
};

type CodingRecommendationInput = {
  studentId: string;
  examId: string;
  examTitle: string;
  subject: string;
  timeTaken: number;
  totalPoints: number;
  score: number;
  percentage: number;
  studentHistory?: Array<{
    subject: string;
    percentage: number;
    submittedAt?: string;
  }>;
  codingQuestions: Array<{
    sectionIndex: number;
    questionIndex: number;
    language: string;
    code: string;
    passedCount: number;
    totalCount: number;
    visiblePassedCount: number;
    visibleTotalCount: number;
    hiddenPassedCount: number;
    hiddenTotalCount: number;
    pointsEarned: number;
    totalPoints: number;
    errors: string[];
    averageExecutionTimeMs?: number;
    maxMemoryKb?: number;
    optimalityScore?: number;
  }>;
};

function buildFallbackRecommendation(input: CodingRecommendationInput): RecommendationResponse {
  const codingQuestions = input.codingQuestions || [];
  const totalTests = codingQuestions.reduce((sum, item) => sum + item.totalCount, 0);
  const passedTests = codingQuestions.reduce((sum, item) => sum + item.passedCount, 0);
  const visibleTotal = codingQuestions.reduce((sum, item) => sum + item.visibleTotalCount, 0);
  const visiblePassed = codingQuestions.reduce((sum, item) => sum + item.visiblePassedCount, 0);
  const hiddenTotal = codingQuestions.reduce((sum, item) => sum + item.hiddenTotalCount, 0);
  const hiddenPassed = codingQuestions.reduce((sum, item) => sum + item.hiddenPassedCount, 0);
  const uniqueLanguages = [...new Set(codingQuestions.map((item) => item.language).filter(Boolean))];
  const compileErrors = codingQuestions.flatMap((item) => item.errors || []).filter(Boolean);

  const strengths: RecommendationItem[] = [];
  const weaknesses: RecommendationItem[] = [];
  const recommendedTopics = new Set<string>();

  if (passedTests === totalTests && totalTests > 0) {
    strengths.push({
      title: 'Correctness',
      detail: 'All coding test cases passed, which shows strong problem-solving accuracy.'
    });
  } else if (passedTests / Math.max(totalTests, 1) >= 0.7) {
    strengths.push({
      title: 'Partial correctness',
      detail: 'Most coding tests passed. Your solutions are close and need targeted refinement.'
    });
  } else {
    weaknesses.push({
      title: 'Core logic gaps',
      detail: 'Several coding test cases failed. Recheck edge cases, loops, and condition handling.'
    });
    recommendedTopics.add('problem decomposition');
    recommendedTopics.add('edge case testing');
  }

  if (visibleTotal > 0 && visiblePassed < visibleTotal) {
    weaknesses.push({
      title: 'Sample test alignment',
      detail: 'Some visible test cases failed, so start by matching your code with sample inputs and outputs.'
    });
    recommendedTopics.add('input/output tracing');
  }

  if (hiddenTotal > 0 && hiddenPassed < hiddenTotal) {
    weaknesses.push({
      title: 'Hidden test robustness',
      detail: 'Hidden tests failed more often than visible ones, which suggests edge cases or robustness issues.'
    });
    recommendedTopics.add('boundary conditions');
    recommendedTopics.add('defensive coding');
  }

  if (compileErrors.length > 0) {
    weaknesses.push({
      title: 'Debugging discipline',
      detail: 'Compilation or runtime errors were detected. Focus on syntax checking and incremental debugging.'
    });
    recommendedTopics.add('syntax debugging');
    recommendedTopics.add('runtime error handling');
  }

  if (input.timeTaken > 0 && input.percentage >= 80) {
    strengths.push({
      title: 'Exam pacing',
      detail: 'You maintained strong performance within the exam time window.'
    });
  } else if (input.timeTaken > 0 && input.percentage < 50) {
    weaknesses.push({
      title: 'Time efficiency',
      detail: 'Your score suggests you may benefit from more structured practice under time limits.'
    });
    recommendedTopics.add('timed practice');
  }

  if (uniqueLanguages.length > 0) {
    strengths.push({
      title: 'Language usage',
      detail: `You attempted coding in ${uniqueLanguages.join(', ')}, which helps build language-specific confidence.`
    });
  }

  const summary =
    weaknesses.length === 0
      ? 'Strong coding performance. Keep practicing optimization and clean problem-solving patterns.'
      : 'Your coding performance shows promise, but you should focus on failed test patterns, edge cases, and debugging discipline.';

  return {
    summary,
    strengths,
    weaknesses,
    recommendedTopics: Array.from(recommendedTopics),
    nextPracticeSuggestion:
      Array.from(recommendedTopics)[0]
      ? `Next, practice ${Array.from(recommendedTopics)[0]} with 2-3 timed coding problems.`
      : 'Next, try one harder coding problem and compare multiple solution approaches.',
    modelInsights: [],
  };
}

export async function generateCodingRecommendation(input: CodingRecommendationInput): Promise<RecommendationResponse> {
  const fallback = buildFallbackRecommendation(input);
  const baseUrl = process.env.PYTHON_RECOMMENDER_URL;

  if (!baseUrl) {
    return fallback;
  }

  try {
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/recommend`,
      input,
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const data = response.data || {};
    return {
      summary: data.summary || fallback.summary,
      strengths: Array.isArray(data.strengths) ? data.strengths : fallback.strengths,
      weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : fallback.weaknesses,
      recommendedTopics: Array.isArray(data.recommendedTopics)
        ? data.recommendedTopics
        : fallback.recommendedTopics,
      nextPracticeSuggestion: data.nextPracticeSuggestion || fallback.nextPracticeSuggestion,
      modelInsights: [
        ...(Array.isArray(data.modelInsights) ? data.modelInsights : fallback.modelInsights || []),
        ...(data.model_loaded === false && data.model_error
          ? [`Model bundle warning: ${String(data.model_error)}`]
          : []),
      ],
      runtimeMetrics: data.runtimeMetrics && typeof data.runtimeMetrics === 'object'
        ? data.runtimeMetrics
        : undefined,
    };
  } catch (error) {
    return fallback;
  }
}
