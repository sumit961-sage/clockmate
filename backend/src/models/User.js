import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
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
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    enum: ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'OBSERVER'],
    default: 'EMPLOYEE'
  },
  permissions: [{
    type: String
  }],
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      shiftReminders: { type: Boolean, default: true },
      timesheetApprovals: { type: Boolean, default: true },
      leaveUpdates: { type: Boolean, default: true }
    },
    twoFactorEnabled: { type: Boolean, default: false },
    timezone: { type: String, default: 'Australia/Sydney' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' }
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);
