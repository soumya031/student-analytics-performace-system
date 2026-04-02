from flask import Flask, request, jsonify
from flask_cors import CORS
import pymongo
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import NMF
from sklearn.feature_extraction.text import TfidfVectorizer
import base64
import io
import os
from dotenv import load_dotenv
import json
from datetime import datetime
import logging
from typing import Optional, List, Dict, Any
import time
import psutil
import math
import pickle
import os
import re
import sys
import types
from main import analyze_submission as analyze_recommendation_submission
from main import RECOMMENDER_BUNDLE as MAIN_RECOMMENDER_BUNDLE
from main import SOLUTIONS_DF as MAIN_SOLUTIONS_DF
from main import USER_RATINGS_DF as MAIN_USER_RATINGS_DF
from main import SOLUTION_SIMILARITY_DF as MAIN_SOLUTION_SIMILARITY_DF
from main import USER_SIMILARITY_DF as MAIN_USER_SIMILARITY_DF
from main import PARAMS as MAIN_PARAMS
from main import T_OPT as MAIN_T_OPT
from main import M_OPT as MAIN_M_OPT
from main import ALPHA as MAIN_ALPHA
from main import BETA as MAIN_BETA
from main import W_TIME as MAIN_W_TIME
from main import W_SPACE as MAIN_W_SPACE
from main import MODEL_LOAD_ERROR as MAIN_MODEL_LOAD_ERROR
from main import get_bundle_metadata as get_recommendation_bundle_metadata
from main import get_model_status as get_recommendation_model_status

try:
    import face_recognition
except Exception:
    face_recognition = None

try:
    import cv2
except Exception:
    cv2 = None

try:
    from PIL import Image
except Exception:
    Image = None

# Recommendation bundle is loaded centrally in main.py for the live submission flow.
recommender_bundle = MAIN_RECOMMENDER_BUNDLE
MODEL_LOAD_ERROR = MAIN_MODEL_LOAD_ERROR
solutions_df = MAIN_SOLUTIONS_DF
user_ratings_df = MAIN_USER_RATINGS_DF
solution_similarity_df_conceptual = MAIN_SOLUTION_SIMILARITY_DF
user_similarity_df_conceptual = MAIN_USER_SIMILARITY_DF
params = MAIN_PARAMS
T_opt = MAIN_T_OPT
M_opt = MAIN_M_OPT
alpha = MAIN_ALPHA
beta = MAIN_BETA
W_time = MAIN_W_TIME
W_space = MAIN_W_SPACE

def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("_", " ").replace("-", " ")).strip().lower()


def tokenize(value: Any) -> List[str]:
    normalized = normalize_text(value)
    return [token for token in re.split(r"[^a-z0-9]+", normalized) if token]


def safe_number(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def dedupe(items: List[str]) -> List[str]:
    seen = set()
    result = []
    for item in items:
        normalized = normalize_text(item)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(str(item).strip())
    return result


def add_weighted_score(score_map: Dict[str, float], topic: str, weight: float):
    normalized_topic = str(topic or "").strip()
    if not normalized_topic:
        return
    score_map[normalized_topic] = score_map.get(normalized_topic, 0.0) + float(weight)


def map_subject_to_topics(subject: str) -> List[str]:
    subject_key = normalize_text(subject)
    subject_topics = {
        "dsa": ["arrays and strings", "sorting and searching", "hashing", "dynamic programming"],
        "aptitude": ["quantitative reasoning", "logical reasoning", "timed practice", "accuracy improvement"],
        "computer science": ["operating systems", "dbms", "networks", "oops revision"],
        "computer science fundamentals": ["operating systems", "dbms", "networks", "oops revision"],
    }
    return subject_topics.get(subject_key, [f"{subject_key} revision"] if subject_key else [])


def collect_runtime_metrics(coding_questions: List[Dict[str, Any]]) -> Dict[str, float]:
    time_values = [safe_number(q.get("averageExecutionTimeMs")) for q in coding_questions if q.get("averageExecutionTimeMs") is not None]
    memory_values = [safe_number(q.get("maxMemoryKb")) for q in coding_questions if q.get("maxMemoryKb") is not None]

    avg_time = float(np.mean(time_values)) if time_values else 0.0
    peak_memory = float(np.max(memory_values)) if memory_values else 0.0
    analysis = perf_analyzer.analyze_submission(
        safe_number(T_opt, 1.0),
        safe_number(M_opt, 1.0),
        avg_time or safe_number(T_opt, 1.0),
        peak_memory or safe_number(M_opt, 1.0),
        safe_number(alpha, 0.5),
        safe_number(beta, 0.5),
        safe_number(W_time, 0.6),
        safe_number(W_space, 0.4),
    )

    return {
        "averageExecutionTimeMs": round(avg_time, 2) if avg_time else 0.0,
        "peakMemoryKb": round(peak_memory, 2) if peak_memory else 0.0,
        "optimalityScore": round(safe_number(analysis.get("optimality_score")), 3),
        "timeScore": round(safe_number(analysis.get("time_score")), 3),
        "spaceScore": round(safe_number(analysis.get("space_score")), 3),
    }


def build_submission_signal_profile(payload: Dict[str, Any]) -> Dict[str, Any]:
    coding_questions = payload.get("codingQuestions", []) or []
    time_taken = safe_number(payload.get("timeTaken"))
    percentage = safe_number(payload.get("percentage"))

    strengths = []
    weaknesses = []
    topic_scores: Dict[str, float] = {}

    def add_topic(topic: str, weight: float):
        topic_scores[topic] = topic_scores.get(topic, 0.0) + weight

    total_tests = sum(safe_number(q.get("totalCount")) for q in coding_questions)
    passed_tests = sum(safe_number(q.get("passedCount")) for q in coding_questions)
    visible_total = sum(safe_number(q.get("visibleTotalCount")) for q in coding_questions)
    visible_passed = sum(safe_number(q.get("visiblePassedCount")) for q in coding_questions)
    hidden_total = sum(safe_number(q.get("hiddenTotalCount")) for q in coding_questions)
    hidden_passed = sum(safe_number(q.get("hiddenPassedCount")) for q in coding_questions)
    errors = [err for q in coding_questions for err in (q.get("errors", []) or []) if err]
    languages = dedupe([q.get("language", "") for q in coding_questions if q.get("language")])
    runtime_metrics = collect_runtime_metrics(coding_questions)

    if total_tests > 0 and passed_tests == total_tests:
        strengths.append({
            "title": "Correctness",
            "detail": "All coding tests passed. Your implementation is functionally strong."
        })
    elif total_tests > 0 and (passed_tests / max(total_tests, 1)) >= 0.7:
        strengths.append({
            "title": "Near-complete solutions",
            "detail": "Most coding tests passed. The remaining gaps look concentrated rather than broad."
        })
        add_topic("edge case testing", 1.5)
    else:
        weaknesses.append({
            "title": "Core coding logic",
            "detail": "Several coding tests failed. Review logic decomposition and validate branches with small manual traces."
        })
        add_topic("problem decomposition", 2.5)
        add_topic("edge case testing", 2.0)

    if visible_total > 0 and visible_passed < visible_total:
        weaknesses.append({
            "title": "Sample-case mismatch",
            "detail": "Visible tests are failing, which usually points to input parsing, output formatting, or an early logic mismatch."
        })
        add_topic("input/output tracing", 2.3)

    if hidden_total > 0 and hidden_passed < hidden_total:
        weaknesses.append({
            "title": "Hidden-case robustness",
            "detail": "Hidden tests failed more than visible tests. Strengthen boundary checks, empty-state handling, and larger-case robustness."
        })
        add_topic("boundary conditions", 2.6)
        add_topic("defensive coding", 2.2)

    if errors:
        weaknesses.append({
            "title": "Debugging discipline",
            "detail": "Compilation or runtime errors were detected. Validate syntax, data types, and small intermediate runs before full submission."
        })
        add_topic("syntax debugging", 2.4)
        add_topic("runtime debugging", 2.4)

    if percentage >= 80:
        strengths.append({
            "title": "Overall exam performance",
            "detail": "Your overall score indicates strong command of the assessed material."
        })
    elif percentage < 50:
        weaknesses.append({
            "title": "Assessment consistency",
            "detail": "This score suggests you would benefit from more deliberate timed practice and revision."
        })
        add_topic("timed practice", 2.0)

    if languages:
        strengths.append({
            "title": "Language familiarity",
            "detail": f"You attempted coding in {', '.join(languages)}, which is useful for implementation confidence."
        })

    if runtime_metrics["optimalityScore"] < 0.65:
        weaknesses.append({
            "title": "Runtime efficiency",
            "detail": "The measured execution profile is weaker than the model's reference optimum, so optimization work should follow correctness fixes."
        })
        add_topic("time complexity optimization", 1.8)
        add_topic("memory optimization", 1.2)
    else:
        strengths.append({
            "title": "Execution profile",
            "detail": "Your execution and memory profile is reasonably close to the model reference baseline."
        })

    for topic in map_subject_to_topics(payload.get("subject", "")):
        add_topic(topic, 0.8)

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "topicScores": topic_scores,
        "runtimeMetrics": runtime_metrics,
        "languages": languages,
        "percentage": percentage,
    }


