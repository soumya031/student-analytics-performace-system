from flask import Flask, request, jsonify
from flask_cors import CORS
import pymongo
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import NMF
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

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
try:
    client = pymongo.MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
    db = client['student_analytics']
    logger.info("Connected to MongoDB")
except Exception as e:
    logger.error(f"MongoDB connection error: {e}")
    db = None

class CollaborativeFiltering:
    def __init__(self):
        self.user_item_matrix = None
        self.user_similarity_matrix = None
        self.item_similarity_matrix = None
        self.nmf_model = None
        
    def create_user_item_matrix(self, exam_results):
        """Create user-item matrix from exam results"""
        if not exam_results:
            return None
            
        # Create DataFrame from exam results
        data = []
        for result in exam_results:
            data.append({
                'student_id': str(result['student']),
                'subject': result['exam']['subject'],
                'score': result['percentage']
            })
        
        df = pd.DataFrame(data)
        
        # Create pivot table
        self.user_item_matrix = df.pivot_table(
            index='student_id', 
            columns='subject', 
            values='score', 
            fill_value=0
        )
        
        return self.user_item_matrix
    
    def calculate_user_similarity(self):
        """Calculate user similarity matrix using cosine similarity"""
        if self.user_item_matrix is None:
            return None
            
        self.user_similarity_matrix = cosine_similarity(self.user_item_matrix)
        return self.user_similarity_matrix
    
    def calculate_item_similarity(self):
        """Calculate item similarity matrix using cosine similarity"""
        if self.user_item_matrix is None:
            return None
            
        self.item_similarity_matrix = cosine_similarity(self.user_item_matrix.T)
        return self.item_similarity_matrix
    
    def fit_nmf(self, n_components=10):
        """Fit Non-negative Matrix Factorization model"""
        if self.user_item_matrix is None:
            return None
            
        self.nmf_model = NMF(n_components=n_components, random_state=42)
        self.nmf_model.fit(self.user_item_matrix)
        return self.nmf_model
    
    def get_user_recommendations(self, user_id, n_recommendations=5):
        """Get personalized recommendations for a user"""
        if self.user_item_matrix is None or user_id not in self.user_item_matrix.index:
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
        self.known_faces = {}
        self.face_locations = []
        self.face_encodings = []
        
    def encode_face_from_base64(self, image_base64):
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
    
    def detect_faces(self, image_base64):
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
    
    def verify_student_identity(self, student_image_base64, stored_face_encoding):
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
            'face_detection': True
        }
    })

@app.route('/recommendations/<user_id>', methods=['GET'])
def get_recommendations(user_id):
    """Get personalized recommendations for a user"""
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
        recommendations = cf_system.get_user_recommendations(user_id)
        
        return jsonify({
            'recommendations': recommendations,
            'user_id': user_id,
            'total_exams_analyzed': len(exam_results)
        })
        
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return jsonify({'error': 'Failed to generate recommendations'}), 500

@app.route('/face-detection/detect', methods=['POST'])
def detect_faces():
    """Detect faces in uploaded image"""
    try:
        data = request.get_json()
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
        data = request.get_json()
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
        data = request.get_json()
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

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True) 