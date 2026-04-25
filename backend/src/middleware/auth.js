import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Employee from '../models/Employee.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // ═══ CRITICAL: Override User role with Employee role if available ═══
    // This ensures role changes made via Employee record take effect immediately
    if (user.orgId) {
      try {
        const employee = await Employee.findOne({ 
          orgId: user.orgId, 
          userId: user._id 
        });
        if (employee && employee.role) {
          // Use Employee role (it may have been updated via the Employee edit)
          user.role = employee.role;
        }
      } catch (err) {
        // If Employee lookup fails, fall back to User role (no change)
        console.warn('Could not fetch employee record for role sync:', err.message);
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};