def extract_history_profile(payload: Dict[str, Any]) -> Dict[str, float]:
    history = payload.get("studentHistory", []) or []
    subject_scores: Dict[str, List[float]] = {}
    for item in history:
        subject = normalize_text(item.get("subject"))
        if not subject:
            continue
        subject_scores.setdefault(subject, []).append(safe_number(item.get("percentage")))

    return {
        subject: float(np.mean(scores))
        for subject, scores in subject_scores.items() if scores
    }


def extract_model_topic_candidates(payload: Dict[str, Any], limit: int = 12) -> List[str]:
    if not isinstance(solutions_df, pd.DataFrame) or solutions_df.empty:
        return []

    subject = normalize_text(payload.get("subject"))
    languages = {
        normalize_text(question.get("language"))
        for question in (payload.get("codingQuestions", []) or [])
        if question.get("language")
    }
    filtered_df = solutions_df.copy()

    if subject and "subject" in filtered_df.columns:
        subject_mask = filtered_df["subject"].astype(str).map(normalize_text) == subject
        if subject_mask.any():
            filtered_df = filtered_df[subject_mask]

    for language_column in ["language", "programming_language", "lang"]:
        if languages and language_column in filtered_df.columns:
            language_mask = filtered_df[language_column].astype(str).map(normalize_text).isin(languages)
            if language_mask.any():
                filtered_df = filtered_df[language_mask]
                break

    candidates: List[str] = []
    for column in ["topic", "topics", "tag", "tags", "category", "categories", "title", "problem_title"]:
        if column not in filtered_df.columns:
            continue
        for value in filtered_df[column].dropna().astype(str).head(40):
            parts = [part.strip() for part in re.split(r"[|,/;]", value) if part.strip()]
            candidates.extend(parts)

    return dedupe(candidates)[:limit]


