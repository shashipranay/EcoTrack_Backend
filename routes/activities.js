import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import Activity from '../models/Activity.js';
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

// @route   POST /api/activities
// @desc    Create a new activity
// @access  Private
router.post('/', [
  authenticateToken,
  body('category')
    .isIn(['transportation', 'energy', 'food', 'waste', 'water', 'shopping', 'travel', 'other'])
    .withMessage('Invalid category'),
  body('subcategory')
    .notEmpty()
    .withMessage('Subcategory is required'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('carbonFootprint.value')
    .isFloat({ min: 0 })
    .withMessage('Carbon footprint value must be a positive number'),
  body('carbonFootprint.unit')
    .isIn(['kg', 'tons'])
    .withMessage('Carbon footprint unit must be kg or tons'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO date')
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
    const activityData = {
      ...req.body,
      user: user._id,
      date: req.body.date ? new Date(req.body.date) : new Date()
    };

    const activity = new Activity(activityData);
    await activity.save();

    // Update user's total carbon footprint
    const carbonValue = activity.carbonFootprint.unit === 'tons' 
      ? activity.carbonFootprint.value * 1000 
      : activity.carbonFootprint.value;
    
    user.carbonFootprint.total += carbonValue;
    user.carbonFootprint.lastCalculated = new Date();
    await user.save();

    res.status(201).json({
      message: 'Activity created successfully',
      activity: activity.toResponseFormat()
    });

  } catch (error) {
    console.error('Create activity error:', error);
    if (error.errors) {
      // Mongoose validation error
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      res.status(500).json({ error: 'Server error', message: error.message });
    }
  }
});

// @route   GET /api/activities
// @desc    Get user's activities
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 10, category, startDate, endDate } = req.query;

    const filter = { user: user._id, status: 'active' };

    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const activities = await Activity.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Activity.countDocuments(filter);

    res.json({
      activities: activities.map(activity => activity.toResponseFormat()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/activities/stats
// @desc    Get activity statistics
// @access  Private
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = req.query;

    const totalFootprint = await Activity.getUserTotalFootprint(
      user._id, 
      startDate, 
      endDate
    );

    const footprintByCategory = await Activity.getFootprintByCategory(
      user._id, 
      startDate, 
      endDate
    );

    res.json({
      totalFootprint,
      footprintByCategory,
      userStats: user.getStats()
    });

  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/activities/:id
// @desc    Get a specific activity
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const activity = await Activity.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ activity: activity.toResponseFormat() });

  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/activities/:id
// @desc    Update an activity
// @access  Private
router.put('/:id', [
  authenticateToken,
  body('category')
    .optional()
    .isIn(['transportation', 'energy', 'food', 'waste', 'water', 'shopping', 'travel', 'other'])
    .withMessage('Invalid category'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('carbonFootprint.value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Carbon footprint value must be a positive number')
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
    const activity = await Activity.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Calculate the difference in carbon footprint
    const oldCarbonValue = activity.carbonFootprint.unit === 'tons' 
      ? activity.carbonFootprint.value * 1000 
      : activity.carbonFootprint.value;

    // Update activity
    Object.assign(activity, req.body);
    await activity.save();

    const newCarbonValue = activity.carbonFootprint.unit === 'tons' 
      ? activity.carbonFootprint.value * 1000 
      : activity.carbonFootprint.value;

    // Update user's total carbon footprint
    const difference = newCarbonValue - oldCarbonValue;
    user.carbonFootprint.total += difference;
    user.carbonFootprint.lastCalculated = new Date();
    await user.save();

    res.json({
      message: 'Activity updated successfully',
      activity: activity.toResponseFormat()
    });

  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/activities/:id
// @desc    Delete an activity
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const activity = await Activity.findOne({
      _id: req.params.id,
      user: user._id
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Update user's total carbon footprint
    const carbonValue = activity.carbonFootprint.unit === 'tons' 
      ? activity.carbonFootprint.value * 1000 
      : activity.carbonFootprint.value;
    
    user.carbonFootprint.total -= carbonValue;
    user.carbonFootprint.lastCalculated = new Date();
    await user.save();

    await Activity.findByIdAndDelete(req.params.id);

    res.json({ message: 'Activity deleted successfully' });

  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/activities/categories
// @desc    Get available activity categories
// @access  Private
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = [
      {
        name: 'transportation',
        label: 'Transportation',
        subcategories: ['car', 'bus', 'train', 'plane', 'bike', 'walk', 'scooter', 'motorcycle']
      },
      {
        name: 'energy',
        label: 'Energy',
        subcategories: ['electricity', 'gas', 'heating', 'cooling', 'renewable']
      },
      {
        name: 'food',
        label: 'Food',
        subcategories: ['meat', 'dairy', 'vegetables', 'fruits', 'grains', 'processed', 'organic']
      },
      {
        name: 'waste',
        label: 'Waste',
        subcategories: ['plastic', 'paper', 'glass', 'metal', 'organic', 'electronics']
      },
      {
        name: 'water',
        label: 'Water',
        subcategories: ['drinking', 'showering', 'laundry', 'dishwashing', 'irrigation']
      },
      {
        name: 'shopping',
        label: 'Shopping',
        subcategories: ['clothing', 'electronics', 'furniture', 'cosmetics', 'books']
      },
      {
        name: 'travel',
        label: 'Travel',
        subcategories: ['vacation', 'business', 'local', 'international']
      },
      {
        name: 'other',
        label: 'Other',
        subcategories: ['entertainment', 'services', 'custom']
      }
    ];

    res.json({ categories });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;