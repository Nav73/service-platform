import User from '../models/User.js';
import Job from '../models/Job.js';

// @desc    Get providers by service type
// @route   GET /api/client/providers
// @access  Private (Client)
export const getProvidersByService = async (req, res) => {
  try {
    const { serviceType, page = 1, limit = 10 } = req.query;

    if (!serviceType) {
      return res.status(400).json({
        success: false,
        message: 'Service type is required'
      });
    }

    const providers = await User.find({
      role: 'provider',
      approved: true,
      skills: serviceType
    })
      .select('name profession rating totalJobsCompleted averageCompletionTime profilePhoto')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ rating: -1, totalJobsCompleted: -1 });

    const total = await User.countDocuments({
      role: 'provider',
      approved: true,
      skills: serviceType
    });

    res.json({
      success: true,
      providers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get provider by ID
// @route   GET /api/client/providers/:id
// @access  Private (Client)
export const getProvider = async (req, res) => {
  try {
    const provider = await User.findOne({
      _id: req.params.id,
      role: 'provider',
      approved: true
    }).select('-password');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Get provider's completed jobs count and average rating
    const completedJobs = await Job.countDocuments({
      acceptedBy: provider._id,
      status: 'completed'
    });

    const jobsWithRating = await Job.find({
      acceptedBy: provider._id,
      rating: { $gt: 0 }
    }).select('rating');

    const averageRating = jobsWithRating.length > 0 
      ? jobsWithRating.reduce((sum, job) => sum + job.rating, 0) / jobsWithRating.length 
      : 0;

    res.json({
      success: true,
      provider: {
        ...provider.toProfileJSON(),
        completedJobs,
        averageRating: Math.round(averageRating * 10) / 10
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get client dashboard stats
// @route   GET /api/client/dashboard
// @access  Private (Client)
export const getClientDashboard = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments({ requestedBy: req.user._id });
    const pendingJobs = await Job.countDocuments({ 
      requestedBy: req.user._id, 
      status: { $in: ['pending', 'accepted', 'in-progress'] } 
    });
    const completedJobs = await Job.countDocuments({ 
      requestedBy: req.user._id, 
      status: 'completed' 
    });

    // Recent jobs
    const recentJobs = await Job.find({ requestedBy: req.user._id })
      .populate('acceptedBy', 'name profession rating')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        totalJobs,
        pendingJobs,
        completedJobs
      },
      recentJobs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
