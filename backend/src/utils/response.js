import mongoose from 'mongoose';

// Helper to serialize MongoDB documents - converts _id to id, ObjectIds to strings
export function serializeDoc(doc) {
  if (!doc) return null;
  if (Array.isArray(doc)) return doc.map(serializeDoc);
  
  const obj = doc.toObject ? doc.toObject() : doc;
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_id') {
      result.id = value.toString();
    } else if (key === '__v') {
      // Skip version key
      continue;
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (value instanceof mongoose.Types.ObjectId) {
      // Convert ObjectId references (userId, orgId, etc.) to strings
      result[key] = value.toString();
    } else if (typeof value === 'object' && value !== null) {
      if (value._id) {
        // Nested mongoose document
        result[key] = serializeDoc(value);
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
