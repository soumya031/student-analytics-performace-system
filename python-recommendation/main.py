import os
import pickle
import re
import sys
import types
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd

from recommender_utils import calculate_overall_score, calculate_s_space, calculate_s_time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "hybrid_recommender.pkl")

MODEL_LOAD_ERROR = None


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


def _find_column(df: pd.DataFrame, *candidates: str) -> str:
    normalized_columns = {normalize_text(column): column for column in df.columns}
    for candidate in candidates:
        resolved = normalized_columns.get(normalize_text(candidate))
        if resolved:
            return resolved
    return ""


def format_solution_label(row: pd.Series) -> str:
    title = str(row.get("Title") or row.get("title") or row.get("problem_title") or "").strip()
    approach = str(row.get("ApproachName") or row.get("approach") or row.get("approach_name") or "").strip()
    language = str(row.get("Language") or row.get("language") or row.get("programming_language") or "").strip()

    if title and approach and language:
        return f"{title} - {approach} ({language})"
    if title and approach:
        return f"{title} - {approach}"
    if title and language:
        return f"{title} ({language})"
    if title:
        return title
    return str(row.get("OptSolutionID") or row.get("optsolutionid") or "").strip()


def humanize_topic_label(topic: Any) -> str:
    raw_topic = str(topic or "").strip()
    if not raw_topic:
        return ""

    if not isinstance(SOLUTIONS_DF, pd.DataFrame) or SOLUTIONS_DF.empty:
        return raw_topic

    id_column = _find_column(SOLUTIONS_DF, "OptSolutionID", "solution_id", "solutionid")
    title_column = _find_column(SOLUTIONS_DF, "Title", "problem_title", "title")

    if id_column:
        matches = SOLUTIONS_DF[SOLUTIONS_DF[id_column].astype(str) == raw_topic]
        if not matches.empty:
            return format_solution_label(matches.iloc[0])

    normalized_topic = normalize_text(raw_topic)

    if id_column:
        id_matches = SOLUTIONS_DF[SOLUTIONS_DF[id_column].astype(str).map(normalize_text) == normalized_topic]
        if not id_matches.empty:
            return format_solution_label(id_matches.iloc[0])

    if title_column:
        title_matches = SOLUTIONS_DF[SOLUTIONS_DF[title_column].astype(str).map(normalize_text) == normalized_topic]
        if not title_matches.empty:
            return format_solution_label(title_matches.iloc[0])

    return raw_topic


def add_weighted_score(score_map: Dict[str, float], topic: str, weight: float):
    normalized_topic = humanize_topic_label(topic)
    if not normalized_topic:
        return
    score_map[normalized_topic] = score_map.get(normalized_topic, 0.0) + float(weight)


def register_pickle_compatibility_aliases():
    try:
        import numpy.core as numpy_core

        sys.modules.setdefault("numpy._core", numpy_core)
        sys.modules.setdefault("numpy._core.multiarray", np.core.multiarray)
        sys.modules.setdefault("numpy._core.numeric", np.core.numeric)
        sys.modules.setdefault("numpy._core.umath", np.core.umath)
    except Exception:
        pass

    dataframe_module = types.ModuleType("DataFrame")
    dataframe_module.DataFrame = pd.DataFrame
    dataframe_module.Series = pd.Series
    dataframe_module.Index = pd.Index
    dataframe_module.dtype = np.dtype
    sys.modules.setdefault("DataFrame", dataframe_module)


class CompatibilityUnpickler(pickle.Unpickler):
    MODULE_ALIASES = {
        "numpy._core": "numpy.core",
        "numpy._core.multiarray": "numpy.core.multiarray",
        "numpy._core.numeric": "numpy.core.numeric",
        "numpy._core.umath": "numpy.core.umath",
    }

    CLASS_ALIASES = {
        ("DataFrame", "DataFrame"): pd.DataFrame,
        ("DataFrame", "Series"): pd.Series,
        ("DataFrame", "Index"): pd.Index,
        ("DataFrame", "dtype"): np.dtype,
    }

    def find_class(self, module, name):
        alias = self.CLASS_ALIASES.get((module, name))
        if alias is not None:
            return alias

        module = self.MODULE_ALIASES.get(module, module)
        return super().find_class(module, name)


