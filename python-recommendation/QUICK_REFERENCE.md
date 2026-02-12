# Quick Reference: Recommendation Engine API

## Available Endpoints

### 1. Collaborative Filtering Recommendations
```
GET /recommendations/{student_id}
```
- **What:** Recommends subjects based on similar students' performance
- **Returns:** List of improvement opportunities

### 2. Similar Students
```
GET /recommendations/{student_id}/similar-students
```
- **What:** Finds peers with similar performance patterns
- **Returns:** List of similar students with scores

### 3. Hybrid Recommendations
```
GET /recommendations/{student_id}/hybrid
```
- **Query Params:**
  - `n_recommendations=5` - Number of recommendations
  - `weight_collaborative=0.5` - CF algorithm weight
  - `weight_content=0.5` - Content-based weight
- **What:** Combines multiple recommendation strategies
- **Returns:** Best recommendations from both methods

### 4. Code Performance Analysis
```
POST /performance/analyze-submission
```
- **Body:** 
  ```json
  {
    "optimal_time": 1.0,
    "optimal_memory": 100.0,
    "submitted_time": 0.8,
    "submitted_memory": 75.0
  }
  ```
- **What:** Scores code efficiency (time & memory)
- **Returns:** Efficiency scores and analysis

### 5. Student Performance Profile
```
GET /analytics/student-performance/{student_id}
```
- **What:** Complete performance breakdown by subject
- **Returns:** Statistics (avg, best, worst, trend)

### 6. System Performance Trends
```
GET /analytics/performance-trends
```
- **What:** Overall system performance over time
- **Returns:** Monthly trends by subject

### 7. Health Check
```
GET /health
```
- **What:** System status verification
- **Returns:** Service health status

---

## Recommendation Types

### Collaborative Filtering
- Based on: Similar students' exam scores
- Best for: Finding improvement areas common to peers
- Score range: 0-100 (improvement potential)

### Content-Based
- Based on: Subject/topic feature similarity
- Best for: Finding semantically similar subjects
- Score range: 0-1 (similarity score)

### Hybrid
- Based on: Combination of both methods
- Best for: Balanced recommendations
- Configurable weights for flexibility

---

## Example cURL Commands

**Get recommendations:**
```bash
curl http://localhost:5001/recommendations/student123
```

**Get similar peers:**
```bash
curl http://localhost:5001/recommendations/student123/similar-students
```

**Get hybrid with custom weights:**
```bash
curl "http://localhost:5001/recommendations/student123/hybrid?weight_collaborative=0.7&weight_content=0.3&n_recommendations=3"
```

**Analyze code submission:**
```bash
curl -X POST http://localhost:5001/performance/analyze-submission \
  -H "Content-Type: application/json" \
  -d '{
    "optimal_time": 1.0,
    "optimal_memory": 100.0,
    "submitted_time": 0.85,
    "submitted_memory": 95.0
  }'
```

**Get student performance:**
```bash
curl http://localhost:5001/analytics/student-performance/student123
```

**Get system trends:**
```bash
curl http://localhost:5001/analytics/performance-trends
```

---

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing parameters) |
| 404 | Resource not found (student not found) |
| 500 | Server error (DB connection, processing) |

---

## Key Algorithms

### 1. Collaborative Filtering
- User-item matrix from scores
- Cosine similarity between users
- Weighted average of similar users' performance
- Find subjects with high peer performance, low personal score

### 2. Content-Based Filtering
- TF-IDF vectorization of features
- Cosine similarity between items
- Score based on feature similarity to liked items

### 3. Performance Scoring
- **S_time = min(1.0, (T_opt / T_sub)^α)**
  - α = time weighting factor
  - Higher when submission is faster than optimal
  
- **S_space = min(1.0, (M_opt / M_sub)^β)**
  - β = space weighting factor
  - Higher when submission uses less memory
  
- **OS = W_time × S_time + W_space × S_space**
  - Weighted combination of both metrics

---

## Configuration

**Environment Variables:**
```
MONGODB_URI=mongodb://localhost:27017/
PORT=5001
```

**Default Parameters:**
- Recommendation count: 5
- Time weight (W_time): 0.6
- Space weight (W_space): 0.4
- Time factor (α): 0.5
- Space factor (β): 0.5
- Collaborative weight: 0.5
- Content weight: 0.5

---

## Common Use Cases

### Use Case 1: Recommend Improvement Areas
```bash
curl http://localhost:5001/recommendations/{student_id}
```
→ Shows subjects where they underperform vs. similar peers

### Use Case 2: Find Study Groups
```bash
curl http://localhost:5001/recommendations/{student_id}/similar-students
```
→ Identify classmates with similar performance for study groups

### Use Case 3: Adaptive Learning Path
```bash
curl "http://localhost:5001/recommendations/{student_id}/hybrid?weight_collaborative=0.6&weight_content=0.4"
```
→ Personalized learning recommendations with peer validation

### Use Case 4: Code Submission Feedback
```bash
curl -X POST http://localhost:5001/performance/analyze-submission
```
→ Detailed efficiency feedback on programming assignments

### Use Case 5: Performance Dashboard
```bash
curl http://localhost:5001/analytics/student-performance/{student_id}
curl http://localhost:5001/analytics/performance-trends
```
→ Complete performance analytics and trends

---

## Performance Tips

1. **Cache results** for frequently requested students
2. **Batch analysis** for multiple students
3. **Limit data** queries to necessary time periods
4. **Monitor** response times and adjust parameters
5. **Optimize** MongoDB indices on common queries

---

## Troubleshooting

**No recommendations returned:**
- Check if student has exam records
- Verify similar students exist
- Check data in MongoDB

**Server error (500):**
- Verify MongoDB connection
- Check error logs
- Ensure required fields in database

**Slow responses:**
- Check MongoDB performance
- Reduce exam data limit
- Consider caching

---

**Last Updated:** February 12, 2026
**Version:** 1.0.0
**Status:** Production Ready
