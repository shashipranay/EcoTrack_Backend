import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'transportation',
      'energy',
      'food',
      'waste',
      'water',
      'shopping',
      'travel',
      'other'
    ]
  },
  subcategory: {
    type: String,
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
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  carbonFootprint: {
    value: {
      type: Number,
      required: true,
      min: [0, 'Carbon footprint cannot be negative']
    },
    unit: {
      type: String,
      enum: ['kg', 'tons'],
      default: 'kg'
    },
    calculationMethod: {
      type: String,
      enum: ['manual', 'calculated', 'estimated'],
      default: 'calculated'
    }
  },
  data: {
    // Transportation specific fields
    distance: Number,
    vehicleType: String,
    fuelType: String,
    passengers: Number,
    
    // Energy specific fields
    energyType: String,
    consumption: Number,
    consumptionUnit: String,
    
    // Food specific fields
    foodType: String,
    quantity: Number,
    quantityUnit: String,
    
    // Waste specific fields
    wasteType: String,
    weight: Number,
    disposalMethod: String,
    
    // Water specific fields
    waterUsage: Number,
    waterUnit: String,
    
    // Shopping specific fields
    itemType: String,
    price: Number,
    currency: String,
    
    // Travel specific fields
    destination: String,
    travelMode: String,
    duration: Number,
    
    // Generic fields
    customFields: mongoose.Schema.Types.Mixed
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    },
    address: String,
    city: String,
    country: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: {
      type: Number,
      default: 1
    },
    endDate: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
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
activitySchema.index({ user: 1, date: -1 });
activitySchema.index({ user: 1, category: 1 });
activitySchema.index({ date: -1 });
activitySchema.index({ 'carbonFootprint.value': -1 });

// Virtual for formatted date
activitySchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString();
});

// Virtual for carbon footprint in tons
activitySchema.virtual('carbonFootprintTons').get(function() {
  if (this.carbonFootprint.unit === 'tons') {
    return this.carbonFootprint.value;
  }
  return this.carbonFootprint.value / 1000;
});

// Static method to get user's total carbon footprint
activitySchema.statics.getUserTotalFootprint = async function(userId, startDate, endDate) {
  const matchStage = {
    user: userId,
    status: 'active'
  };
  
  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalKg: {
          $sum: {
            $cond: [
              { $eq: ['$carbonFootprint.unit', 'tons'] },
              { $multiply: ['$carbonFootprint.value', 1000] },
              '$carbonFootprint.value'
            ]
          }
        },
        totalTons: {
          $sum: {
            $cond: [
              { $eq: ['$carbonFootprint.unit', 'tons'] },
              '$carbonFootprint.value',
              { $divide: ['$carbonFootprint.value', 1000] }
            ]
          }
        },
        activityCount: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || { totalKg: 0, totalTons: 0, activityCount: 0 };
};

// Static method to get footprint by category
activitySchema.statics.getFootprintByCategory = async function(userId, startDate, endDate) {
  const matchStage = {
    user: userId,
    status: 'active'
  };
  
  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        totalKg: {
          $sum: {
            $cond: [
              { $eq: ['$carbonFootprint.unit', 'tons'] },
              { $multiply: ['$carbonFootprint.value', 1000] },
              '$carbonFootprint.value'
            ]
          }
        },
        totalTons: {
          $sum: {
            $cond: [
              { $eq: ['$carbonFootprint.unit', 'tons'] },
              '$carbonFootprint.value',
              { $divide: ['$carbonFootprint.value', 1000] }
            ]
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalKg: -1 } }
  ]);
};

// Instance method to convert to response format
activitySchema.methods.toResponseFormat = function() {
  return {
    id: this._id,
    category: this.category,
    subcategory: this.subcategory,
    title: this.title,
    description: this.description,
    date: this.date,
    carbonFootprint: {
      value: this.carbonFootprint.value,
      unit: this.carbonFootprint.unit,
      tons: this.carbonFootprintTons
    },
    data: this.data,
    location: this.location,
    tags: this.tags,
    isRecurring: this.isRecurring,
    status: this.status,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export default mongoose.model('Activity', activitySchema); 