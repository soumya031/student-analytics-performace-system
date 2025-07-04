# Student Analytics Performance System

A comprehensive full-stack application for student performance tracking, exam management, and analytics with face detection and collaborative filtering recommendations.

## 🚀 Features

### Core Features
- **User Authentication**: Secure login/register with JWT tokens
- **Exam Management**: Create, take, and submit exams with real-time monitoring
- **Face Detection**: Virtual proctoring with face recognition
- **Performance Analytics**: Detailed performance tracking and visualization
- **Collaborative Filtering**: AI-powered personalized recommendations
- **Real-time Monitoring**: Live exam monitoring with Socket.IO

### Subjects Covered
- **Aptitude**: Logical reasoning and problem-solving
- **Data Structures & Algorithms (DSA)**: Programming and algorithm concepts
- **Computer Science**: Core CS fundamentals

## 🏗️ Architecture

```
├── Frontend (React + Material-UI)
│   ├── Authentication & User Management
│   ├── Exam Interface with Webcam
│   ├── Analytics Dashboard
│   └── Profile Management
├── Backend (Node.js + TypeScript + Express)
│   ├── RESTful APIs
│   ├── JWT Authentication
│   ├── MongoDB Integration
│   └── Socket.IO for Real-time
└── Python Service (Flask)
    ├── Collaborative Filtering
    ├── Face Detection & Recognition
    └── Performance Analytics
```

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI Framework
- **Material-UI** - Component Library
- **React Router** - Navigation
- **Axios** - HTTP Client
- **React Webcam** - Camera Integration
- **Face-api.js** - Client-side Face Detection
- **Chart.js** - Data Visualization

### Backend
- **Node.js** - Runtime Environment
- **TypeScript** - Type Safety
- **Express.js** - Web Framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Socket.IO** - Real-time Communication
- **JWT** - Authentication
- **bcryptjs** - Password Hashing

### Python Service
- **Flask** - Web Framework
- **OpenCV** - Computer Vision
- **face-recognition** - Face Detection
- **scikit-learn** - Machine Learning
- **pandas** - Data Processing
- **numpy** - Numerical Computing

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn**

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd student-analytics-performance-system
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

### 4. Install Python Dependencies
```bash
cd python-recommendation
pip install -r requirements.txt
cd ..
```

### 5. Environment Configuration

#### Backend Environment (.env)
Create `backend/.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/student_analytics
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

#### Frontend Environment (.env)
Create `.env` file in root:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_PYTHON_API_URL=http://localhost:5001
```

### 6. Start MongoDB
```bash
# Start MongoDB service
mongod
```

### 7. Run the Application

#### Option 1: Run All Services Concurrently
```bash
npm run dev
```

#### Option 2: Run Services Separately

**Terminal 1 - Frontend:**
```bash
npm start
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 3 - Python Service:**
```bash
cd python-recommendation
python app.py
```

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Python Service**: http://localhost:5001

## 👤 Demo Credentials

### Student Account
- **Email**: student@example.com
- **Password**: password123

### Teacher Account
- **Email**: teacher@example.com
- **Password**: password123

### Admin Account
- **Email**: admin@example.com
- **Password**: password123

## 📁 Project Structure

```
student-analytics-performance-system/
├── src/                          # React Frontend
│   ├── components/               # React Components
│   │   ├── auth/                # Authentication Components
│   │   ├── exam/                # Exam-related Components
│   │   └── ...
│   ├── contexts/                # React Contexts
│   ├── utils/                   # Utility Functions
│   └── App.js                   # Main App Component
├── backend/                      # Node.js Backend
│   ├── src/
│   │   ├── models/              # MongoDB Models
│   │   ├── routes/              # API Routes
│   │   ├── middleware/          # Express Middleware
│   │   ├── controllers/         # Route Controllers
│   │   └── index.ts             # Server Entry Point
│   ├── package.json
│   └── tsconfig.json
├── python-recommendation/        # Python ML Service
│   ├── app.py                   # Flask Application
│   └── requirements.txt         # Python Dependencies
├── package.json                 # Frontend Dependencies
└── README.md                    # Project Documentation
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Exams
- `GET /api/exam/available` - Get available exams
- `GET /api/exam/:id` - Get exam details
- `POST /api/exam/:id/start` - Start exam
- `POST /api/exam/:id/submit` - Submit exam
- `GET /api/exam/:id/result` - Get exam result

### Analytics
- `GET /api/student/analytics` - Get student analytics
- `GET /api/analytics/peer-comparison` - Peer comparison
- `GET /api/analytics/recommendations` - Get recommendations

### Python Service
- `GET /health` - Health check
- `GET /recommendations/:userId` - Get ML recommendations
- `POST /face-detection/detect` - Face detection
- `POST /face-detection/verify` - Identity verification
- `POST /face-detection/register` - Register face

## 🎯 Key Features Explained

### 1. Face Detection & Proctoring
- Real-time face detection during exams
- Identity verification using face recognition
- Cheating attempt detection
- Face presence monitoring

### 2. Collaborative Filtering
- User-based collaborative filtering
- Item-based similarity calculations
- Non-negative Matrix Factorization (NMF)
- Personalized subject recommendations

### 3. Performance Analytics
- Subject-wise performance tracking
- Peer comparison analysis
- Performance trends over time
- Grade calculation and visualization

### 4. Real-time Exam Monitoring
- Live exam progress tracking
- Face detection events
- Cheating attempt alerts
- Exam completion notifications

## 🚀 Deployment

### Frontend Deployment
```bash
npm run build
# Deploy the build folder to your hosting service
```

### Backend Deployment
```bash
cd backend
npm run build
npm start
```

### Python Service Deployment
```bash
cd python-recommendation
gunicorn app:app -w 4 -b 0.0.0.0:5001
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Future Enhancements

- [ ] Advanced ML models for recommendations
- [ ] Mobile app development
- [ ] Integration with LMS systems
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Offline exam capability
- [ ] Advanced proctoring features
