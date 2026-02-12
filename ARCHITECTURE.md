# Integration Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Flask Web Server                          │
│                    (app.py - 813 lines)                      │
└─────────────────────────────────────────────────────────────┘
              │
              ├─────────────────────────────────────────┐
              │                                         │
    ┌─────────▼──────────┐            ┌────────────────▼────────┐
    │  MongoDB Database  │            │  Frontend / API Clients │
    │  ────────────────  │            │  ────────────────────   │
    │ • examresults      │            │ • React Dashboard       │
    │ • exams            │            │ • Mobile Apps           │
    │ • users            │            │ • Third-party Services  │
    └────────────────────┘            └────────────────────────┘
              ▲
              │ (Data retrieval & storage)
              │
    ┌─────────┴──────────────────────────────────────────────────┐
    │                  Recommendation Engine                      │
    └────────────────────────────────────────────────────────────┘
              │
    ┌─────────┼──────────────────────┬──────────────────────────┐
    │         │                      │                          │
    │         ▼                      ▼                          ▼
    │    ┌─────────┐          ┌──────────┐          ┌──────────────┐
    │    │Collabor.│          │Content   │          │Performance   │
    │    │Filtering│          │Based     │          │Optimization  │
    │    └─────────┘          │Filtering │          │Analyzer      │
    │         │               └──────────┘          └──────────────┘
    │         │                      │                      │
    │    ┌────▼──────────┐      ┌────▼────────┐      ┌─────▼──────┐
    │    │ User-Item     │      │ TF-IDF      │      │ Scoring    │
    │    │ Matrix        │      │ Vectorizer  │      │ Functions  │
    │    ├────────────── │      ├─────────────┤      ├────────────┤
    │    │ Similarity    │      │ Item        │      │ S_time     │
    │    │ Matrices      │      │ Similarity  │      │ S_space    │
    │    │               │      │ Matrix      │      │ OS         │
    │    └───────────────┘      └─────────────┘      └────────────┘
    │
    └─────────────────────────────────────────────────────────────┘
              │
    ┌─────────▼──────────────────────────────────────────────────┐
    │              Flask API Endpoints (7 total)                 │
    ├────────────────────────────────────────────────────────────┤
    │ ✓ /recommendations/{id}                                    │
    │ ✓ /recommendations/{id}/similar-students                   │
    │ ✓ /recommendations/{id}/hybrid                             │
    │ ✓ /performance/analyze-submission                          │
    │ ✓ /analytics/student-performance/{id}                      │
    │ ✓ /analytics/performance-trends                            │
    │ ✓ /health                                                  │
    └────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Collaborative Filtering Request Flow
```
Client Request: GET /recommendations/student123
    ↓
Parse student_id
    ↓
Query MongoDB: examresults collection
    ↓
CollaborativeFiltering.create_user_item_matrix()
    ├─ Create DataFrame with student_id × subject × score
    └─ Generate pivot table
    ↓
Calculate user similarity (cosine_similarity)
    ↓
Find similar students for student123
    ↓
Generate weighted recommendations
    │
    └─ Identify subjects where:
       • student_id has score < 70
       • similar_students have score > 80
    ↓
Sort by improvement_potential (descending)
    ↓
Return top 5 recommendations
```

### Hybrid Recommendation Flow
```
Client Request: GET /recommendations/student123/hybrid?weight_collaborative=0.6&weight_content=0.4
    ↓
├─ Collaborative Filtering Path
│  ├─ Create user-item matrix
│  ├─ Calculate similarities
│  └─ Get CF recommendations (score: 0-100)
│
└─ Content-Based Path
   ├─ Prepare item metadata (from exams)
   ├─ TF-IDF vectorization
   ├─ Calculate item-item similarity
   └─ Get CB recommendations (score: 0-1)
    ↓
Combine scores:
 combined_score = (0.6 × cf_score) + (0.4 × cb_score)
    ↓
Sort by combined_score
    ↓
Return top N recommendations
```

### Performance Analysis Flow
```
Client Request: POST /performance/analyze-submission
    │
    └─ Body: {optimal_time, optimal_memory, submitted_time, submitted_memory}
    ↓
PerformanceOptimizationAnalyzer.analyze_submission()
    ├─ Calculate S_time = min(1.0, (T_opt / T_sub)^α)
    ├─ Calculate S_space = min(1.0, (M_opt / M_sub)^β)
    └─ Calculate OS = (W_time × S_time) + (W_space × S_space)
    ↓
Return: {time_score, space_score, optimality_score, ...}
```

---