def load_recommender_bundle():
    register_pickle_compatibility_aliases()

    try:
        return joblib.load(MODEL_PATH)
    except Exception:
        with open(MODEL_PATH, "rb") as model_file:
            return CompatibilityUnpickler(model_file).load()


try:
    RECOMMENDER_BUNDLE = load_recommender_bundle()
except Exception as model_load_error:
    MODEL_LOAD_ERROR = str(model_load_error)
    RECOMMENDER_BUNDLE = {
        "solutions_df": pd.DataFrame(),
        "user_ratings_df": pd.DataFrame(),
        "solution_similarity_df_conceptual": pd.DataFrame(),
        "user_similarity_df_conceptual": pd.DataFrame(),
        "params": {
            "T_opt": 1.0,
            "M_opt": 1.0,
            "alpha": 0.5,
            "beta": 0.5,
            "W_time": 0.6,
            "W_space": 0.4,
        },
    }

SOLUTIONS_DF = RECOMMENDER_BUNDLE.get("solutions_df", pd.DataFrame())
USER_RATINGS_DF = RECOMMENDER_BUNDLE.get("user_ratings_df", pd.DataFrame())
SOLUTION_SIMILARITY_DF = RECOMMENDER_BUNDLE.get("solution_similarity_df_conceptual", pd.DataFrame())
USER_SIMILARITY_DF = RECOMMENDER_BUNDLE.get("user_similarity_df_conceptual", pd.DataFrame())

PARAMS = RECOMMENDER_BUNDLE.get("params", {})
T_OPT = safe_number(PARAMS.get("T_opt"), 1.0)
M_OPT = safe_number(PARAMS.get("M_opt"), 1.0)
ALPHA = safe_number(PARAMS.get("alpha"), 0.5)
BETA = safe_number(PARAMS.get("beta"), 0.5)
W_TIME = safe_number(PARAMS.get("W_time"), 0.6)
W_SPACE = safe_number(PARAMS.get("W_space"), 0.4)


def get_model_status() -> Dict[str, Any]:
    return {
        "model_loaded": MODEL_LOAD_ERROR is None,
        "model_error": MODEL_LOAD_ERROR,
    }


def get_bundle_metadata() -> Dict[str, Any]:
    return {
        "available_keys": list(RECOMMENDER_BUNDLE.keys()),
        "total_solutions": len(SOLUTIONS_DF) if isinstance(SOLUTIONS_DF, pd.DataFrame) else 0,
        "total_user_ratings": len(USER_RATINGS_DF) if isinstance(USER_RATINGS_DF, pd.DataFrame) else 0,
    }


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
    time_values = [safe_number(question.get("averageExecutionTimeMs")) for question in coding_questions if question.get("averageExecutionTimeMs") is not None]
    memory_values = [safe_number(question.get("maxMemoryKb")) for question in coding_questions if question.get("maxMemoryKb") is not None]

    avg_time_ms = float(np.mean(time_values)) if time_values else 0.0
    peak_memory_kb = float(np.max(memory_values)) if memory_values else 0.0

    submitted_time_seconds = avg_time_ms / 1000.0 if avg_time_ms else T_OPT
    submitted_memory_mb = peak_memory_kb / 1024.0 if peak_memory_kb else M_OPT

    time_score = calculate_s_time(T_OPT, submitted_time_seconds, ALPHA)
    space_score = calculate_s_space(M_OPT, submitted_memory_mb, BETA)
    optimality_score = calculate_overall_score(time_score, space_score, W_TIME, W_SPACE)

    return {
        "averageExecutionTimeMs": round(avg_time_ms, 2) if avg_time_ms else 0.0,
        "peakMemoryKb": round(peak_memory_kb, 2) if peak_memory_kb else 0.0,
        "optimalityScore": round(optimality_score, 3),
        "timeScore": round(time_score, 3),
        "spaceScore": round(space_score, 3),
    }


