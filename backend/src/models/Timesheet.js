import mongoose from 'mongoose';

const timesheetSchema = new mongoose.Schema({
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
  payPeriod: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  entries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimeEntry'
  }],
  summary: {
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    doubleTimeHours: { type: Number, default: 0 },
    breakHours: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalPay: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'],
    default: 'DRAFT'
  },
  submittedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

export default mongoose.model('Timesheet', timesheetSchema);