def build_model_score_profile(payload: Dict[str, Any], history_profile: Dict[str, float]) -> Dict[str, Any]:
    score_map: Dict[str, float] = {}
    insights: List[str] = []
    seed_topics = extract_model_topic_candidates(payload)

    for index, topic in enumerate(seed_topics):
        add_weighted_score(score_map, topic, max(0.9, 2.4 - (index * 0.12)))

    for related_topic in infer_similarity_topics(seed_topics, max_items=8):
        add_weighted_score(score_map, related_topic, 1.8)

    student_id = str(payload.get("studentId", "") or "").strip()
    if isinstance(user_similarity_df_conceptual, pd.DataFrame) and student_id and student_id in user_similarity_df_conceptual.index:
        similar_users = (
            user_similarity_df_conceptual[student_id]
            .sort_values(ascending=False)
            .drop(labels=[student_id], errors="ignore")
            .head(5)
        )
        if not similar_users.empty:
            mean_similarity = float(similar_users.mean())
            for subject, average_score in history_profile.items():
                if average_score < 75:
                    for topic in map_subject_to_topics(subject):
                        add_weighted_score(score_map, topic, 2.0 + mean_similarity)
            insights.append(
                f"Trained similarity model contributed peer-pattern weights from {len(similar_users)} similar learners."
            )

    if isinstance(user_ratings_df, pd.DataFrame) and not user_ratings_df.empty:
        ratings_df = user_ratings_df.copy()
        normalized_columns = {normalize_text(column): column for column in ratings_df.columns}

        student_column = normalized_columns.get("student_id") or normalized_columns.get("studentid") or normalized_columns.get("user_id")
        subject_column = normalized_columns.get("subject")
        topic_column = normalized_columns.get("topic") or normalized_columns.get("topics") or normalized_columns.get("category")
        rating_column = normalized_columns.get("rating") or normalized_columns.get("score")

        if student_column and topic_column and rating_column:
            student_rows = ratings_df[ratings_df[student_column].astype(str) == student_id]
            if subject_column and payload.get("subject"):
                narrowed_rows = student_rows[
                    student_rows[subject_column].astype(str).map(normalize_text) == normalize_text(payload.get("subject"))
                ]
                if not narrowed_rows.empty:
                    student_rows = narrowed_rows

            if not student_rows.empty:
                aggregated = (
                    student_rows.groupby(topic_column)[rating_column]
                    .mean()
                    .sort_values(ascending=True)
                    .head(8)
                )
                max_rating = max(float(aggregated.max()), 1.0) if not aggregated.empty else 1.0
                for topic, rating_value in aggregated.items():
                    difficulty_gap = 1.0 - (safe_number(rating_value) / max_rating)
                    add_weighted_score(score_map, str(topic), 2.6 + max(0.0, difficulty_gap))
                if not aggregated.empty:
                    insights.append("Student-specific trained ratings were used as the primary weakness signal.")

    if history_profile:
        weakest_subject = min(history_profile.items(), key=lambda item: item[1])
        for topic in map_subject_to_topics(weakest_subject[0]):
            add_weighted_score(score_map, topic, 1.7)
        insights.append(
            f"Historical model weighting emphasized {weakest_subject[0].title()} because it is the weakest prior subject."
        )

    return {
        "topicScores": score_map,
        "seedTopics": seed_topics,
        "insights": dedupe(insights),
    }


def infer_similarity_topics(seed_terms: List[str], max_items: int = 5) -> List[str]:
    if not isinstance(solution_similarity_df_conceptual, pd.DataFrame) or solution_similarity_df_conceptual.empty:
        return []

    scores: Dict[str, float] = {}
    normalized_index = {normalize_text(label): label for label in solution_similarity_df_conceptual.index}

    for term in seed_terms:
        normalized = normalize_text(term)
        label = normalized_index.get(normalized)
        if label is None:
            matching_labels = [
                original for norm, original in normalized_index.items()
                if normalized and (normalized in norm or norm in normalized)
            ]
            label = matching_labels[0] if matching_labels else None
        if label is None:
            continue

        row = solution_similarity_df_conceptual.loc[label].sort_values(ascending=False).head(max_items + 1)
        for related_label, related_score in row.items():
            if normalize_text(related_label) == normalized:
                continue
            scores[str(related_label)] = max(scores.get(str(related_label), 0.0), safe_number(related_score))

    return [item[0] for item in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:max_items]]


def extract_content_recommendations(payload: Dict[str, Any], seed_topics: List[str]) -> List[str]:
    if not isinstance(solutions_df, pd.DataFrame) or solutions_df.empty:
        return []

    matching_df = solutions_df.copy()
    subject = normalize_text(payload.get("subject"))
    languages = {normalize_text(q.get("language")) for q in (payload.get("codingQuestions", []) or []) if q.get("language")}

    if subject and "subject" in matching_df.columns:
        filtered = matching_df[matching_df["subject"].astype(str).str.lower().map(normalize_text) == subject]
        if not filtered.empty:
            matching_df = filtered

    for language_column in ["language", "programming_language", "lang"]:
        if languages and language_column in matching_df.columns:
            filtered = matching_df[matching_df[language_column].astype(str).str.lower().map(normalize_text).isin(languages)]
            if not filtered.empty:
                matching_df = filtered
                break

    candidate_columns = [
        "topic", "topics", "tag", "tags", "category", "categories",
        "title", "problem_title", "difficulty"
    ]
    scores: Dict[str, float] = {}
    seed_tokens = set(token for topic in seed_topics for token in tokenize(topic))

    for column in candidate_columns:
        if column not in matching_df.columns:
            continue

        for value in matching_df[column].dropna().astype(str).head(25):
            for raw_item in re.split(r"[|,/;]", value):
                candidate = raw_item.strip()
                if not candidate:
                    continue
                overlap = len(seed_tokens.intersection(tokenize(candidate)))
                base_score = 1.0 + (0.4 * overlap)
                scores[candidate] = max(scores.get(candidate, 0.0), base_score)

    for related_topic in infer_similarity_topics(seed_topics):
        scores[related_topic] = max(scores.get(related_topic, 0.0), 1.1)

    return [item[0] for item in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:6]]


def extract_collaborative_signals(payload: Dict[str, Any], history_profile: Dict[str, float]) -> Dict[str, Any]:
    insights = []
    collaborative_topics: Dict[str, float] = {}
    student_id = str(payload.get("studentId", "") or "").strip()

    weakest_subjects = sorted(history_profile.items(), key=lambda item: item[1])[:2]
    for subject, average_score in weakest_subjects:
        if average_score < 70:
            for topic in map_subject_to_topics(subject):
                collaborative_topics[topic] = collaborative_topics.get(topic, 0.0) + 1.2
            insights.append(
                f"Recent history shows {subject.title()} is still below target at about {round(average_score)} percent, so the recommendation weight was increased there."
            )

    try:
        if isinstance(user_similarity_df_conceptual, pd.DataFrame) and student_id and student_id in user_similarity_df_conceptual.index:
            similar_users = (
                user_similarity_df_conceptual[student_id]
                .sort_values(ascending=False)
                .drop(labels=[student_id], errors="ignore")
                .head(3)
            )
            if not similar_users.empty:
                mean_similarity = similar_users.mean()
                insights.append(
                    f"The collaborative model found {len(similar_users)} similar learner profiles and used them as an extra weighting signal."
                )
                if mean_similarity >= 0.5:
                    collaborative_topics["targeted revision from similar profiles"] = max(
                        collaborative_topics.get("targeted revision from similar profiles", 0.0),
                        1.0,
                    )
    except Exception as model_error:
        logger.warning(f"Collaborative signal extraction skipped: {model_error}")

    return {
        "topics": collaborative_topics,
        "insights": insights,
    }


