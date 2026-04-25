import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  department: {
    type: String,
    default: 'General'
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  requiredRoles: [{
    role: String,
    count: { type: Number, default: 1 },
    skillsRequired: [String]
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'Australia/Sydney'
  },
  type: {
    type: String,
    enum: ['REGULAR', 'SPLIT', 'ON_CALL', 'TRAINING', 'SLEEPOVER', 'MEETING', 'OVERTIME'],
    default: 'REGULAR'
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'OPEN'],
    default: 'SCHEDULED'
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  requiredSkills: [String],
  recurrence: {
    frequency: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']
    },
    interval: Number,
    daysOfWeek: [Number],
    endDate: Date
  },
  breaks: [{
    start: Date,
    end: Date,
    duration: Number,
    type: { type: String, enum: ['PAID', 'UNPAID'], default: 'UNPAID' },
    description: String
  }],
  payModifiers: [{
    type: { type: String, enum: ['PENALTY', 'ALLOWANCE', 'BONUS'] },
    amount: Number,
    reason: String
  }],
  notes: String,
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduleTemplate',
    default: null
  },
  source: {
    type: String,
    enum: ['MANUAL', 'TEMPLATE', 'AUTO_SCHEDULED'],
    default: 'MANUAL'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient date-range queries
shiftSchema.index({ orgId: 1, startTime: 1, endTime: 1 });
shiftSchema.index({ assignedTo: 1, startTime: 1 });

export default mongoose.model('Shift', shiftSchema);
