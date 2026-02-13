# Integration Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Express.js TypeScript Server                   │
│                   (Node.js - Backend Services)                   │
└─────────────────────────────────────────────────────────────────┘
              │
    ┌─────────┼─────────────────────────────────────────┐
    │         │                                         │
    │         ├─────────────────────────────────┬────────┤
    │         │                                 │        │
    ▼         ▼                                 ▼        ▼
┌──────────────────┐    ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐
│  MongoDB         │    │  Frontend / API  │  │  Python        │  │  Recommendation │
│  Database        │    │  Clients         │  │  Engine        │  │  Engine (Python)│
│  ────────────── │    │  ────────────────│  │  ──────────────│  │  ────────────────│
│ • User           │    │ • React Dashboard│  │ • Flask Server │  │ • Collaborative │
│ • Exam           │    │ • Mobile Apps    │  │ • ML Models    │  │   Filtering     │
│ • ExamResult     │    │ • Web Clients    │  │ • Predictions  │  │ • Content-Based │
│ • TeacherRemark  │    └──────────────────┘  └────────────────┘  │ • Performance   │
└──────────────────┘                                                │   Analysis      │
    ▲                                                               └─────────────────┘
    │ (Data retrieval & storage)
    │
┌───┴────────────────────────────────────────────────────────────────────┐
│                     Express Route Handlers                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ Auth Routes      │  │ Admin Routes     │  │ Exam Routes        │ │
│  │ ────────────────│  │ ────────────────│  │ ─────────────────  │ │
│  │ • Register       │  │ • View Users     │  │ • Create Exam      │ │
│  │ • Login          │  │ • View Profiles  │  │ • Edit Exam        │ │
│  │ • Verify Token   │  │ • View Remarks   │  │ • Delete Exam      │ │
│  │ • Refresh Token  │  │ • Manage Users   │  │ • List Exams       │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────┘ │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ Student Routes   │  │ Analytics Routes │  │ Middleware         │ │
│  │ ────────────────│  │ ────────────────│  │ ─────────────────  │ │
│  │ • Take Exam      │  │ • Performance    │  │ • Auth Middleware  │ │
│  │ • View Results   │  │ • Trends         │  │ • Error Handler    │ │
│  │ • Get Profile    │  │ • Insights       │  │ • Rate Limiting    │ │
│  │ • View Remarks   │  │ • Reports        │  │ • CORS Handling    │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Authentication Flow
```
Client Request: POST /auth/login {email, password}
    ↓
Express Route Handler (auth.ts)
    ↓
Find User in MongoDB
    ↓
Compare Password (bcrypt)
    ↓
Generate JWT Token
    ├─ Payload: {userId, email, role}
    └─ Expiration: 1 hour
    ↓
Return: {token, user}
    ├─ Token stored in client
    └─ Used for subsequent requests
```

### Admin Profile Viewing Flow
```
Client Request: GET /admin/users/:userId (Admin only)
    ↓
Authenticate Token (Middleware)
    ↓
Verify Admin Role (requireAdmin Middleware)
    ↓
Query User Collection
    ↓
IF user.role === 'student':
    ├─ Query ExamResult collection
    ├─ Query TeacherRemark collection
    └─ Populate teacher references
    ↓
IF user.role === 'teacher':
    ├─ Query exams created
    └─ Query remarks submitted
    ↓
Return: {user, examResults, remarks}
```

### Exam Submission Flow
```
Client Request: POST /student/exam/:examId/submit {answers}
    ↓
Authenticate Token
    ↓
Query Exam Collection
    ↓
Validate Exam Status (started, not ended)
    ↓
Grade Submission
    ├─ Calculate score
    └─ Calculate percentage
    ↓
Create ExamResult Document
    ├─ student: userId
    ├─ exam: examId
    ├─ score: calculated
    └─ percentage: calculated
    ↓
Save to MongoDB
    ↓
Call Python Recommendation Engine
    ├─ POST to Flask server
    ├─ Send exam results
    └─ Receive recommendations
    ↓
Return: {result, recommendations}
```