def extract_model_insights(payload: Dict[str, Any], seed_topics: List[str], runtime_metrics: Dict[str, float], history_profile: Dict[str, float]) -> List[str]:
    insights = []

    if runtime_metrics.get("optimalityScore", 0) > 0:
        insights.append(
            f"Hybrid model optimality score: {runtime_metrics['optimalityScore']:.2f} using time weight {safe_number(W_time, 0.6):.2f} and space weight {safe_number(W_space, 0.4):.2f}."
        )

    content_topics = extract_content_recommendations(payload, seed_topics)
    if content_topics:
        insights.append(
            f"Content model matches for this submission include: {', '.join(content_topics[:3])}."
        )

    if history_profile:
        weakest_subject = min(history_profile.items(), key=lambda item: item[1])
        insights.append(
            f"Student history weighting used {weakest_subject[0].title()} as the weakest prior subject signal at about {round(weakest_subject[1])} percent."
        )

    return dedupe(insights)


def build_hybrid_recommendation(payload: Dict[str, Any]) -> Dict[str, Any]:
    signal_profile = build_submission_signal_profile(payload)
    history_profile = extract_history_profile(payload)
    collaborative = extract_collaborative_signals(payload, history_profile)
    model_profile = build_model_score_profile(payload, history_profile)

    combined_topic_scores: Dict[str, float] = {}

    for topic, score in model_profile["topicScores"].items():
        add_weighted_score(combined_topic_scores, topic, score * 0.72)

    for topic, score in collaborative["topics"].items():
        add_weighted_score(combined_topic_scores, topic, score * 0.18)

    for topic, score in signal_profile["topicScores"].items():
        add_weighted_score(combined_topic_scores, topic, score * 0.10)

    content_topics = extract_content_recommendations(payload, list(model_profile["seedTopics"]) or list(combined_topic_scores.keys()))
    for index, topic in enumerate(content_topics):
        add_weighted_score(combined_topic_scores, topic, max(0.4, 1.0 - (index * 0.1)))

    sorted_topics = [
        topic for topic, _score in sorted(combined_topic_scores.items(), key=lambda item: item[1], reverse=True)
    ]
    recommended_topics = dedupe(sorted_topics)[:6]

    model_insights = extract_model_insights(
        payload,
        recommended_topics,
        signal_profile["runtimeMetrics"],
        history_profile,
    )
    model_insights.extend(model_profile["insights"])
    model_insights.extend(collaborative["insights"])
    model_insights = dedupe(model_insights)

    weaknesses = signal_profile["weaknesses"]
    strengths = signal_profile["strengths"]
    percentage = signal_profile["percentage"]

    if not weaknesses and percentage >= 80:
        summary = "Strong coding performance. The trained recommendation model still suggests moving to harder related patterns and cleaner optimization work."
    else:
        summary = "Your submission recommendation is primarily model-driven, with the trained engine weighting learned topic patterns first and using submission heuristics only as supporting evidence."

    primary_topic = recommended_topics[0] if recommended_topics else "mixed revision"
    next_practice = (
        f"Practice 2-3 {primary_topic} problems next, then reattempt one timed question in the same subject."
    )

    return {
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendedTopics": recommended_topics,
        "nextPracticeSuggestion": next_practice,
        "modelInsights": model_insights,
        "runtimeMetrics": signal_profile["runtimeMetrics"],
        "modelDriven": True,
    }

# Load environment variables

load_dotenv()

app = Flask(__name__)
CORS(app)

# ROOT ROUTE

@app.route("/", methods=["GET"])
def root():
    try:
        model_status = get_recommendation_model_status()
        bundle_metadata = get_recommendation_bundle_metadata()
        return {
            "status": "running",
            "message": "Student Performance Hybrid Recommender API",
            "model_loaded": model_status["model_loaded"],
            "model_error": model_status["model_error"],
            "available_keys": bundle_metadata["available_keys"],
            "total_solutions": bundle_metadata["total_solutions"],
            "total_user_ratings": bundle_metadata["total_user_ratings"]
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }, 500

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
db = None
try:
    client = pymongo.MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
    db = client['student_analytics']
    logger.info("Connected to MongoDB")
except Exception as e:
    logger.error(f"MongoDB connection error: {e}")