def build_submission_signal_profile(payload: Dict[str, Any]) -> Dict[str, Any]:
    coding_questions = payload.get("codingQuestions", []) or []
    percentage = safe_number(payload.get("percentage"))

    strengths: List[Dict[str, str]] = []
    weaknesses: List[Dict[str, str]] = []
    topic_scores: Dict[str, float] = {}

    def add_topic(topic: str, weight: float):
        add_weighted_score(topic_scores, topic, weight)

    total_tests = sum(safe_number(question.get("totalCount")) for question in coding_questions)
    passed_tests = sum(safe_number(question.get("passedCount")) for question in coding_questions)
    visible_total = sum(safe_number(question.get("visibleTotalCount")) for question in coding_questions)
    visible_passed = sum(safe_number(question.get("visiblePassedCount")) for question in coding_questions)
    hidden_total = sum(safe_number(question.get("hiddenTotalCount")) for question in coding_questions)
    hidden_passed = sum(safe_number(question.get("hiddenPassedCount")) for question in coding_questions)
    errors = [error for question in coding_questions for error in (question.get("errors", []) or []) if error]
    languages = dedupe([question.get("language", "") for question in coding_questions if question.get("language")])
    runtime_metrics = collect_runtime_metrics(coding_questions)

    if total_tests > 0 and passed_tests == total_tests:
        strengths.append({
            "title": "Correctness",
            "detail": "All coding tests passed. Your implementation is functionally strong.",
        })
    elif total_tests > 0 and (passed_tests / max(total_tests, 1)) >= 0.7:
        strengths.append({
            "title": "Near-complete solutions",
            "detail": "Most coding tests passed. The remaining gaps look concentrated rather than broad.",
        })
        add_topic("edge case testing", 1.5)
    else:
        weaknesses.append({
            "title": "Core coding logic",
            "detail": "Several coding tests failed. Review logic decomposition and validate branches with small manual traces.",
        })
        add_topic("problem decomposition", 2.5)
        add_topic("edge case testing", 2.0)

    if visible_total > 0 and visible_passed < visible_total:
        weaknesses.append({
            "title": "Sample-case mismatch",
            "detail": "Visible tests are failing, which usually points to input parsing, output formatting, or an early logic mismatch.",
        })
        add_topic("input/output tracing", 2.3)

    if hidden_total > 0 and hidden_passed < hidden_total:
        weaknesses.append({
            "title": "Hidden-case robustness",
            "detail": "Hidden tests failed more than visible tests. Strengthen boundary checks, empty-state handling, and larger-case robustness.",
        })
        add_topic("boundary conditions", 2.6)
        add_topic("defensive coding", 2.2)

    if errors:
        weaknesses.append({
            "title": "Debugging discipline",
            "detail": "Compilation or runtime errors were detected. Validate syntax, data types, and small intermediate runs before full submission.",
        })
        add_topic("syntax debugging", 2.4)
        add_topic("runtime debugging", 2.4)

    if percentage >= 80:
        strengths.append({
            "title": "Overall exam performance",
            "detail": "Your overall score indicates strong command of the assessed material.",
        })
    elif percentage < 50:
        weaknesses.append({
            "title": "Assessment consistency",
            "detail": "This score suggests you would benefit from more deliberate timed practice and revision.",
        })
        add_topic("timed practice", 2.0)

    if languages:
        strengths.append({
            "title": "Language familiarity",
            "detail": f"You attempted coding in {', '.join(languages)}, which is useful for implementation confidence.",
        })

    if runtime_metrics["optimalityScore"] < 0.65:
        weaknesses.append({
            "title": "Runtime efficiency",
            "detail": "The measured execution profile is weaker than the model reference optimum, so optimization work should follow correctness fixes.",
        })
        add_topic("time complexity optimization", 1.8)
        add_topic("memory optimization", 1.2)
    else:
        strengths.append({
            "title": "Execution profile",
            "detail": "Your execution and memory profile is reasonably close to the model reference baseline.",
        })

    for topic in map_subject_to_topics(payload.get("subject", "")):
        add_topic(topic, 0.8)

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "topicScores": topic_scores,
        "runtimeMetrics": runtime_metrics,
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
    if not isinstance(SOLUTIONS_DF, pd.DataFrame) or SOLUTIONS_DF.empty:
        return []

    subject = normalize_text(payload.get("subject"))
    languages = {
        normalize_text(question.get("language"))
        for question in (payload.get("codingQuestions", []) or [])
        if question.get("language")
    }
    filtered_df = SOLUTIONS_DF.copy()

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
            candidates.extend([part.strip() for part in re.split(r"[|,/;]", value) if part.strip()])

    return dedupe(candidates)[:limit]


