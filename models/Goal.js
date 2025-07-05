import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
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
      'education',
      'community',
      'other'
    ]
  },
  target: {
    value: {
      type: Number,
      required: true,
      min: [0, 'Target value cannot be negative']
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'tons', 'kwh', 'liters', 'items', 'percentage', 'days', 'count']
    },
    timeframe: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true
    }
  },
  current: {
    value: {
      type: Number,
      default: 0,
      min: [0, 'Current value cannot be negative']
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'cancelled'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'moderate', 'hard', 'expert'],
    default: 'moderate'
  },
  milestones: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    targetValue: {
      type: Number,
      required: true
    },
    achievedValue: {
      type: Number,
      default: 0
    },
    achieved: {
      type: Boolean,
      default: false
    },
    achievedDate: Date
  }],
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  reminders: {
    enabled: {
      type: Boolean,
      default: true
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    lastReminder: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
goalSchema.index({ user: 1, status: 1 });
goalSchema.index({ user: 1, endDate: 1 });
goalSchema.index({ status: 1, endDate: 1 });

// Virtual for progress percentage
goalSchema.virtual('progressPercentage').get(function() {
  if (this.target.value === 0) return 0;
  return Math.min((this.current.value / this.target.value) * 100, 100);
});

// Virtual for days remaining
goalSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual for is overdue
goalSchema.virtual('isOverdue').get(function() {
  return new Date() > new Date(this.endDate) && this.status === 'active';
});

// Method to update progress
goalSchema.methods.updateProgress = function(newValue) {
  this.current.value = Math.max(0, newValue);
  this.current.lastUpdated = new Date();
  
  // Check if goal is completed
  if (this.current.value >= this.target.value && this.status === 'active') {
    this.status = 'completed';
  }
  
  // Update milestones
  this.milestones.forEach(milestone => {
    if (!milestone.achieved && this.current.value >= milestone.targetValue) {
      milestone.achieved = true;
      milestone.achievedValue = milestone.targetValue;
      milestone.achievedDate = new Date();
    }
  });
  
  return this.save();
};

// Static method to get user's active goals
goalSchema.statics.getUserActiveGoals = async function(userId) {
  return await this.find({
    user: userId,
    status: 'active'
  }).sort({ endDate: 1 });
};

// Static method to get goals by category
goalSchema.statics.getGoalsByCategory = async function(userId, category) {
  return await this.find({
    user: userId,
    category: category
  }).sort({ createdAt: -1 });
};

// Instance method to convert to response format
goalSchema.methods.toResponseFormat = function() {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    category: this.category,
    target: this.target,
    current: this.current,
    progressPercentage: this.progressPercentage,
    startDate: this.startDate,
    endDate: this.endDate,
    daysRemaining: this.daysRemaining,
    isOverdue: this.isOverdue,
    status: this.status,
    priority: this.priority,
    difficulty: this.difficulty,
    milestones: this.milestones,
    tags: this.tags,
    isPublic: this.isPublic,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export default mongoose.model('Goal', goalSchema); 