class CollaborativeFiltering:
    def __init__(self):
        self.user_item_matrix: Optional[pd.DataFrame] = None
        self.user_similarity_matrix: Optional[np.ndarray] = None
        self.item_similarity_matrix: Optional[np.ndarray] = None
        self.nmf_model: Optional[NMF] = None
        self.user_similarity_df: Optional[pd.DataFrame] = None
        
    def create_user_item_matrix(self, exam_results: List[Dict[str, Any]]) -> Optional[pd.DataFrame]:
        """Create user-item matrix from exam results"""
        if not exam_results:
            return None
            
        # Create DataFrame from exam results
        data = []
        for result in exam_results:
            if 'exam' in result and 'subject' in result['exam']:
                data.append({
                    'student_id': str(result['student']),
                    'subject': result['exam']['subject'],
                    'score': result['percentage']
                })
        
        if not data:
            return None
            
        df = pd.DataFrame(data)
        
        # Create pivot table
        self.user_item_matrix = df.pivot_table(
            index='student_id', 
            columns='subject', 
            values='score', 
            fill_value=0
        )
        
        return self.user_item_matrix
    
    def calculate_user_similarity(self) -> Optional[np.ndarray]:
        """Calculate user similarity matrix using cosine similarity"""
        if self.user_item_matrix is None:
            return None
            
        similarity = cosine_similarity(self.user_item_matrix)
        self.user_similarity_matrix = similarity
        
        # Also create a DataFrame version for easier access
        self.user_similarity_df = pd.DataFrame(
            similarity,
            index=self.user_item_matrix.index,
            columns=self.user_item_matrix.index
        )
        
        return self.user_similarity_matrix
    
    def calculate_item_similarity(self) -> Optional[np.ndarray]:
        """Calculate item similarity matrix using cosine similarity"""
        if self.user_item_matrix is None:
            return None
            
        self.item_similarity_matrix = cosine_similarity(self.user_item_matrix.T)
        return self.item_similarity_matrix
    
    def fit_nmf(self, n_components: int = 10) -> Optional[NMF]:
        """Fit Non-negative Matrix Factorization model"""
        if self.user_item_matrix is None:
            return None
            
        self.nmf_model = NMF(n_components=n_components, random_state=42)
        self.nmf_model.fit(self.user_item_matrix)
        return self.nmf_model
    
    def get_user_recommendations(self, user_id: str, n_recommendations: int = 5) -> List[Dict[str, Any]]:
        """Get collaborative filtering recommendations for a user"""
        if (self.user_item_matrix is None or 
            self.user_similarity_matrix is None or
            user_id not in self.user_item_matrix.index):
            return []
        
        # Get user's current scores
        user_scores = self.user_item_matrix.loc[user_id]
        
        # Find similar users
        user_idx = self.user_item_matrix.index.get_loc(user_id)
        similar_users = self.user_similarity_matrix[user_idx]
        
        # Get top similar users (excluding self)
        similar_user_indices = np.argsort(similar_users)[::-1][1:6]
        if len(similar_user_indices) == 0:
            return []
            
        similar_users_scores = self.user_item_matrix.iloc[similar_user_indices]
        
        # Calculate weighted average scores
        weights = similar_users[similar_user_indices]
        if weights.sum() == 0:
            return []
            
        weighted_scores = (similar_users_scores.T * weights).T.sum() / weights.sum()
        
        # Find subjects where user has low scores but similar users have high scores
        recommendations = []
        for subject in self.user_item_matrix.columns:
            if user_scores[subject] < 70 and weighted_scores[subject] > 80:
                recommendations.append({
                    'subject': subject,
                    'predicted_score': float(weighted_scores[subject]),
                    'current_score': float(user_scores[subject]),
                    'improvement_potential': float(weighted_scores[subject] - user_scores[subject]),
                    'type': 'collaborative'
                })
        
        # Sort by improvement potential
        recommendations.sort(key=lambda x: x['improvement_potential'], reverse=True)
        return recommendations[:n_recommendations]
    
    def get_similar_students(self, user_id: str, n_students: int = 5) -> List[Dict[str, Any]]:
        """Get similar students to a given user"""
        if self.user_similarity_df is None or user_id not in self.user_similarity_df.index:
            return []
        
        similar_users = self.user_similarity_df[user_id].sort_values(ascending=False)
        similar_users = similar_users[similar_users.index != user_id]
        
        result = []
        for student_id, similarity_score in similar_users.head(n_students).items():
            result.append({
                'student_id': student_id,
                'similarity_score': float(similarity_score)
            })
        
        return result


class ContentBasedFiltering:
    def __init__(self):
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix: Optional[np.ndarray] = None
        self.item_similarity_df: Optional[pd.DataFrame] = None
        self.item_metadata_df: Optional[pd.DataFrame] = None
        
    def prepare_items(self, items: List[Dict[str, Any]]) -> Optional[pd.DataFrame]:
        """Prepare item metadata from exam/subject data"""
        if not items:
            return None
            
        self.item_metadata_df = pd.DataFrame(items)
        
        if 'features_combined' not in self.item_metadata_df.columns:
            # Combine available features for similarity calculation
            if 'subject' in self.item_metadata_df.columns:
                features = self.item_metadata_df['subject'].astype(str)
                if 'description' in self.item_metadata_df.columns:
                    features = features + ' ' + self.item_metadata_df['description'].astype(str)
                self.item_metadata_df['features_combined'] = features
            else:
                return None
        
        return self.item_metadata_df
    
    def calculate_item_similarities(self) -> Optional[pd.DataFrame]:
        """Calculate item-item similarity using TF-IDF"""
        if self.item_metadata_df is None or 'features_combined' not in self.item_metadata_df.columns:
            return None
        
        try:
            self.tfidf_vectorizer = TfidfVectorizer(stop_words='english', max_features=100)
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.item_metadata_df['features_combined'])
            
            cosine_sim = cosine_similarity(self.tfidf_matrix, self.tfidf_matrix)
            
            item_ids = self.item_metadata_df.get('subject', range(len(self.item_metadata_df))).values
            self.item_similarity_df = pd.DataFrame(
                cosine_sim,
                index=item_ids,
                columns=item_ids
            )
            
            return self.item_similarity_df
        except Exception as e:
            logger.error(f"Error calculating item similarities: {e}")
            return None
    
    def get_content_based_recommendations(self, user_profile: Dict[str, float], n_recommendations: int = 5) -> List[Dict[str, Any]]:
        """Get content-based recommendations based on user profile"""
        if self.item_similarity_df is None or self.item_metadata_df is None:
            return []
        
        recommendations = {}
        
        # For each highly rated item by user, find similar items
        for item, rating in user_profile.items():
            if rating >= 4 and item in self.item_similarity_df.index:
                similar_items = self.item_similarity_df[item].sort_values(ascending=False)
                
                for sim_item, sim_score in similar_items.items():
                    if sim_item not in user_profile:  # Exclude already rated items
                        recommendations[sim_item] = recommendations.get(sim_item, 0) + sim_score * rating
        
        # Sort and return top recommendations
        sorted_recs = sorted(recommendations.items(), key=lambda x: x[1], reverse=True)
        
        result = []
        for item_id, score in sorted_recs[:n_recommendations]:
            result.append({
                'subject': item_id,
                'recommendation_score': float(score),
                'type': 'content_based'
            })
        
        return result


