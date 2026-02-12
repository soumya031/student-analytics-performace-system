# Student Analytics Recommendation Engine Integration Guide

## Overview

The recommendation engine from `studentanalytics.ipynb` has been successfully integrated into `app.py`. This document outlines the integrated features, new endpoints, and usage instructions.

## Key Components Integrated

### 1. **Collaborative Filtering System** (`CollaborativeFiltering` class)
Analyzes student exam scores to find similar students and recommend improvement areas.

**Features:**
- User-item matrix creation (student-subject interaction)
- User similarity calculation (cosine similarity)
- Item similarity analysis
- Non-negative Matrix Factorization (NMF) for latent factor discovery
- Personalized recommendations based on similar students' performance
- Similar student identification

**Methods:**
- `create_user_item_matrix()` - Build score matrix from exam results
- `calculate_user_similarity()` - Find similar students
- `calculate_item_similarity()` - Find related subjects
- `fit_nmf()` - Apply NMF for dimensionality reduction
- `get_user_recommendations()` - Generate improvement recommendations
- `get_similar_students()` - Find peers with similar performance

---

### 2. **Content-Based Filtering System** (`ContentBasedFiltering` class)
Recommends subjects/items based on semantic similarity of features.

**Features:**
- TF-IDF vectorization for text features
- Item-item similarity calculation using cosine similarity
- Metadata preparation and enrichment
- Content-based score calculation

**Methods:**
- `prepare_items()` - Prepare item metadata for analysis
- `calculate_item_similarities()` - Compute TF-IDF similarity matrix
- `get_content_based_recommendations()` - Generate content-based recommendations

---

### 3. **Performance Optimization Analyzer** (`PerformanceOptimizationAnalyzer` class)
Analyzes code submission efficiency metrics (from notebook implementation).

**Features:**
- Time complexity scoring (S_time)
- Space complexity scoring (S_space)
- Overall optimality scoring (OS)
- Configurable weighting factors

**Scoring Functions:**
- `calculate_s_time()` - Evaluates execution time efficiency
- `calculate_s_space()` - Evaluates memory efficiency
- `calculate_overall_score()` - Combines metrics with weights
- `analyze_submission()` - Complete submission analysis

**Parameters:**
- `T_opt` - Optimal execution time (seconds)
- `M_opt` - Optimal memory usage (MB)
- `T_sub` - Submitted code execution time
- `M_sub` - Submitted code memory usage
- `alpha` - Time weight factor (default: 0.5)
- `beta` - Space weight factor (default: 0.5)
- `W_time` - Overall time weight (default: 0.6)
- `W_space` - Overall space weight (default: 0.4)

---

### 4. **Face Detection System** (`FaceDetection` class)
Student identity verification using facial recognition.

**Features:**
- Face encoding from base64 images
- Face detection in images
- Identity verification
- Stored face encoding management

---

## New API Endpoints

### Recommendation Endpoints

#### 1. **Collaborative Filtering Recommendations**
```
GET /recommendations/<user_id>
```
**Response:**
```json
{
  "recommendations": [
    {
      "subject": "Mathematics",
      "predicted_score": 85.5,
      "current_score": 65.0,
      "improvement_potential": 20.5,
      "type": "collaborative"
    }
  ],
  "user_id": "student123",
  "total_exams_analyzed": 150,
  "method": "collaborative_filtering"
}
```

#### 2. **Similar Students**
```
GET /recommendations/<user_id>/similar-students
```
**Response:**
```json
{
  "user_id": "student123",
  "similar_students": [
    {
      "student_id": "student456",
      "similarity_score": 0.87
    }
  ],
  "count": 3
}
```

#### 3. **Hybrid Recommendations**
```
GET /recommendations/<user_id>/hybrid?n_recommendations=5&weight_collaborative=0.5&weight_content=0.5
```
**Query Parameters:**
- `n_recommendations` - Number of recommendations (default: 5)
- `weight_collaborative` - Collaborative filtering weight (default: 0.5)
- `weight_content` - Content-based weight (default: 0.5)

**Response:**
```json
{
  "user_id": "student123",
  "recommendations": [
    {
      "subject": "Physics",
      "hybrid_score": 45.2,
      "type": "hybrid"
    }
  ],
  "weights": {
    "collaborative": 0.5,
    "content_based": 0.5
  }
}
```

