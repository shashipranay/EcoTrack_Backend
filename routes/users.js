import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      profile: user.profile,
      carbonFootprint: user.carbonFootprint,
      preferences: user.preferences,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  authenticateToken,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('profile.age')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Age must be between 1 and 120'),
  body('profile.lifestyle')
    .optional()
    .isIn(['sedentary', 'moderate', 'active'])
    .withMessage('Lifestyle must be sedentary, moderate, or active'),
  body('profile.householdSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Household size must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const user = req.user;
    const { name, profile, preferences } = req.body;

    // Update allowed fields
    if (name) user.name = name;
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    // Recalculate baseline if lifestyle changed
    if (profile?.lifestyle && profile.lifestyle !== user.profile.lifestyle) {
      user.calculateBaseline();
    }

    await user.save();

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      profile: user.profile,
      carbonFootprint: user.carbonFootprint,
      preferences: user.preferences,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const stats = user.getStats();

    res.json({
      stats,
      user: {
        id: user._id,
        name: user.name,
        profile: user.profile,
        carbonFootprint: user.carbonFootprint
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', [
  authenticateToken,
  body('units')
    .optional()
    .isIn(['metric', 'imperial'])
    .withMessage('Units must be metric or imperial'),
  body('notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be boolean'),
  body('notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notifications must be boolean'),
  body('privacy.shareData')
    .optional()
    .isBoolean()
    .withMessage('Share data must be boolean'),
  body('privacy.publicProfile')
    .optional()
    .isBoolean()
    .withMessage('Public profile must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const user = req.user;
    const { units, notifications, privacy } = req.body;

    if (units) user.preferences.units = units;
    if (notifications) {
      user.preferences.notifications = { ...user.preferences.notifications, ...notifications };
    }
    if (privacy) {
      user.preferences.privacy = { ...user.preferences.privacy, ...privacy };
    }

    await user.save();

    res.json({
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Soft delete - mark as inactive
    user.isActive = false;
    await user.save();

    res.json({ message: 'Account deactivated successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router; 