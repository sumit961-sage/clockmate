import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveType',
    required: true
  },
  entitlementDays: {
    type: Number,
    default: 0
  },
  usedDays: {
    type: Number,
    default: 0
  },
  pendingDays: {
    type: Number,
    default: 0
  },
  carriedOverDays: {
    type: Number,
    default: 0
  },
  year: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Compound index for unique balance per user/type/year
leaveBalanceSchema.index({ userId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

export default mongoose.model('LeaveBalance', leaveBalanceSchema);
