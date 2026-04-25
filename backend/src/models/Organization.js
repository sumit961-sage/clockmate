import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  timezone: {
    type: String,
    default: 'Australia/Sydney'
  },
  currency: {
    type: String,
    default: 'AUD'
  },
  settings: {
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    workingDays: [{ type: Number }],
    defaultShiftDuration: { type: Number, default: 8 },
    gracePeriod: { type: Number, default: 5 },
    overtimeRules: {
      dailyThreshold: { type: Number, default: 8 },
      weeklyThreshold: { type: Number, default: 38 },
      rate: { type: Number, default: 1.5 }
    },
    breakRules: {
      autoDeduct: { type: Boolean, default: true },
      deductAfter: { type: Number, default: 6 },
      deductDuration: { type: Number, default: 0.5 }
    },
    timesheetSettings: {
      periodType: { type: String, enum: ['weekly', 'fortnightly', 'semi_monthly', 'monthly'], default: 'weekly' },
      weekStartDay: { type: String, enum: ['sunday', 'monday', 'saturday'], default: 'monday' },
      timesheetDueDay: { type: Number, default: 2 },
      approvalWorkflow: { type: String, enum: ['manager', 'auto', 'hr_final'], default: 'manager' },
      roundingRule: { interval: { type: Number, default: 15 }, direction: { type: String, enum: ['nearest', 'up', 'down'], default: 'nearest' } },
      overtimeThresholds: {
        daily: { hours: { type: Number, default: 8 }, rate: { type: Number, default: 1.5 } },
        dailyDouble: { hours: { type: Number, default: 12 }, rate: { type: Number, default: 2.0 } },
        weekly: { hours: { type: Number, default: 38 }, rate: { type: Number, default: 1.5 } }
      },
      breakRules: { autoDeductAfterHours: { type: Number, default: 5 }, duration: { type: Number, default: 30 }, type: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' } },
      lockPeriodDays: { type: Number, default: 7 }
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['STARTER', 'TEAM', 'BUSINESS', 'ENTERPRISE'],
      default: 'STARTER'
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL'],
      default: 'ACTIVE'
    },
    expiryDate: Date,
    maxUsers: { type: Number, default: 5 }
  },
  branding: {
    logo: String,
    primaryColor: { type: String, default: '#2563eb' },
    secondaryColor: { type: String, default: '#4f46e5' }
  },
  location: String,
  type: String,
  industry: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Organization', organizationSchema);