class PerformanceOptimizationAnalyzer:
    """Analyzer for code optimization metrics (from notebook)"""
    
    @staticmethod
    def calculate_s_time(T_opt: float, T_sub: float, alpha: float = 0.5) -> float:
        """Calculate time score (S_time)"""
        if T_sub == 0:
            return 0.0 if T_opt > 0 else 1.0
        return min(1.0, (T_opt / T_sub) ** alpha)
    
    @staticmethod
    def calculate_s_space(M_opt: float, M_sub: float, beta: float = 0.5) -> float:
        """Calculate space score (S_space)"""
        if M_sub == 0:
            return 0.0 if M_opt > 0 else 1.0
        return min(1.0, (M_opt / M_sub) ** beta)
    
    @staticmethod
    def calculate_overall_score(S_time: float, S_space: float, W_time: float = 0.6, W_space: float = 0.4) -> float:
        """Calculate overall optimality score"""
        return (W_time * S_time) + (W_space * S_space)
    
    @staticmethod
    def analyze_submission(T_opt: float, M_opt: float, T_sub: float, M_sub: float, 
                          alpha: float = 0.5, beta: float = 0.5, 
                          W_time: float = 0.6, W_space: float = 0.4) -> Dict[str, Any]:
        """Analyze code submission performance"""
        S_time = PerformanceOptimizationAnalyzer.calculate_s_time(T_opt, T_sub, alpha)
        S_space = PerformanceOptimizationAnalyzer.calculate_s_space(M_opt, M_sub, beta)
        OS = PerformanceOptimizationAnalyzer.calculate_overall_score(S_time, S_space, W_time, W_space)
        
        return {
            'time_score': S_time,
            'space_score': S_space,
            'optimality_score': OS,
            'submitted_time': T_sub,
            'submitted_memory': M_sub,
            'optimal_time': T_opt,
            'optimal_memory': M_opt
        }
    def get_user_recommendations(self, user_id: str, n_recommendations: int = 5) -> List[Dict[str, Any]]:
        """Get personalized recommendations for a user"""
        if (self.user_item_matrix is None or 
            self.user_similarity_matrix is None or 
            user_id not in self.user_item_matrix.index):
            return []
        
        # Get user's current scores
        user_scores = self.user_item_matrix.loc[user_id]
        
        # Find similar users
        user_idx = self.user_item_matrix.index.get_loc(user_id)
        similar_users = self.user_similarity_matrix[user_idx]
        
        # Get top similar users (excluding self)
        similar_user_indices = np.argsort(similar_users)[::-1][1:6]
        similar_users_scores = self.user_item_matrix.iloc[similar_user_indices]
        
        # Calculate weighted average scores
        weights = similar_users[similar_user_indices]
        weighted_scores = (similar_users_scores.T * weights).T.sum() / weights.sum()
        
        # Find subjects where user has low scores but similar users have high scores
        recommendations = []
        for subject in self.user_item_matrix.columns:
            if user_scores[subject] < 70 and weighted_scores[subject] > 80:
                recommendations.append({
                    'subject': subject,
                    'predicted_score': weighted_scores[subject],
                    'current_score': user_scores[subject],
                    'improvement_potential': weighted_scores[subject] - user_scores[subject]
                })
        
        # Sort by improvement potential
        recommendations.sort(key=lambda x: x['improvement_potential'], reverse=True)
        return recommendations[:n_recommendations]

class FaceDetection:
    def __init__(self):
        self.known_faces: Dict[str, np.ndarray] = {}
        self.face_locations: List[tuple] = []
        self.face_encodings: List[np.ndarray] = []

    @staticmethod
    def _dependencies_available() -> bool:
        return face_recognition is not None and cv2 is not None and Image is not None
        
    def encode_face_from_base64(self, image_base64: str) -> Optional[np.ndarray]:
        """Encode face from base64 image"""
        try:
            if not self._dependencies_available():
                logger.warning("Face recognition dependencies are unavailable in this runtime.")
                return None
            # Decode base64 image
            image_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_data))
            image_array = np.array(image)
            
            # Convert RGB to BGR for OpenCV
            if len(image_array.shape) == 3:
                image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            
            # Find face encodings
            face_encodings = face_recognition.face_encodings(image_array)
            
            if face_encodings:
                return face_encodings[0]
            return None
        except Exception as e:
            logger.error(f"Face encoding error: {e}")
            return None
    
    def detect_faces(self, image_base64: str) -> Dict[str, Any]:
        """Detect faces in image and return detection results"""
        try:
            if not self._dependencies_available():
                return {'faces_detected': 0, 'face_locations': [], 'confidence': False, 'message': 'Face dependencies unavailable'}
            # Decode base64 image
            image_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_data))
            image_array = np.array(image)
            
            # Convert RGB to BGR for OpenCV
            if len(image_array.shape) == 3:
                image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            
            # Find face locations and encodings
            self.face_locations = face_recognition.face_locations(image_array)
            self.face_encodings = face_recognition.face_encodings(image_array, self.face_locations)
            
            return {
                'faces_detected': len(self.face_locations),
                'face_locations': self.face_locations,
                'confidence': len(self.face_encodings) > 0
            }
        except Exception as e:
            logger.error(f"Face detection error: {e}")
            return {'faces_detected': 0, 'face_locations': [], 'confidence': False}
    
    def verify_student_identity(self, student_image_base64: str, stored_face_encoding: np.ndarray) -> Dict[str, Any]:
        """Verify if the detected face matches the stored student face"""
        try:
            if not self._dependencies_available():
                return {'verified': False, 'confidence': 0.0, 'message': 'Face dependencies unavailable'}
            current_face_encoding = self.encode_face_from_base64(student_image_base64)
            
            if current_face_encoding is None or stored_face_encoding is None:
                return {'verified': False, 'confidence': 0.0}
            
            # Compare faces
            matches = face_recognition.compare_faces([stored_face_encoding], current_face_encoding, tolerance=0.6)
            face_distance = face_recognition.face_distance([stored_face_encoding], current_face_encoding)
            
            confidence = 1 - face_distance[0]
            
            return {
                'verified': matches[0],
                'confidence': float(confidence),
                'face_distance': float(face_distance[0])
            }
        except Exception as e:
            logger.error(f"Face verification error: {e}")
            return {'verified': False, 'confidence': 0.0}

