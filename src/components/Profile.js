import React, { useState } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Person, Save, Lock } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    department: user?.department || '',
    year: user?.year || '',
    semester: user?.semester || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const result = await updateProfile(profileData);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      setPasswordLoading(false);
      return;
    }

    const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setPasswordLoading(false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Profile Settings
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Person sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Personal Information
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleProfileSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      name="firstName"
                      value={profileData.firstName}
                      onChange={handleProfileChange}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      name="lastName"
                      value={profileData.lastName}
                      onChange={handleProfileChange}
                      required
                    />
                  </Grid>
                  
                  {user?.role === 'student' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Department</InputLabel>
                          <Select
                            name="department"
                            value={profileData.department}
                            label="Department"
                            onChange={handleProfileChange}
                          >
                            <MenuItem value="Computer Science">Computer Science</MenuItem>
                            <MenuItem value="Information Technology">Information Technology</MenuItem>
                            <MenuItem value="Electronics">Electronics</MenuItem>
                            <MenuItem value="Mechanical">Mechanical</MenuItem>
                            <MenuItem value="Civil">Civil</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Year</InputLabel>
                          <Select
                            name="year"
                            value={profileData.year}
                            label="Year"
                            onChange={handleProfileChange}
                          >
                            <MenuItem value={1}>1st Year</MenuItem>
                            <MenuItem value={2}>2nd Year</MenuItem>
                            <MenuItem value={3}>3rd Year</MenuItem>
                            <MenuItem value={4}>4th Year</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Semester</InputLabel>
                          <Select
                            name="semester"
                            value={profileData.semester}
                            label="Semester"
                            onChange={handleProfileChange}
                          >
                            <MenuItem value={1}>1st Semester</MenuItem>
                            <MenuItem value={2}>2nd Semester</MenuItem>
                            <MenuItem value={3}>3rd Semester</MenuItem>
                            <MenuItem value={4}>4th Semester</MenuItem>
                            <MenuItem value={5}>5th Semester</MenuItem>
                            <MenuItem value={6}>6th Semester</MenuItem>
                            <MenuItem value={7}>7th Semester</MenuItem>
                            <MenuItem value={8}>8th Semester</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}
                </Grid>

                <Box sx={{ mt: 3 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                    disabled={loading}
                    fullWidth
                  >
                    {loading ? 'Updating...' : 'Update Profile'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                  {user?.firstName?.charAt(0) || user?.email?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email}
                  </Typography>
                  {user?.role === 'student' && (
                    <Typography variant="body2" color="text.secondary">
                      Student ID: {user?.studentId}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Role:</strong> {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </Typography>
              {user?.department && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Department:</strong> {user?.department}
                </Typography>
              )}
              {user?.year && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Year:</strong> {user?.year}
                </Typography>
              )}
              {user?.semester && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Semester:</strong> {user?.semester}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                <strong>Member since:</strong> {new Date(user?.createdAt).toLocaleDateString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Change Password */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Lock sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Change Password
                </Typography>
              </Box>

              <Box component="form" onSubmit={handlePasswordSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      name="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="New Password"
                      name="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      required
                      helperText="Minimum 6 characters"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      name="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3 }}>
                  <Button
                    type="submit"
                    variant="outlined"
                    startIcon={passwordLoading ? <CircularProgress size={20} /> : <Lock />}
                    disabled={passwordLoading}
                    fullWidth
                  >
                    {passwordLoading ? 'Changing Password...' : 'Change Password'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Profile; 