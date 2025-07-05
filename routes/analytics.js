import express from 'express';
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

// @route   GET /api/analytics
// @desc    Get analytics data for the user
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Get user's activities for the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const activities = await Activity.find({
      user: user._id,
      date: { $gte: startDate },
      status: 'active'
    }).sort({ date: -1 });

    // Get total footprint
    const totalFootprint = await Activity.getUserTotalFootprint(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    // Get footprint by category
    const footprintByCategory = await Activity.getFootprintByCategory(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    // Generate weekly data
    const weeklyData = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayActivities = activities.filter(activity => 
        activity.date >= dayStart && activity.date <= dayEnd
      );
      
      const dayFootprint = dayActivities.reduce((sum, activity) => 
        sum + activity.carbonFootprint.value, 0
      );
      
      weeklyData.push({
        day: days[date.getDay()],
        footprint: dayFootprint,
        target: 15 // Default daily target
      });
    }

    // Generate category breakdown
    const categoryBreakdown = footprintByCategory.map(category => ({
      category: category._id,
      value: category.totalKg,
      percentage: totalFootprint.totalKg > 0 ? 
        (category.totalKg / totalFootprint.totalKg * 100) : 0
    }));

    // Generate comparisons
    const comparisons = [
      { label: "City Average", value: 280, better: totalFootprint.totalKg < 280 },
      { label: "Country Average", value: 320, better: totalFootprint.totalKg < 320 },
      { label: "Similar Households", value: 195, better: totalFootprint.totalKg < 195 },
      { label: "Global Average", value: 450, better: totalFootprint.totalKg < 450 }
    ];

    res.json({
      weeklyData,
      categoryBreakdown,
      comparisons,
      totalFootprint: totalFootprint.totalKg,
      activityCount: activities.length
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router; 