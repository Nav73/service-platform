import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['client', 'provider', 'admin'],
    required: true,
    default: 'client'
  },
  profession: {
    type: String,
    required: function() {
      return this.role === 'provider';
    }
  },
  approved: {
    type: Boolean,
    default: function() {
      return this.role === 'client' || this.role === 'admin';
    }
  },
  isAvailable: {
    type: Boolean,
    default: function() {
      return this.role === 'provider' ? false : undefined;
    }
  },
  currentJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  skills: [{
    type: String,
    trim: true
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalJobsCompleted: {
    type: Number,
    default: 0
  },
  averageCompletionTime: {
    type: Number, // in minutes
    default: 60
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get user profile without password
userSchema.methods.toProfileJSON = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    profession: this.profession,
    approved: this.approved,
    isAvailable: this.isAvailable,
    rating: this.rating,
    totalJobsCompleted: this.totalJobsCompleted,
    profilePhoto: this.profilePhoto,
    address: this.address,
    skills: this.skills,
    averageCompletionTime: this.averageCompletionTime,
    createdAt: this.createdAt
  };
};

export default mongoose.model('User', userSchema);
