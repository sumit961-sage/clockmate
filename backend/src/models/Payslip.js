import mongoose from 'mongoose';

const payslipSchema = new mongoose.Schema({
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
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  payPeriod: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  payDate: {
    type: Date,
    required: true
  },
  earnings: {
    regularHours: { type: Number, default: 0 },
    regularRate: { type: Number, default: 0 },
    regularPay: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    doubleTimeHours: { type: Number, default: 0 },
    doubleTimeRate: { type: Number, default: 0 },
    doubleTimePay: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 }
  },
  deductions: {
    tax: { type: Number, default: 0 },
    superannuation: { type: Number, default: 0 },
    medicare: { type: Number, default: 0 },
    other: [{ name: String, amount: Number }],
    total: { type: Number, default: 0 }
  },
  leaveTaken: [{
    leaveType: String,
    days: Number,
    amount: Number
  }],
  netPay: { type: Number, default: 0 },
  ytd: {
    grossPay: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    superannuation: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'PAID'],
    default: 'DRAFT'
  },
  notes: String
}, {
  timestamps: true
});

export default mongoose.model('Payslip', payslipSchema);