# Initialize recommendation and face detection systems
cf_system = CollaborativeFiltering()
cb_system = ContentBasedFiltering()
perf_analyzer = PerformanceOptimizationAnalyzer()
face_system = FaceDetection()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    model_status = get_recommendation_model_status()
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'mongodb': db is not None,
            'recommendation_system': model_status["model_loaded"],
            'face_detection': True,
            'performance_analyzer': True
        },
        'model_loaded': model_status["model_loaded"],
        'model_error': model_status["model_error"]
    })

@app.route('/recommendations/<user_id>', methods=['GET'])
def get_recommendations(user_id: str):
    """Get personalized recommendations for a user (collaborative filtering)"""
    try:
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Get exam results from MongoDB
        exam_results = list(db.examresults.find({}).limit(1000))
        
        if not exam_results:
            return jsonify({'recommendations': [], 'message': 'No exam data available'})
        
        # Populate exam details
        for result in exam_results:
            exam = db.exams.find_one({'_id': result['exam']})
            if exam:
                result['exam'] = exam
        
        # Create user-item matrix
        user_item_matrix = cf_system.create_user_item_matrix(exam_results)
        
        if user_item_matrix is None:
            return jsonify({'recommendations': [], 'message': 'Unable to create recommendation matrix'})
        
        # Calculate similarities
        cf_system.calculate_user_similarity()
        cf_system.calculate_item_similarity()
        
        # Fit NMF model
        cf_system.fit_nmf()
        
        # Get recommendations
        recommendations = cf_system.get_user_recommendations(user_id, n_recommendations=5)
        
        return jsonify({
            'recommendations': recommendations,
            'user_id': user_id,
            'total_exams_analyzed': len(exam_results),
            'method': 'collaborative_filtering'
        })
        
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return jsonify({'error': 'Failed to generate recommendations'}), 500

@app.route('/recommendations/<user_id>/similar-students', methods=['GET'])
def get_similar_students(user_id: str):
    """Get similar students to a given user"""
    try:
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Get exam results
        exam_results = list(db.examresults.find({}).limit(1000))
        
        if not exam_results:
            return jsonify({'similar_students': [], 'message': 'No exam data available'})
        
        # Populate exam details
        for result in exam_results:
            exam = db.exams.find_one({'_id': result['exam']})
            if exam:
                result['exam'] = exam
        
        # Create user-item matrix
        cf_system.create_user_item_matrix(exam_results)
        cf_system.calculate_user_similarity()
        
        # Get similar students
        similar_students = cf_system.get_similar_students(user_id, n_students=5)
        
        return jsonify({
            'user_id': user_id,
            'similar_students': similar_students,
            'count': len(similar_students)
        })
        
    except Exception as e:
        logger.error(f"Similar students error: {e}")
        return jsonify({'error': 'Failed to get similar students'}), 500

@app.route('/recommendations/<user_id>/hybrid', methods=['GET'])
def get_hybrid_recommendations(user_id: str):
    """Get hybrid recommendations combining content-based and collaborative filtering"""
    try:
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        n_recs = request.args.get('n_recommendations', 5, type=int)
        weight_collab = request.args.get('weight_collaborative', 0.5, type=float)
        weight_content = request.args.get('weight_content', 0.5, type=float)
        
        # Get exam results
        exam_results = list(db.examresults.find({}).limit(1000))
        
        if not exam_results:
            return jsonify({'recommendations': [], 'message': 'No exam data available'})
        
        # Populate exam details
        for result in exam_results:
            exam = db.exams.find_one({'_id': result['exam']})
            if exam:
                result['exam'] = exam
        
        # Build collaborative filtering recommendations
        cf_system.create_user_item_matrix(exam_results)
        cf_system.calculate_user_similarity()
        cf_recs = cf_system.get_user_recommendations(user_id, n_recommendations=10)
        
        # Build content-based recommendations
        items = [{'subject': result.get('exam', {}).get('subject', 'Unknown')} 
                 for result in exam_results]
        cb_system.prepare_items(items)
        cb_system.calculate_item_similarities()
        
        # Combine scores
        combined_recommendations = {}
        
        for rec in cf_recs:
            subject = rec.get('subject')
            score = rec.get('improvement_potential', 0)
            combined_recommendations[subject] = combined_recommendations.get(subject, 0) + (weight_collab * score)
        
        # Sort and return
        sorted_recs = sorted(combined_recommendations.items(), key=lambda x: x[1], reverse=True)
        
        result_recs = []
        for subject, score in sorted_recs[:n_recs]:
            result_recs.append({
                'subject': subject,
                'hybrid_score': float(score),
                'type': 'hybrid'
            })
        
        return jsonify({
            'user_id': user_id,
            'recommendations': result_recs,
            'weights': {
                'collaborative': weight_collab,
                'content_based': weight_content
            }
        })
        
    except Exception as e:
        logger.error(f"Hybrid recommendations error: {e}")
        return jsonify({'error': 'Failed to generate hybrid recommendations'}), 500

