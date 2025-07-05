import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
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

// @route   POST /api/goals
// @desc    Create a new goal
// @access  Private
router.post('/', [
  authenticateToken,
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('category')
    .isIn(['carbon_reduction', 'energy_savings', 'waste_reduction', 'water_conservation', 'sustainable_transport', 'eco_friendly_lifestyle', 'education', 'community', 'other'])
    .withMessage('Invalid category'),
  body('target.value')
    .isFloat({ min: 0 })
    .withMessage('Target value must be a positive number'),
  body('target.unit')
    .isIn(['kg', 'tons', 'kwh', 'liters', 'items', 'percentage', 'days', 'count'])
    .withMessage('Invalid target unit'),
  body('target.timeframe')
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Invalid timeframe'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO date')
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
    const goalData = {
      ...req.body,
      user: user._id,
      startDate: new Date(),
      endDate: new Date(req.body.endDate)
    };

    const goal = new Goal(goalData);
    await goal.save();

    res.status(201).json({
      message: 'Goal created successfully',
      goal: goal.toResponseFormat()
    });

  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/goals
// @desc    Get user's goals
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { status, category, page = 1, limit = 10 } = req.query;

    const filter = { user: user._id };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const goals = await Goal.find(filter)
      .sort({ endDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Goal.countDocuments(filter);

    res.json({
      goals: goals.map(goal => goal.toResponseFormat()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/goals/:id
// @desc    Get a specific goal
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const goal = await Goal.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ goal: goal.toResponseFormat() });

  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/goals/:id
// @desc    Update a goal
// @access  Private
router.put('/:id', [
  authenticateToken,
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('target.value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Target value must be a positive number')
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
    const goal = await Goal.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Update goal
    Object.assign(goal, req.body);
    await goal.save();

    res.json({
      message: 'Goal updated successfully',
      goal: goal.toResponseFormat()
    });

  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/goals/:id/progress
// @desc    Update goal progress
// @access  Private
router.put('/:id/progress', [
  authenticateToken,
  body('value')
    .isFloat({ min: 0 })
    .withMessage('Progress value must be a positive number')
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
    const goal = await Goal.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Update progress
    await goal.updateProgress(req.body.value);

    res.json({
      message: 'Progress updated successfully',
      goal: goal.toResponseFormat()
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/goals/:id
// @desc    Delete a goal
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const goal = await Goal.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    await Goal.findByIdAndDelete(req.params.id);

    res.json({ message: 'Goal deleted successfully' });

  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/goals/stats/overview
// @desc    Get goals statistics overview
// @access  Private
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    const activeGoals = await Goal.getUserActiveGoals(user._id);
    const completedGoals = await Goal.find({
      user: user._id,
      status: 'completed'
    }).sort({ updatedAt: -1 }).limit(5);

    const stats = {
      total: await Goal.countDocuments({ user: user._id }),
      active: activeGoals.length,
      completed: await Goal.countDocuments({ user: user._id, status: 'completed' }),
      overdue: activeGoals.filter(goal => goal.isOverdue).length,
      averageProgress: activeGoals.length > 0 
        ? activeGoals.reduce((sum, goal) => sum + goal.progressPercentage, 0) / activeGoals.length 
        : 0
    };

    res.json({
      stats,
      activeGoals: activeGoals.map(goal => goal.toResponseFormat()),
      recentCompleted: completedGoals.map(goal => goal.toResponseFormat())
    });

  } catch (error) {
    console.error('Get goals stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;