### Performance Analysis Endpoints

#### 4. **Analyze Code Submission**
```
POST /performance/analyze-submission
```
**Request Body:**
```json
{
  "optimal_time": 1.0,
  "optimal_memory": 100.0,
  "submitted_time": 0.8,
  "submitted_memory": 75.0,
  "alpha": 0.5,
  "beta": 0.5,
  "weight_time": 0.6,
  "weight_space": 0.4
}
```

**Response:**
```json
{
  "analysis": {
    "time_score": 0.8944,
    "space_score": 0.9129,
    "optimality_score": 0.8994,
    "submitted_time": 0.8,
    "submitted_memory": 75.0,
    "optimal_time": 1.0,
    "optimal_memory": 100.0
  },
  "timestamp": "2024-02-12T10:30:45.123456"
}
```

### Analytics Endpoints

#### 5. **Student Performance Analysis**
```
GET /analytics/student-performance/<student_id>
```
**Response:**
```json
{
  "student_id": "student123",
  "performance": {
    "Mathematics": {
      "attempts": 5,
      "average": 78.4,
      "best": 92.0,
      "worst": 65.0,
      "trend": "improving"
    }
  },
  "total_exams": 15
}
```

#### 6. **Performance Trends**
```
GET /analytics/performance-trends
```
**Response:**
```json
{
  "monthly_trends": {
    "Mathematics": [
      {
        "month": "2024-01",
        "score": 75.3
      }
    ]
  },
  "total_exams": 150,
  "subjects": ["Mathematics", "Physics", "Chemistry"]
}
```

---

## Usage Examples

### Example 1: Get Personalized Recommendations
```bash
curl http://localhost:5001/recommendations/student123
```

### Example 2: Get Similar Peers
```bash
curl http://localhost:5001/recommendations/student123/similar-students
```

### Example 3: Get Hybrid Recommendations with Custom Weights
```bash
curl "http://localhost:5001/recommendations/student123/hybrid?weight_collaborative=0.7&weight_content=0.3"
```

### Example 4: Analyze Code Performance
```bash
curl -X POST http://localhost:5001/performance/analyze-submission \
  -H "Content-Type: application/json" \
  -d '{
    "optimal_time": 1.0,
    "optimal_memory": 100.0,
    "submitted_time": 0.8,
    "submitted_memory": 75.0
  }'
```

### Example 5: Get Student Performance
```bash
curl http://localhost:5001/analytics/student-performance/student123
```

---

## Features from Notebook Integrated

✅ **Performance Scoring Functions**
- Time complexity calculation
- Space complexity calculation
- Overall optimality score

✅ **Hybrid Recommendation System**
- Content-based filtering with TF-IDF
- Collaborative filtering with user similarity
- Score combination and weighting

✅ **Collaborative Filtering**
- User-item matrix creation
- User-user similarity matrix
- Recommendation generation

✅ **Analytics**
- Performance trend analysis
- Monthly average calculations
- Subject-wise performance tracking

---

## Database Requirements

The system expects the following MongoDB collections:
- `examresults` - Contains exam attempt records
- `exams` - Contains exam metadata (subject, description)
- `users` - Contains student information
- `studentId` - Student identifier field

---

## Dependencies

All dependencies are already specified in `requirements.txt`:
```
Flask
Flask-CORS
pymongo
numpy
pandas
scikit-learn
face-recognition
opencv-python
python-dotenv
Pillow
psutil
```

---

## Configuration

Set the following environment variables in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/
PORT=5001
```

---

## Error Handling

All endpoints include proper error handling:
- Missing database connections return 500 error
- Missing required fields return 400 error
- Student not found returns 404 error
- General errors return 500 with descriptive message

---

## Next Steps

1. Deploy the updated `app.py`
2. Ensure MongoDB is running and accessible
3. Test all endpoints using the curl examples above
4. Integrate recommendations into frontend components
5. Monitor performance metrics and adjust weights as needed

---

## Support

For issues or questions about specific recommendation algorithms, refer to the detailed analysis in `studentanalytics.ipynb`.