### Analytics & Recommendations Flow
```
Client Request: GET /analytics/performance (Authenticated)
    ↓
Extract userId from JWT Token
    ↓
Query ExamResult collection (filter by student)
    ↓
Call Python Engine: GET /recommendations/{studentId}
    ├─ Flask processes data
    ├─ Applies ML algorithms
    └─ Returns predictions
    ↓
Query TeacherRemark collection
    ↓
Aggregate performance data
    ├─ Average score
    ├─ Subject-wise performance
    ├─ Trends over time
    └─ Recommendations
    ↓
Return: {performance, trends, recommendations, remarks}
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

### Express App & Models
```
┌────────────────────────────────────────────────────────────────┐
│                   Express App Instance                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Models (Mongoose Schemas) ───────────────────────────────┐ │
│  │                                                             │ │
│  │  User (models/User.ts)                                     │ │
│  │  ├─ email: string (unique)                                │ │
│  │  ├─ password: string (hashed with bcrypt)                 │ │
│  │  ├─ firstName: string                                     │ │
│  │  ├─ lastName: string                                      │ │
│  │  ├─ role: enum (student, teacher, admin)                  │ │
│  │  ├─ faceEncoding: [float] (optional for biometric auth)   │ │
│  │  └─ Methods: validatePassword(), generateToken()          │ │
│  │                                                             │ │
│  │  Exam (models/Exam.ts)                                     │ │
│  │  ├─ title: string                                          │ │
│  │  ├─ subject: string                                        │ │
│  │  ├─ description: string                                    │ │
│  │  ├─ startTime: datetime                                    │ │
│  │  ├─ endTime: datetime                                      │ │
│  │  ├─ duration: number                                       │ │
│  │  ├─ createdBy: ref(User)                                   │ │
│  │  └─ Methods: isActive(), canStartExam()                    │ │
│  │                                                             │ │
│  │  ExamResult (models/ExamResult.ts)                         │ │
│  │  ├─ student: ref(User)                                     │ │
│  │  ├─ exam: ref(Exam)                                        │ │
│  │  ├─ score: number                                          │ │
│  │  ├─ percentage: float                                      │ │
│  │  ├─ submittedAt: datetime                                  │ │
│  │  ├─ answers: [Object]                                      │ │
│  │  └─ Methods: calculatePercentage()                         │ │
│  │                                                             │ │
│  │  TeacherRemark (models/TeacherRemark.ts)                   │ │
│  │  ├─ student: ref(User)                                     │ │
│  │  ├─ teacher: ref(User)                                     │ │
│  │  ├─ subject: string                                        │ │
│  │  ├─ remark: string                                         │ │
│  │  ├─ rating: number (1-5)                                   │ │
│  │  └─ Methods: validate()                                    │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Route Handlers ───────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Auth Routes (routes/auth.ts)                          │   │
│  │  ├─ POST /auth/register                               │   │
│  │  ├─ POST /auth/login                                  │   │
│  │  └─ POST /auth/refresh-token                          │   │
│  │                                                         │   │
│  │  Admin Routes (routes/admin.ts)                        │   │
│  │  ├─ GET /admin/users                                  │   │
│  │  ├─ GET /admin/users/:userId                          │   │
│  │  └─ DELETE /admin/users/:userId                       │   │
│  │                                                         │   │
│  │  Exam Routes (routes/exam.ts)                          │   │
│  │  ├─ POST /exam/create                                 │   │
│  │  ├─ GET /exam/:examId                                 │   │
│  │  ├─ PUT /exam/:examId                                 │   │
│  │  └─ DELETE /exam/:examId                              │   │
│  │                                                         │   │
│  │  Student Routes (routes/student.ts)                    │   │
│  │  ├─ GET /student/profile                              │   │
│  │  ├─ GET /student/results                              │   │
│  │  ├─ POST /student/exam/:examId/submit                 │   │
│  │  └─ GET /student/remarks                              │   │
│  │                                                         │   │
│  │  Analytics Routes (routes/analytics.ts)                │   │
│  │  ├─ GET /analytics/performance                         │   │
│  │  ├─ GET /analytics/trends                             │   │
│  │  └─ POST /analytics/recommendations                    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Middleware ───────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  authenticateToken (middleware/auth.ts)                │   │
│  │  ├─ Verify JWT token                                  │   │
│  │  ├─ Extract user info                                 │   │
│  │  └─ Attach to request context                         │   │
│  │                                                         │   │
│  │  errorHandler (middleware/errorHandler.ts)             │   │
│  │  ├─ Catch all errors                                  │   │
│  │  ├─ Format error responses                            │   │
│  │  └─ Log errors                                        │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Third-party Services ────────────────────────────────┐    │
│  │                                                         │    │
│  │  Python Recommendation Engine                          │    │
│  │  ├─ Collaborative Filtering                            │    │
│  │  ├─ Content-Based Filtering                            │    │
│  │  ├─ Performance Analysis                               │    │
│  │  └─ HTTP API Interface                                 │    │
│  │                                                         │    │
│  │  MongoDB                                               │    │
│  │  ├─ User Authentication                                │    │
│  │  ├─ Exam Management                                    │    │
│  │  ├─ Result Storage                                     │    │
│  │  └─ Remark Management                                  │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

