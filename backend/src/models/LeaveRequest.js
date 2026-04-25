import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema({
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
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  duration: {
    type: String,
    enum: ['FULL', 'AM', 'PM'],
    default: 'FULL'
  },
  days: {
    type: Number,
    required: true
  },
  reason: String,
  attachmentUrl: String,
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

export default mongoose.model('LeaveRequest', leaveRequestSchema);
