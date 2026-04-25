import mongoose from 'mongoose';

const clockEventSchema = new mongoose.Schema({
  time: {
    type: Date,
    required: true
  },
  location: {
    lat: Number,
    lng: Number
  },
  accuracy: Number,
  photoUrl: String,
  deviceId: String,
  ipAddress: String,
  method: {
    type: String,
    enum: ['MOBILE', 'WEB', 'KIOSK', 'QR_CODE', 'SLACK'],
    default: 'WEB'
  },
  withinGeofence: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const breakSchema = new mongoose.Schema({
  start: {
    type: Date,
    required: true
  },
  end: Date,
  type: {
    type: String,
    enum: ['PAID', 'UNPAID'],
    default: 'UNPAID'
  },
  duration: Number
});

const timeEntrySchema = new mongoose.Schema({
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
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  clockIn: {
    type: clockEventSchema,
    required: true
  },
  clockOut: clockEventSchema,
  breaks: [breakSchema],
  totalHours: {
    type: Number,
    default: 0
  },
  regularHours: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'DISPUTED', 'APPROVED'],
    default: 'ACTIVE'
  },
  notes: String,
  jobCosting: {
    projectId: String,
    projectName: String,
    costCode: String,
    clientId: String
  },
  editsHistory: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    text: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: String,
    createdAt: { type: Date, default: Date.now }
  }],
  lastEditedAt: Date,
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastEditedByName: String
}, {
  timestamps: true
});

export default mongoose.model('TimeEntry', timeEntrySchema);
