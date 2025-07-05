import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';
import jwt from 'jsonwebtoken';
import Activity from '../models/Activity.js';
import User from '../models/User.js';

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// @route   GET /api/insights
// @desc    Get AI insights for the user
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Get user's recent activities
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const activities = await Activity.find({
      user: user._id,
      date: { $gte: startDate },
      status: 'active'
    }).sort({ date: -1 });

    const totalFootprint = await Activity.getUserTotalFootprint(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    const footprintByCategory = await Activity.getFootprintByCategory(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    // Generate AI insights
    const insights = await generateInsights(user, activities, totalFootprint, footprintByCategory);

    res.json({
      insights: insights || []
    });

  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/insights/generate
// @desc    Generate new AI insights
// @access  Private
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Get user's recent activities
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const activities = await Activity.find({
      user: user._id,
      date: { $gte: startDate },
      status: 'active'
    }).sort({ date: -1 });

    const totalFootprint = await Activity.getUserTotalFootprint(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    const footprintByCategory = await Activity.getFootprintByCategory(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    // Generate new AI insights
    const insights = await generateInsights(user, activities, totalFootprint, footprintByCategory);

    res.json({
      message: 'Insights generated successfully',
      insights: insights || []
    });

  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/insights/overview
// @desc    Get AI-powered insights overview
// @access  Private
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { timeframe = '30' } = req.query;

    // Get user's recent activities
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    const activities = await Activity.find({
      user: user._id,
      date: { $gte: startDate },
      status: 'active'
    }).sort({ date: -1 });

    const totalFootprint = await Activity.getUserTotalFootprint(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    const footprintByCategory = await Activity.getFootprintByCategory(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    // Generate AI insights
    const insights = await generateInsights(user, activities, totalFootprint, footprintByCategory);

    res.json({
      insights,
      summary: {
        totalFootprint,
        footprintByCategory,
        activityCount: activities.length,
        timeframe: parseInt(timeframe)
      }
    });

  } catch (error) {
    console.error('Get insights overview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/insights/analyze
// @desc    Get custom AI analysis
// @access  Private
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { question, timeframe = '30' } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Get user's data for analysis
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    const activities = await Activity.find({
      user: user._id,
      date: { $gte: startDate },
      status: 'active'
    }).sort({ date: -1 });

    const totalFootprint = await Activity.getUserTotalFootprint(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    // Generate custom analysis
    const analysis = await generateCustomAnalysis(user, activities, totalFootprint, question);

    res.json({
      analysis,
      data: {
        activities: activities.length,
        totalFootprint,
        timeframe: parseInt(timeframe)
      }
    });

  } catch (error) {
    console.error('Custom analysis error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/insights/recommendations
// @desc    Get personalized recommendations
// @access  Private
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { category } = req.query;

    // Get user's recent activities
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const activities = await Activity.find({
      user: user._id,
      date: { $gte: startDate },
      status: 'active'
    }).sort({ date: -1 });

    const totalFootprint = await Activity.getUserTotalFootprint(
      user._id, 
      startDate.toISOString(), 
      new Date().toISOString()
    );

    // Generate recommendations
    const recommendations = await generateRecommendations(user, activities, totalFootprint, category);

    res.json({
      recommendations,
      userProfile: {
        lifestyle: user.profile.lifestyle,
        totalFootprint: user.carbonFootprint.total,
        baseline: user.carbonFootprint.baseline
      }
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to generate insights
async function generateInsights(user, activities, totalFootprint, footprintByCategory) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
    As an environmental sustainability expert, analyze this user's carbon footprint data and provide insights:

    User Profile:
    - Name: ${user.name}
    - Lifestyle: ${user.profile.lifestyle}
    - Household Size: ${user.profile.householdSize}
    - Location: ${user.profile.location || 'Not specified'}

    Carbon Footprint Data (last 30 days):
    - Total: ${totalFootprint.totalTons.toFixed(2)} tons CO2
    - Activities: ${activities.length}
    - Breakdown by category: ${JSON.stringify(footprintByCategory)}

    Recent Activities (last 5):
    ${activities.slice(0, 5).map(activity => 
      `- ${activity.title}: ${activity.carbonFootprint.value} ${activity.carbonFootprint.unit} CO2`
    ).join('\n')}

    Please provide:
    1. A brief overview of their carbon footprint
    2. Key insights about their environmental impact
    3. Areas for improvement
    4. Positive actions they're taking
    5. Comparison to average (global average is ~4.5 tons/year)

    Format as JSON with keys: overview, insights, improvements, positives, comparison
    Keep each section concise (2-3 sentences max).
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse JSON, fallback to text if parsing fails
    try {
      return JSON.parse(text);
    } catch {
      return {
        overview: text,
        insights: "Analysis completed",
        improvements: "See overview for details",
        positives: "See overview for details",
        comparison: "See overview for details"
      };
    }

  } catch (error) {
    console.error('AI insights generation error:', error);
    return {
      overview: "Unable to generate AI insights at this time.",
      insights: "Please try again later.",
      improvements: "Focus on reducing high-impact activities.",
      positives: "Every small action counts!",
      comparison: "Track your progress over time."
    };
  }
}

// Helper function to generate custom analysis
async function generateCustomAnalysis(user, activities, totalFootprint, question) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
    As an environmental sustainability expert, answer this specific question about the user's carbon footprint:

    Question: ${question}

    User Data:
    - Name: ${user.name}
    - Lifestyle: ${user.profile.lifestyle}
    - Total Footprint (period): ${totalFootprint.totalTons.toFixed(2)} tons CO2
    - Activities Count: ${activities.length}
    - Recent Activities: ${activities.slice(0, 10).map(a => a.title).join(', ')}

    Please provide a detailed, helpful answer based on their specific data.
    Focus on actionable insights and practical advice.
    Keep the response under 300 words.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Custom analysis error:', error);
    return "I'm unable to analyze your data at this time. Please try again later.";
  }
}

// Helper function to generate recommendations
async function generateRecommendations(user, activities, totalFootprint, category) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
    As an environmental sustainability expert, provide personalized recommendations for reducing carbon footprint:

    User Profile:
    - Lifestyle: ${user.profile.lifestyle}
    - Current Total: ${totalFootprint.totalTons.toFixed(2)} tons CO2
    - Baseline: ${user.carbonFootprint.baseline.toFixed(2)} tons CO2
    - Focus Category: ${category || 'general'}

    Recent Activities:
    ${activities.slice(0, 10).map(activity => 
      `- ${activity.category}: ${activity.title} (${activity.carbonFootprint.value} ${activity.carbonFootprint.unit})`
    ).join('\n')}

    Provide 5 specific, actionable recommendations:
    1. One immediate action they can take today
    2. One weekly habit to develop
    3. One monthly goal to set
    4. One lifestyle change to consider
    5. One long-term investment or change

    Format as JSON array with objects containing: title, description, impact, difficulty, timeframe
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      return [
        {
          title: "Track your daily activities",
          description: "Start by logging all your activities to understand your impact",
          impact: "Medium",
          difficulty: "Easy",
          timeframe: "Daily"
        },
        {
          title: "Reduce transportation emissions",
          description: "Consider walking, biking, or public transport for short trips",
          impact: "High",
          difficulty: "Medium",
          timeframe: "Weekly"
        },
        {
          title: "Optimize energy usage",
          description: "Switch to energy-efficient appliances and turn off unused devices",
          impact: "High",
          difficulty: "Medium",
          timeframe: "Monthly"
        },
        {
          title: "Adopt a plant-based diet",
          description: "Reduce meat consumption and choose local, seasonal foods",
          impact: "Very High",
          difficulty: "Hard",
          timeframe: "Lifestyle"
        },
        {
          title: "Invest in renewable energy",
          description: "Consider solar panels or green energy providers",
          impact: "Very High",
          difficulty: "Hard",
          timeframe: "Long-term"
        }
      ];
    }

  } catch (error) {
    console.error('Recommendations generation error:', error);
    return [
      {
        title: "Start tracking",
        description: "Begin logging your daily activities",
        impact: "Medium",
        difficulty: "Easy",
        timeframe: "Daily"
      }
    ];
  }
}

export default router; 