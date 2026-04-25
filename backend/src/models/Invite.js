import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['EMPLOYEE', 'MANAGER', 'ADMIN'],
    default: 'EMPLOYEE'
  },
  department: {
    type: String,
    default: 'General'
  },
  position: {
    type: String,
    default: 'Employee'
  },
  employmentType: {
    type: String,
    enum: ['FULL_TIME', 'PART_TIME', 'CASUAL', 'CONTRACTOR'],
    default: 'FULL_TIME'
  },
  payRate: {
    type: Number,
    default: 25
  },
  payType: {
    type: String,
    enum: ['HOURLY', 'SALARY'],
    default: 'HOURLY'
  },
  employeeId: {
    type: String
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'EXPIRED'],
    default: 'PENDING'
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
}, {
  timestamps: true
});

// Compound index for org + email
inviteSchema.index({ orgId: 1, email: 1 }, { unique: true });

export default mongoose.model('Invite', inviteSchema);
