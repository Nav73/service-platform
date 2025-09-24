import User from '../models/User.js';
import Job from '../models/Job.js';

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
export const getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
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

// @desc    Get pending providers
// @route   GET /api/admin/providers/pending
// @access  Private (Admin)
export const getPendingProviders = async (req, res) => {
  try {
    const providers = await User.find({
      role: 'provider',
      approved: false
    }).select('-password');

    res.json({
      success: true,
      providers
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve provider
// @route   PATCH /api/admin/providers/:id/approve
// @access  Private (Admin)
export const approveProvider = async (req, res) => {
  try {
    const provider = await User.findByIdAndUpdate(
      req.params.id,
      { approved: true, isAvailable: true },
      { new: true }
    ).select('-password');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    res.json({
      success: true,
      provider,
      message: 'Provider approved successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Also delete user's jobs if needed
    if (user.role === 'client') {
      await Job.deleteMany({ requestedBy: user._id });
    } else if (user.role === 'provider') {
      await Job.updateMany(
        { acceptedBy: user._id },
        { $unset: { acceptedBy: 1 }, status: 'pending' }
      );
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalJobs = await Job.countDocuments();
    const pendingJobs = await Job.countDocuments({ status: 'pending' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });

    // Recent activities
    const recentJobs = await Job.find()
      .populate('requestedBy', 'name')
      .populate('acceptedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const pendingProviders = await User.countDocuments({
      role: 'provider',
      approved: false
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProviders,
        totalClients,
        totalJobs,
        pendingJobs,
        completedJobs,
        pendingProviders
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
