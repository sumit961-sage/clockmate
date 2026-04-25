import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  employeeId: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: String,
  avatar: String,
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
  startDate: {
    type: Date,
    default: Date.now
  },
  terminationDate: Date,
  payRate: {
    type: Number,
    default: 25
  },
  payCurrency: {
    type: String,
    default: 'AUD'
  },
  payType: {
    type: String,
    enum: ['HOURLY', 'SALARY'],
    default: 'HOURLY'
  },
  locations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  documents: [{
    type: String,
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    expiryDate: Date
  }],
  certifications: [{
    name: String,
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    fileUrl: String
  }],
  role: {
    type: String,
    enum: ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'OBSERVER'],
    default: 'EMPLOYEE'
  },
  inviteStatus: {
    type: String,
    enum: ['INVITED', 'JOINED'],
    default: 'JOINED'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for org + employeeId uniqueness
employeeSchema.index({ orgId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model('Employee', employeeSchema);