def infer_similarity_topics(seed_terms: List[str], max_items: int = 5) -> List[str]:
    if not isinstance(SOLUTION_SIMILARITY_DF, pd.DataFrame) or SOLUTION_SIMILARITY_DF.empty:
        return []

    scores: Dict[str, float] = {}
    normalized_index = {normalize_text(label): label for label in SOLUTION_SIMILARITY_DF.index}

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

        row = SOLUTION_SIMILARITY_DF.loc[label].sort_values(ascending=False).head(max_items + 1)
        for related_label, related_score in row.items():
            if normalize_text(related_label) == normalized:
                continue
            resolved_label = humanize_topic_label(related_label)
            scores[resolved_label] = max(scores.get(resolved_label, 0.0), safe_number(related_score))

    return [item[0] for item in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:max_items]]


def build_model_score_profile(payload: Dict[str, Any], history_profile: Dict[str, float]) -> Dict[str, Any]:
    score_map: Dict[str, float] = {}
    insights: List[str] = []
    seed_topics = extract_model_topic_candidates(payload)

    for index, topic in enumerate(seed_topics):
        add_weighted_score(score_map, topic, max(0.9, 2.4 - (index * 0.12)))

    for related_topic in infer_similarity_topics(seed_topics, max_items=8):
        add_weighted_score(score_map, related_topic, 1.8)

    student_id = str(payload.get("studentId", "") or "").strip()
    if isinstance(USER_SIMILARITY_DF, pd.DataFrame) and student_id and student_id in USER_SIMILARITY_DF.index:
        similar_users = (
            USER_SIMILARITY_DF[student_id]
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

    if isinstance(USER_RATINGS_DF, pd.DataFrame) and not USER_RATINGS_DF.empty:
        ratings_df = USER_RATINGS_DF.copy()
        normalized_columns = {normalize_text(column): column for column in ratings_df.columns}

        student_column = normalized_columns.get("student id") or normalized_columns.get("student_id") or normalized_columns.get("studentid") or normalized_columns.get("user id") or normalized_columns.get("user_id")
        subject_column = normalized_columns.get("subject")
        topic_column = normalized_columns.get("topic") or normalized_columns.get("topics") or normalized_columns.get("category") or normalized_columns.get("optsolutionid")
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


def extract_content_recommendations(payload: Dict[str, Any], seed_topics: List[str]) -> List[str]:
    if not isinstance(SOLUTIONS_DF, pd.DataFrame) or SOLUTIONS_DF.empty:
        return []

    matching_df = SOLUTIONS_DF.copy()
    subject = normalize_text(payload.get("subject"))
    languages = {normalize_text(question.get("language")) for question in (payload.get("codingQuestions", []) or []) if question.get("language")}

    if subject and "subject" in matching_df.columns:
        filtered = matching_df[matching_df["subject"].astype(str).map(normalize_text) == subject]
        if not filtered.empty:
            matching_df = filtered

    for language_column in ["language", "programming_language", "lang"]:
        if languages and language_column in matching_df.columns:
            filtered = matching_df[matching_df[language_column].astype(str).map(normalize_text).isin(languages)]
            if not filtered.empty:
                matching_df = filtered
                break

    candidate_columns = ["topic", "topics", "tag", "tags", "category", "categories", "title", "problem_title", "difficulty"]
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
                resolved_candidate = humanize_topic_label(candidate)
                scores[resolved_candidate] = max(scores.get(resolved_candidate, 0.0), 1.0 + (0.4 * overlap))

    for related_topic in infer_similarity_topics(seed_topics):
        resolved_related = humanize_topic_label(related_topic)
        scores[resolved_related] = max(scores.get(resolved_related, 0.0), 1.1)

    return [item[0] for item in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:6]]