```
Frontend Layer
      ↓
Express.js (TypeScript - Web Framework)
      ↓
├─ Express Core (Routing, Middleware)
├─ CORS (Cross-Origin Support)
├─ Helmet (Security Headers)
├─ Morgan (Logging)
├─ Compression (Response Compression)
├─ Rate Limiting (DoS Protection)
├─ Socket.IO (Real-time Communication)
└─ Express-Validator (Input Validation)
      ↓
Authentication & Authorization Layer
├─ JWT (Token-based authentication)
├─ Password Hashing (bcrypt)
├─ Role-based Access Control (RBAC)
│  ├─ Student
│  ├─ Teacher
│  └─ Admin
└─ Middleware (auth, requireAdmin)
      ↓
Route Handlers Layer
├─ Auth Routes (Registration, Login, Token Refresh)
├─ Admin Routes (User Management, Profile Views)
├─ Exam Routes (CRUD operations)
├─ Student Routes (Exam Taking, Results)
└─ Analytics Routes (Performance Insights)
      ↓
Data Layer
├─ Mongoose (MongoDB ODM)
├─ Models:
│  ├─ User (Authentication, Profile)
│  ├─ Exam (Exam Configuration)
│  ├─ ExamResult (Student Submissions)
│  └─ TeacherRemark (Teacher Feedback)
└─ MongoDB (NoSQL database)
      ↓
Python Integration Layer
├─ Flask Server (Recommendation Engine)
├─ scikit-learn (ML Algorithms)
├─ NumPy & Pandas (Data Processing)
├─ face_recognition (Identity Verification)
└─ API Communication (HTTP/JSON)
      ↓
Utilities & Infrastructure
├─ Dotenv (Configuration Management)
├─ Logging (Error & Activity Tracking)
├─ TypeScript (Type Safety)
├─ Node.js Runtime
└─ npm/yarn (Package Management)
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

### Input: MongoDB Collections
```
User
├─ _id: ObjectId
├─ email: string (unique)
├─ password: string (hashed)
├─ firstName: string
├─ lastName: string
├─ role: string (student/teacher/admin)
├─ faceEncoding: [float] (optional)
└─ createdAt: datetime

Exam
├─ _id: ObjectId
├─ title: string
├─ subject: string
├─ description: string
├─ startTime: datetime
├─ endTime: datetime
├─ createdBy: ObjectId (teacher)
└─ duration: number

ExamResult
├─ _id: ObjectId
├─ student: ObjectId (ref: User)
├─ exam: ObjectId (ref: Exam)
├─ score: number
├─ percentage: float
├─ submittedAt: datetime
└─ answers: [Object]

TeacherRemark
├─ _id: ObjectId
├─ student: ObjectId (ref: User)
├─ teacher: ObjectId (ref: User)
├─ subject: string
├─ remark: string
├─ rating: number
└─ createdAt: datetime
```

### Output: JSON API Responses
```
Success Response:
{
  "success": true,
  "data": {
    // Resource-specific data
  },
  "message": "Operation successful"
}

Error Response:
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}

Authentication Response:
{
  "success": true,
  "token": "JWT_TOKEN",
  "user": {
    "id": "...",
    "email": "...",
    "role": "..."
  }
}

Recommendations:
{
  "success": true,
  "data": [
    {
      "subject": "string",
      "score": "number",
      "type": "collaborative|content_based|hybrid",
      "reason": "string"
    }
  ]
}
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

**Architecture Version**: 2.0.0  
**Last Updated**: February 13, 2026  
**Status**: TypeScript Express Backend Integration Complete
