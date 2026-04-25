import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  shiftPatterns: [{
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startTime: String,
    endTime: String,
    duration: Number,
    requiredRoles: [{
      role: String,
      count: { type: Number, default: 1 }
    }],
    skills: [String]
  }],
  color: {
    type: String,
    default: '#3b82f6'
  },
  department: {
    type: String,
    default: 'General'
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('ScheduleTemplate', templateSchema);
