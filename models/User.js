import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  profile: {
    age: {
      type: Number,
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age cannot exceed 120']
    },
    location: {
      type: String,
      trim: true
    },
    lifestyle: {
      type: String,
      enum: ['sedentary', 'moderate', 'active'],
      default: 'moderate'
    },
    householdSize: {
      type: Number,
      min: [1, 'Household size must be at least 1'],
      default: 1
    }
  },
  carbonFootprint: {
    total: {
      type: Number,
      default: 0
    },
    baseline: {
      type: Number,
      default: 0
    },
    target: {
      type: Number,
      default: 0
    },
    lastCalculated: {
      type: Date,
      default: Date.now
    }
  },
  preferences: {
    units: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'metric'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      shareData: {
        type: Boolean,
        default: false
      },
      publicProfile: {
        type: Boolean,
        default: false
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ 'carbonFootprint.total': -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate carbon footprint baseline
userSchema.methods.calculateBaseline = function() {
  // Basic baseline calculation based on lifestyle
  const lifestyleMultipliers = {
    sedentary: 1.2,
    moderate: 1.0,
    active: 0.8
  };
  
  const baseFootprint = 4.5; // Average global carbon footprint in tons CO2/year
  const multiplier = lifestyleMultipliers[this.profile.lifestyle] || 1.0;
  
  this.carbonFootprint.baseline = baseFootprint * multiplier;
  return this.carbonFootprint.baseline;
};

// Get user stats
userSchema.methods.getStats = function() {
  return {
    totalFootprint: this.carbonFootprint.total,
    baselineFootprint: this.carbonFootprint.baseline,
    targetFootprint: this.carbonFootprint.target,
    reduction: this.carbonFootprint.baseline - this.carbonFootprint.total,
    reductionPercentage: this.carbonFootprint.baseline > 0 
      ? ((this.carbonFootprint.baseline - this.carbonFootprint.total) / this.carbonFootprint.baseline) * 100 
      : 0
  };
};

export default mongoose.model('User', userSchema); 