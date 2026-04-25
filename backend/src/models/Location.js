import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
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
  address: {
    type: String,
    required: true
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  geofence: {
    type: {
      type: String,
      enum: ['CIRCLE', 'POLYGON'],
      default: 'CIRCLE'
    },
    center: {
      lat: Number,
      lng: Number
    },
    radius: {
      type: Number,
      default: 100
    },
    coordinates: [{
      lat: Number,
      lng: Number
    }]
  },
  timezone: {
    type: String,
    default: 'Australia/Sydney'
  },
  qrCode: String,
  managers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Location', locationSchema);
