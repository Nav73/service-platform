import Job from '../models/Job.js';
import User from '../models/User.js';

// @desc    Update provider availability
// @route   PATCH /api/provider/availability
// @access  Private (Provider)
export const updateAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    // Check if provider has current job when trying to set unavailable
    if (!isAvailable) {
      const currentJob = await Job.findOne({
        acceptedBy: req.user._id,
        status: { $in: ['accepted', 'in-progress'] }
      });

      if (currentJob) {
        return res.status(400).json({
          success: false,
          message: 'Cannot set unavailable while having an active job'
        });
      }
    }

    const provider = await User.findByIdAndUpdate(
      req.user._id,
      { isAvailable },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      provider,
      message: `Availability updated to ${isAvailable ? 'available' : 'unavailable'}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get provider dashboard stats
// @route   GET /api/provider/dashboard
// @access  Private (Provider)
export const getProviderDashboard = async (req, res) => {
  try {
    const providerId = req.user._id;

    const totalJobs = await Job.countDocuments({ acceptedBy: providerId });
    const completedJobs = await Job.countDocuments({ 
      acceptedBy: providerId, 
      status: 'completed' 
    });
    const pendingJobs = await Job.countDocuments({ 
      acceptedBy: providerId, 
      status: { $in: ['accepted', 'in-progress'] } 
    });
    const averageRating = req.user.rating;

    // Recent jobs
    const recentJobs = await Job.find({ acceptedBy: providerId })
      .populate('requestedBy', 'name phone address')
      .sort({ createdAt: -1 })
      .limit(5);

    // Earnings calculation (simplified)
    const completedJobsWithCost = await Job.find({
      acceptedBy: providerId,
      status: 'completed',
      cost: { $gt: 0 }
    });
    
    const totalEarnings = completedJobsWithCost.reduce((sum, job) => sum + (job.cost || 0), 0);

    res.json({
      success: true,
      stats: {
        totalJobs,
        completedJobs,
        pendingJobs,
        averageRating,
        totalEarnings
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

// @desc    Update provider profile (skills, profession, etc.)
// @route   PUT /api/provider/profile
// @access  Private (Provider)
export const updateProviderProfile = async (req, res) => {
  try {
    const { skills, profession, averageCompletionTime, address } = req.body;

    const updateData = {};
    if (skills) updateData.skills = skills;
    if (profession) updateData.profession = profession;
    if (averageCompletionTime) updateData.averageCompletionTime = averageCompletionTime;
    if (address) updateData.address = address;

    const provider = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      provider,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get available jobs for provider
// @route   GET /api/provider/available-jobs
// @access  Private (Provider)
export const getAvailableJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const provider = await User.findById(req.user._id);
    if (!provider.skills || provider.skills.length === 0) {
      return res.json({
        success: true,
        jobs: [],
        message: 'Please update your skills to see available jobs'
      });
    }

    const jobs = await Job.find({
      status: 'pending',
      serviceType: { $in: provider.skills }
    })
      .populate('requestedBy', 'name phone address')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ priority: -1, createdAt: 1 });

    const total = await Job.countDocuments({
      status: 'pending',
      serviceType: { $in: provider.skills }
    });

    res.json({
      success: true,
      jobs,
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
