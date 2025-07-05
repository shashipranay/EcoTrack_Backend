import express from 'express';
import jwt from 'jsonwebtoken';
import Achievement from '../models/Achievement.js';
import Activity from '../models/Activity.js';
import Goal from '../models/Goal.js';
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

// @route   GET /api/achievements
// @desc    Get user's achievements
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { status, category, page = 1, limit = 10 } = req.query;

    const filter = { user: user._id };
    if (status === 'unlocked') {
      filter.isUnlocked = true;
    } else if (status === 'available') {
      filter.isUnlocked = false;
      filter.isHidden = false;
    }
    if (category) filter.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const achievements = await Achievement.find(filter)
      .sort({ rarity: 1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Achievement.countDocuments(filter);

    res.json({
      achievements: achievements.map(achievement => achievement.toResponseFormat()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/achievements/unlocked
// @desc    Get user's unlocked achievements
// @access  Private
router.get('/unlocked', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const achievements = await Achievement.getUserUnlockedAchievements(user._id);

    res.json({
      achievements: achievements.map(achievement => achievement.toResponseFormat())
    });

  } catch (error) {
    console.error('Get unlocked achievements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/achievements/available
// @desc    Get user's available achievements
// @access  Private
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const achievements = await Achievement.getUserAvailableAchievements(user._id);

    res.json({
      achievements: achievements.map(achievement => achievement.toResponseFormat())
    });

  } catch (error) {
    console.error('Get available achievements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/achievements/:id
// @desc    Get a specific achievement
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const achievement = await Achievement.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    res.json({ achievement: achievement.toResponseFormat() });

  } catch (error) {
    console.error('Get achievement error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/achievements/check
// @desc    Check and update achievement progress
// @access  Private
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const newlyUnlocked = [];

    // Get user's available achievements
    const availableAchievements = await Achievement.getUserAvailableAchievements(user._id);

    for (const achievement of availableAchievements) {
      const progress = await calculateAchievementProgress(user, achievement);
      
      if (progress !== achievement.progress.current) {
        await achievement.updateProgress(progress);
        
        if (achievement.isUnlocked && !achievement.unlockedAt) {
          newlyUnlocked.push(achievement.toResponseFormat());
        }
      }
    }

    res.json({
      message: 'Achievement progress updated',
      newlyUnlocked,
      totalUnlocked: newlyUnlocked.length
    });

  } catch (error) {
    console.error('Check achievements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/achievements/stats/overview
// @desc    Get achievements statistics overview
// @access  Private
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    const unlockedAchievements = await Achievement.getUserUnlockedAchievements(user._id);
    const availableAchievements = await Achievement.getUserAvailableAchievements(user._id);
    const totalPoints = await Achievement.getUserTotalPoints(user._id);

    const stats = {
      total: await Achievement.countDocuments({ user: user._id }),
      unlocked: unlockedAchievements.length,
      available: availableAchievements.length,
      totalPoints: totalPoints.totalPoints,
      achievementCount: totalPoints.achievementCount,
      completionRate: await Achievement.countDocuments({ user: user._id }) > 0 
        ? (unlockedAchievements.length / await Achievement.countDocuments({ user: user._id })) * 100 
        : 0
    };

    // Group by rarity
    const rarityStats = {};
    unlockedAchievements.forEach(achievement => {
      rarityStats[achievement.rarity] = (rarityStats[achievement.rarity] || 0) + 1;
    });

    res.json({
      stats,
      rarityStats,
      recentUnlocked: unlockedAchievements.slice(0, 5).map(achievement => achievement.toResponseFormat())
    });

  } catch (error) {
    console.error('Get achievements stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to calculate achievement progress
async function calculateAchievementProgress(user, achievement) {
  const { metric, threshold, timeframe } = achievement.criteria;
  
  let progress = 0;
  const now = new Date();
  let startDate = new Date();

  // Set start date based on timeframe
  switch (timeframe) {
    case 'daily':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'monthly':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'yearly':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'lifetime':
    default:
      startDate = new Date(0); // Beginning of time
      break;
  }

  switch (metric) {
    case 'carbon_reduction':
      const baseline = user.carbonFootprint.baseline;
      const current = user.carbonFootprint.total;
      progress = Math.max(0, baseline - current);
      break;

    case 'activities_count':
      progress = await Activity.countDocuments({
        user: user._id,
        date: { $gte: startDate },
        status: 'active'
      });
      break;

    case 'streak_days':
      // Calculate current streak of consecutive days with activities
      const activities = await Activity.find({
        user: user._id,
        date: { $gte: startDate },
        status: 'active'
      }).sort({ date: -1 });

      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < 365; i++) { // Check up to 1 year
        const dayActivities = activities.filter(activity => {
          const activityDate = new Date(activity.date);
          activityDate.setHours(0, 0, 0, 0);
          return activityDate.getTime() === currentDate.getTime();
        });

        if (dayActivities.length > 0) {
          streak++;
        } else {
          break;
        }

        currentDate.setDate(currentDate.getDate() - 1);
      }
      progress = streak;
      break;

    case 'goals_completed':
      progress = await Goal.countDocuments({
        user: user._id,
        status: 'completed',
        updatedAt: { $gte: startDate }
      });
      break;

    case 'community_posts':
      // Placeholder for community features
      progress = 0;
      break;

    case 'education_modules':
      // Placeholder for education features
      progress = 0;
      break;

    default:
      progress = 0;
  }

  return Math.min(progress, threshold);
}

export default router; 