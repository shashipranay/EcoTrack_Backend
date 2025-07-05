import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: true,
    enum: [
      'carbon_reduction',
      'energy_savings',
      'waste_reduction',
      'water_conservation',
      'sustainable_transport',
      'eco_friendly_lifestyle',
      'streak',
      'milestone',
      'community',
      'education',
      'other'
    ]
  },
  type: {
    type: String,
    required: true,
    enum: [
      'first_activity',
      'streak',
      'carbon_reduction',
      'goal_completion',
      'community_contribution',
      'education_completion',
      'milestone',
      'special'
    ]
  },
  criteria: {
    metric: {
      type: String,
      enum: ['carbon_reduction', 'activities_count', 'streak_days', 'goals_completed', 'community_posts', 'education_modules'],
      required: true
    },
    threshold: {
      type: Number,
      required: true,
      min: [0, 'Threshold cannot be negative']
    },
    unit: {
      type: String,
      enum: ['kg', 'tons', 'count', 'days', 'percentage'],
      required: true
    },
    timeframe: {
      type: String,
      enum: ['lifetime', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'lifetime'
    }
  },
  icon: {
    type: String,
    default: '🏆'
  },
  badge: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 0,
    min: [0, 'Points cannot be negative']
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  isUnlocked: {
    type: Boolean,
    default: false
  },
  unlockedAt: {
    type: Date
  },
  progress: {
    current: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative']
    },
    required: {
      type: Number,
      required: true,
      min: [0, 'Required progress cannot be negative']
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    // Additional data specific to achievement type
    carbonReduced: Number,
    activitiesCompleted: Number,
    streakDays: Number,
    goalsCompleted: Number,
    communityContributions: Number,
    educationModules: Number,
    customData: mongoose.Schema.Types.Mixed
  },
  tags: [{
    type: String,
    trim: true
  }],
  isHidden: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
achievementSchema.index({ user: 1, isUnlocked: 1 });
achievementSchema.index({ user: 1, category: 1 });
achievementSchema.index({ type: 1, rarity: 1 });

// Virtual for progress percentage
achievementSchema.virtual('progressPercentage').get(function() {
  if (this.progress.required === 0) return 0;
  return Math.min((this.progress.current / this.progress.required) * 100, 100);
});

// Virtual for is expired
achievementSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Method to update progress
achievementSchema.methods.updateProgress = function(newProgress) {
  this.progress.current = Math.max(0, newProgress);
  this.progress.lastUpdated = new Date();
  
  // Check if achievement is unlocked
  if (this.progress.current >= this.progress.required && !this.isUnlocked) {
    this.isUnlocked = true;
    this.unlockedAt = new Date();
  }
  
  return this.save();
};

// Method to unlock achievement
achievementSchema.methods.unlock = function() {
  if (!this.isUnlocked) {
    this.isUnlocked = true;
    this.unlockedAt = new Date();
    this.progress.current = this.progress.required;
    this.progress.lastUpdated = new Date();
  }
  return this.save();
};

// Static method to get user's unlocked achievements
achievementSchema.statics.getUserUnlockedAchievements = async function(userId) {
  return await this.find({
    user: userId,
    isUnlocked: true,
    isActive: true
  }).sort({ unlockedAt: -1 });
};

// Static method to get user's available achievements
achievementSchema.statics.getUserAvailableAchievements = async function(userId) {
  return await this.find({
    user: userId,
    isUnlocked: false,
    isHidden: false,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ rarity: 1, createdAt: 1 });
};

// Static method to get achievements by category
achievementSchema.statics.getAchievementsByCategory = async function(userId, category) {
  return await this.find({
    user: userId,
    category: category,
    isActive: true
  }).sort({ isUnlocked: 1, rarity: 1 });
};

// Static method to get user's total points
achievementSchema.statics.getUserTotalPoints = async function(userId) {
  const result = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        isUnlocked: true,
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalPoints: { $sum: '$points' },
        achievementCount: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || { totalPoints: 0, achievementCount: 0 };
};

// Instance method to convert to response format
achievementSchema.methods.toResponseFormat = function() {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    category: this.category,
    type: this.type,
    criteria: this.criteria,
    icon: this.icon,
    badge: this.badge,
    points: this.points,
    rarity: this.rarity,
    isUnlocked: this.isUnlocked,
    unlockedAt: this.unlockedAt,
    progress: {
      current: this.progress.current,
      required: this.progress.required,
      percentage: this.progressPercentage
    },
    metadata: this.metadata,
    tags: this.tags,
    isHidden: this.isHidden,
    isExpired: this.isExpired,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export default mongoose.model('Achievement', achievementSchema); 