def extract_model_insights(payload: Dict[str, Any], seed_topics: List[str], runtime_metrics: Dict[str, float], history_profile: Dict[str, float]) -> List[str]:
    insights: List[str] = []

    if runtime_metrics.get("optimalityScore", 0) > 0:
        insights.append(
            f"Hybrid model optimality score: {runtime_metrics['optimalityScore']:.2f} using time weight {W_TIME:.2f} and space weight {W_SPACE:.2f}."
        )

    content_topics = extract_content_recommendations(payload, seed_topics)
    if content_topics:
        insights.append(f"Content model matches for this submission include: {', '.join(content_topics[:3])}.")

    if history_profile:
        weakest_subject = min(history_profile.items(), key=lambda item: item[1])
        insights.append(
            f"Student history weighting used {weakest_subject[0].title()} as the weakest prior subject signal at about {round(weakest_subject[1])} percent."
        )

    if MODEL_LOAD_ERROR is not None:
        insights.append(f"Model bundle warning: {MODEL_LOAD_ERROR}")

    return dedupe(insights)


def analyze_submission(payload: Dict[str, Any]) -> Dict[str, Any]:
    signal_profile = build_submission_signal_profile(payload)
    history_profile = extract_history_profile(payload)
    model_profile = build_model_score_profile(payload, history_profile)

    combined_topic_scores: Dict[str, float] = {}
    for topic, score in model_profile["topicScores"].items():
        add_weighted_score(combined_topic_scores, topic, score * 0.82)
    for topic, score in signal_profile["topicScores"].items():
        add_weighted_score(combined_topic_scores, topic, score * 0.18)

    content_topics = extract_content_recommendations(payload, list(model_profile["seedTopics"]) or list(combined_topic_scores.keys()))
    for index, topic in enumerate(content_topics):
        add_weighted_score(combined_topic_scores, topic, max(0.4, 1.0 - (index * 0.1)))

    recommended_topics = dedupe(
        [topic for topic, _score in sorted(combined_topic_scores.items(), key=lambda item: item[1], reverse=True)]
    )[:6]

    model_insights = extract_model_insights(
        payload,
        recommended_topics,
        signal_profile["runtimeMetrics"],
        history_profile,
    )
    model_insights.extend(model_profile["insights"])
    model_insights = dedupe(model_insights)

    strengths = signal_profile["strengths"]
    weaknesses = signal_profile["weaknesses"]
    percentage = signal_profile["percentage"]

    if not weaknesses and percentage >= 80:
        summary = "Strong coding performance. The trained recommender still suggests moving to harder related patterns and cleaner optimization work."
    else:
        summary = "Your submission recommendation is primarily driven by the hybrid recommender bundle, with runtime and test-pattern heuristics used as supporting evidence."

    primary_topic = humanize_topic_label(recommended_topics[0]) if recommended_topics else "mixed revision"

    return {
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendedTopics": recommended_topics,
        "nextPracticeSuggestion": f"Practice 2-3 {primary_topic} problems next, then reattempt one timed question in the same subject.",
        "modelInsights": model_insights,
        "runtimeMetrics": signal_profile["runtimeMetrics"],
        "modelDriven": MODEL_LOAD_ERROR is None,
    }
