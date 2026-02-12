from flask import Flask, request, jsonify
from flask_cors import CORS
import pymongo
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import NMF
from sklearn.feature_extraction.text import TfidfVectorizer
import face_recognition
import cv2
import base64
import io
from PIL import Image
import os
from dotenv import load_dotenv
import json
from datetime import datetime
import logging
from typing import Optional, List, Dict, Any
import time
import psutil
import math

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

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
        
    def encode_face_from_base64(self, image_base64: str) -> Optional[np.ndarray]:
        """Encode face from base64 image"""
        try:
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
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'mongodb': db is not None,
            'recommendation_system': True,
            'face_detection': True,
            'performance_analyzer': True
        }
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