## Class Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                   Flask App Instance                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ cf_system ──────────────────────────────────────────┐     │
│  │ CollaborativeFiltering()                             │     │
│  │ ├─ user_item_matrix: DataFrame                       │     │
│  │ ├─ user_similarity_matrix: np.ndarray               │     │
│  │ ├─ user_similarity_df: DataFrame                    │     │
│  │ ├─ item_similarity_matrix: np.ndarray              │     │
│  │ ├─ nmf_model: NMF                                   │     │
│  │ └─ Methods:                                         │     │
│  │    ├─ create_user_item_matrix()                     │     │
│  │    ├─ calculate_user_similarity()                   │     │
│  │    ├─ calculate_item_similarity()                   │     │
│  │    ├─ fit_nmf()                                     │     │
│  │    ├─ get_user_recommendations()                    │     │
│  │    └─ get_similar_students()                        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─ cb_system ──────────────────────────────────────────┐     │
│  │ ContentBasedFiltering()                              │     │
│  │ ├─ tfidf_vectorizer: TfidfVectorizer                │     │
│  │ ├─ tfidf_matrix: np.ndarray                         │     │
│  │ ├─ item_similarity_df: DataFrame                    │     │
│  │ ├─ item_metadata_df: DataFrame                      │     │
│  │ └─ Methods:                                         │     │
│  │    ├─ prepare_items()                               │     │
│  │    ├─ calculate_item_similarities()                 │     │
│  │    └─ get_content_based_recommendations()           │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─ perf_analyzer ───────────────────────────────────┐         │
│  │ PerformanceOptimizationAnalyzer()                 │         │
│  │ └─ Methods (all static):                          │         │
│  │    ├─ calculate_s_time()                          │         │
│  │    ├─ calculate_s_space()                         │         │
│  │    ├─ calculate_overall_score()                   │         │
│  │    └─ analyze_submission()                        │         │
│  └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌─ face_system ─────────────────────────────────────┐         │
│  │ FaceDetection()                                   │         │
│  │ ├─ known_faces: Dict                              │         │
│  │ ├─ face_locations: List                           │         │
│  │ ├─ face_encodings: List                           │         │
│  │ └─ Methods:                                       │         │
│  │    ├─ encode_face_from_base64()                   │         │
│  │    ├─ detect_faces()                              │         │
│  │    └─ verify_student_identity()                   │         │
│  └─────────────────────────────────────────────────────┘     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

```
Frontend Layer (Optional)
      ↓
Flask 2.x (Web Framework)
      ↓
├─ Flask-CORS (Cross-Origin Support)
├─ JSONify (Response Formatting)
└─ Request Handler (Input Processing)
      ↓
Machine Learning Layer
├─ scikit-learn
│  ├─ cosine_similarity (CF)
│  ├─ NMF (Non-negative Matrix Factorization)
│  ├─ TfidfVectorizer (CB)
│  └─ metrics.pairwise
│
├─ NumPy (Numerical computations)
├─ Pandas (Data manipulation)
└─ face_recognition (Identity verification)
      ↓
Data Layer
├─ MongoDB (NoSQL database)
├─ PyMongo (Python driver)
└─ Collections: exams, examresults, users
      ↓
Utilities
├─ OpenCV (Image processing)
├─ PIL (Image library)
├─ base64 (Encoding/Decoding)
├─ psutil (System metrics)
├─ dotenv (Configuration)
└─ logging (Error tracking)
```

---

## Key Design Patterns

### 1. Separation of Concerns
- **CollaborativeFiltering**: User-based recommendations
- **ContentBasedFiltering**: Feature-based recommendations
- **PerformanceOptimizationAnalyzer**: Code analysis
- **FaceDetection**: Identity verification

### 2. Stateful Classes
- Maintain matrices and models in memory
- Reuse computed similarities
- Efficient for repeated recommendations

### 3. RESTful API Design
- Resource-based endpoints
- Standard HTTP methods
- Consistent JSON responses

### 4. Error Handling
- Graceful degradation
- Detailed error messages
- Proper HTTP status codes

### 5. Extensibility
- Pluggable recommendation algorithms
- Configurable weights and parameters
- Easy to add new endpoints

---

## Algorithm Complexity

### Collaborative Filtering
- **Time Complexity**: O(n²) for n students (similarity calculation)
- **Space Complexity**: O(n×m) for n students, m subjects
- **Optimization**: NMF reduces to O(n×k) where k << m

### Content-Based Filtering
- **Time Complexity**: O(m²) for m items (TF-IDF similarity)
- **Space Complexity**: O(m×d) for m items, d features
- **Optimization**: Limited to 100 TF-IDF features

### Performance Analysis
- **Time Complexity**: O(1) - constant time calculations
- **Space Complexity**: O(1) - minimal memory usage

---

## Scalability Considerations

### Current Limitations
- 1000 exam limit per query
- 10 NMF components
- 100 TF-IDF features
- In-memory matrix storage

### Optimization Opportunities
1. Implement Redis caching
2. Use batch processing for large datasets
3. Implement incremental learning
4. Add database indexing
5. Use approximation algorithms

---

## Integration Points

### Input: MongoDB
```
examresults
├─ student: ObjectId
├─ exam: ObjectId
├─ percentage: float
└─ createdAt: datetime

exams
├─ _id: ObjectId
├─ subject: string
└─ description: string (optional)

users
├─ studentId: string
├─ faceEncoding: [float] (optional)
└─ ...
```

### Output: JSON API
```
Recommendations:
├─ subject: string
├─ score: float
├─ type: string (collaborative/content_based/hybrid)
└─ additional_metrics: {...}

Performance Analysis:
├─ time_score: float [0-1]
├─ space_score: float [0-1]
├─ optimality_score: float [0-1]
└─ metrics: {...}
```

---

## Monitoring & Logging

### Log Levels
- **INFO**: System initialization, successful operations
- **ERROR**: Database errors, processing failures
- **WARNING**: Data quality issues (if implemented)

### Key Metrics to Track
1. Response times for each endpoint
2. Recommendation accuracy (if feedback available)
3. Database query performance
4. API error rates

---

## Future Architecture Enhancements

```
Current (v1.0)
├─ Rule-based scoring
├─ Static similarity matrices
└─ Single-model recommendations

Planned (v2.0)
├─ Deep Learning models
├─ Real-time updates
├─ Multi-model ensemble
├─ User feedback integration
└─ A/B testing framework

Planned (v3.0)
├─ Distributed computing
├─ Stream processing
├─ Advanced personalization
└─ Explainable AI
```

---

**Architecture Version**: 1.0.0  
**Last Updated**: February 12, 2026  
**Status**: Production Ready
