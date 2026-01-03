import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Chip,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  School,
  Assessment,
  Person,
  Logout,
  Login,
  PersonAdd,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
    navigate('/login');
  };

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path) => location.pathname.startsWith(path);

  /* ===== FIX: use /exams (plural) ===== */
  const menuItems = [
    { text: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
    { text: 'Exams', path: '/exam', icon: <School /> },
    { text: 'Analytics', path: '/analytics', icon: <Assessment /> },
    { text: 'Profile', path: '/profile', icon: <Person /> },
  ];

  const renderDesktopMenu = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {menuItems.map((item) => (
        <Button
          key={item.path}
          color="inherit"
          onClick={() => navigate(item.path)}
          sx={{
            backgroundColor: isActive(item.path)
              ? 'rgba(255, 255, 255, 0.1)'
              : 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {item.text}
        </Button>
      ))}
    </Box>
  );

  const renderMobileMenu = () => (
    <Drawer
      anchor="left"
      open={mobileOpen}
      onClose={handleMobileToggle}
      sx={{
        '& .MuiDrawer-paper': {
          width: 240,
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" color="primary">
          Student Analytics
        </Typography>
      </Box>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem
            key={item.path}
            button
            onClick={() => handleNavigation(item.path)}
            selected={isActive(item.path)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem button onClick={handleLogout}>
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Drawer>
  );

  const renderAuthButtons = () => {
    if (!user) {
      return (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            color="inherit"
            startIcon={<Login />}
            onClick={() => navigate('/login')}
          >
            Login
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<PersonAdd />}
            onClick={() => navigate('/register')}
          >
            Register
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {user.role === 'student' && (
          <Chip
            label={user.studentId || 'Student'}
            size="small"
            color="secondary"
            variant="outlined"
          />
        )}
        <IconButton
          onClick={handleMenuOpen}
          sx={{ color: 'inherit' }}
        >
          <Avatar
            sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}
          >
            {user.firstName?.charAt(0) || user.email?.charAt(0)}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem
            onClick={() => {
              handleMenuClose();
              navigate('/profile');
            }}
          >
            <Person sx={{ mr: 1 }} />
            Profile
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <Logout sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      </Box>
    );
  };

  return (
    <>
      <AppBar position="fixed" elevation={1}>
        <Toolbar>
          {user && isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleMobileToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/dashboard')}
          >
            Student Analytics
          </Typography>

          {user && !isMobile && renderDesktopMenu()}
          {renderAuthButtons()}
        </Toolbar>
      </AppBar>

      {user && renderMobileMenu()}
    </>
  );
};

export default Navbar;