@app.route('/performance/analyze-submission', methods=['POST'])
def analyze_submission():
    """Analyze code submission performance optimization"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Required fields
        T_opt = data.get('optimal_time')
        M_opt = data.get('optimal_memory')
        T_sub = data.get('submitted_time')
        M_sub = data.get('submitted_memory')
        
        if any(x is None for x in [T_opt, M_opt, T_sub, M_sub]):
            return jsonify({'error': 'Missing required fields: optimal_time, optimal_memory, submitted_time, submitted_memory'}), 400
        
        # Optional parameters
        alpha = data.get('alpha', 0.5)
        beta = data.get('beta', 0.5)
        W_time = data.get('weight_time', 0.6)
        W_space = data.get('weight_space', 0.4)
        
        # Analyze
        analysis = perf_analyzer.analyze_submission(T_opt, M_opt, T_sub, M_sub, alpha, beta, W_time, W_space)
        
        return jsonify({
            'analysis': analysis,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Performance analysis error: {e}")
        return jsonify({'error': 'Failed to analyze submission'}), 500


@app.route('/recommend', methods=['POST'])
def recommend_submission():
    """Generate coding recommendation for a submitted exam."""
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({'error': 'No payload provided'}), 400

        recommendation = analyze_recommendation_submission(payload)
        model_status = get_recommendation_model_status()

        return jsonify({
            **recommendation,
            'timestamp': datetime.now().isoformat(),
            'model_loaded': model_status["model_loaded"],
            'model_error': model_status["model_error"]
        })
    except Exception as e:
        logger.error(f"Recommendation generation error: {e}")
        return jsonify({'error': 'Failed to generate recommendation'}), 500

@app.route('/face-detection/detect', methods=['POST'])
def detect_faces():
    """Detect faces in uploaded image"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        image_base64 = data.get('image')
        
        if not image_base64:
            return jsonify({'error': 'No image provided'}), 400
        
        # Detect faces
        detection_result = face_system.detect_faces(image_base64)
        
        return jsonify({
            'detection_result': detection_result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Face detection error: {e}")
        return jsonify({'error': 'Face detection failed'}), 500

@app.route('/face-detection/verify', methods=['POST'])
def verify_identity():
    """Verify student identity using face recognition"""
    try:
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        image_base64 = data.get('image')
        student_id = data.get('student_id')
        
        if not image_base64 or not student_id:
            return jsonify({'error': 'Image and student_id required'}), 400
        
        # Get stored face encoding for student
        student = db.users.find_one({'studentId': student_id})
        if not student or 'faceEncoding' not in student:
            return jsonify({'error': 'Student face data not found'}), 404
        
        stored_encoding = np.array(student['faceEncoding'])
        
        # Verify identity
        verification_result = face_system.verify_student_identity(image_base64, stored_encoding)
        
        return jsonify({
            'verification_result': verification_result,
            'student_id': student_id,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Identity verification error: {e}")
        return jsonify({'error': 'Identity verification failed'}), 500

@app.route('/face-detection/register', methods=['POST'])
def register_face():
    """Register student face encoding"""
    try:
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        image_base64 = data.get('image')
        student_id = data.get('student_id')
        
        if not image_base64 or not student_id:
            return jsonify({'error': 'Image and student_id required'}), 400
        
        # Encode face
        face_encoding = face_system.encode_face_from_base64(image_base64)
        
        if face_encoding is None:
            return jsonify({'error': 'No face detected in image'}), 400
        
        # Store face encoding in database
        result = db.users.update_one(
            {'studentId': student_id},
            {'$set': {'faceEncoding': face_encoding.tolist()}}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Student not found'}), 404
        
        return jsonify({
            'message': 'Face registered successfully',
            'student_id': student_id,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Face registration error: {e}")
        return jsonify({'error': 'Face registration failed'}), 500

@app.route('/analytics/performance-trends', methods=['GET'])
def get_performance_trends():
    """Get performance trends and analytics"""
    try:
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Get exam results
        exam_results = list(db.examresults.find({}))
        
        if not exam_results:
            return jsonify({'trends': [], 'message': 'No exam data available'})
        
        # Analyze trends by subject
        trends = {}
        for result in exam_results:
            exam = db.exams.find_one({'_id': result['exam']})
            if exam:
                subject = exam['subject']
                if subject not in trends:
                    trends[subject] = []
                trends[subject].append({
                    'score': result['percentage'],
                    'date': result['createdAt'],
                    'student_id': str(result['student'])
                })
        
        # Calculate average scores by month for each subject
        monthly_trends = {}
        for subject, results in trends.items():
            df = pd.DataFrame(results)
            df['date'] = pd.to_datetime(df['date'])
            df['month'] = df['date'].dt.to_period('M')
            
            monthly_avg = df.groupby('month')['score'].mean().reset_index()
            monthly_trends[subject] = monthly_avg.to_dict('records')
        
        return jsonify({
            'monthly_trends': monthly_trends,
            'total_exams': len(exam_results),
            'subjects': list(trends.keys())
        })
        
    except Exception as e:
        logger.error(f"Performance trends error: {e}")
        return jsonify({'error': 'Failed to generate performance trends'}), 500

@app.route('/analytics/student-performance/<student_id>', methods=['GET'])
def get_student_performance(student_id: str):
    """Get comprehensive performance analysis for a student"""
    try:
        if db is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Get all exam results for student
        student_results = list(db.examresults.find({'student': student_id}))
        
        if not student_results:
            return jsonify({'performance': {}, 'message': 'No exam data for this student'})
        
        # Populate exam details and aggregate by subject
        performance_by_subject = {}
        for result in student_results:
            exam = db.exams.find_one({'_id': result['exam']})
            if exam:
                subject = exam['subject']
                if subject not in performance_by_subject:
                    performance_by_subject[subject] = []
                performance_by_subject[subject].append({
                    'score': result['percentage'],
                    'date': result['createdAt']
                })
        
        # Calculate statistics
        statistics = {}
        for subject, results in performance_by_subject.items():
            scores = [r['score'] for r in results]
            statistics[subject] = {
                'attempts': len(scores),
                'average': float(np.mean(scores)),
                'best': float(np.max(scores)),
                'worst': float(np.min(scores)),
                'trend': 'improving' if scores[-1] > np.mean(scores[:-1]) else 'declining'
            }
        
        return jsonify({
            'student_id': student_id,
            'performance': statistics,
            'total_exams': len(student_results)
        })
        
    except Exception as e:
        logger.error(f"Student performance error: {e}")
        return jsonify({'error': 'Failed to get student performance'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
