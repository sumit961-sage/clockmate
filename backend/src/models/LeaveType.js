import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['ANNUAL', 'SICK', 'PERSONAL', 'PUBLIC_HOLIDAY', 'CUSTOM'],
    default: 'CUSTOM'
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  isPaid: {
    type: Boolean,
    default: true
  },
  accrualRule: {
    type: {
      type: String,
      enum: ['FIXED', 'HOURS_WORKED'],
      default: 'FIXED'
    },
    amount: {
      type: Number,
      default: 20
    },
    period: {
      type: String,
      enum: ['YEARLY', 'MONTHLY', 'FORTNIGHTLY', 'WEEKLY'],
      default: 'YEARLY'
    }
  },
  carryOverRules: {
    maxDays: {
      type: Number,
      default: 5
    },
    expiry: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('LeaveType', leaveTypeSchema);
