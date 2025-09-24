import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  estimatedStartTime: Date,
  estimatedCompletionTime: Date,
  actualStartTime: Date,
  actualCompletionTime: Date,
  clientNotes: String,
  providerNotes: String,
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: String,
  cost: {
    type: Number,
    min: 0
  },
  duration: { // in minutes
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
jobSchema.index({ serviceType: 1, status: 1 });
jobSchema.index({ requestedBy: 1 });
jobSchema.index({ acceptedBy: 1 });

export default mongoose.model('Job', jobSchema);
