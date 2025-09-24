import Job from '../models/Job.js';
import { JobAssignmentService } from '../services/jobAssignmentService.js';

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private (Client)
export const createJob = async (req, res) => {
  try {
    const { serviceType, location, description, priority, clientNotes } = req.body;

    const job = await Job.create({
      serviceType,
      location,
      description,
      priority,
      clientNotes,
      requestedBy: req.user._id
    });

    // Attempt to assign a provider
    const assignmentResult = await JobAssignmentService.assignBestProvider(job._id, serviceType);

    const populatedJob = await Job.findById(job._id)
      .populate('requestedBy', 'name email phone')
      .populate('acceptedBy', 'name phone rating profession');

    if (assignmentResult.assigned) {
      res.status(201).json({
        success: true,
        job: populatedJob,
        assigned: true,
        provider: assignmentResult.provider,
        message: 'Job created and provider assigned immediately'
      });
    } else {
      res.status(201).json({
        success: true,
        job: populatedJob,
        assigned: false,
        estimatedWaitTime: assignmentResult.estimatedWaitTime,
        queuePosition: assignmentResult.queuePosition,
        message: assignmentResult.message
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all jobs for a user
// @route   GET /api/jobs/my-jobs
// @access  Private
export const getMyJobs = async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'client') {
      filter.requestedBy = req.user._id;
    } else if (req.user.role === 'provider') {
      filter.acceptedBy = req.user._id;
    }

    const jobs = await Job.find(filter)
      .populate('requestedBy', 'name email phone address')
      .populate('acceptedBy', 'name phone rating profession')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get job by ID
// @route   GET /api/jobs/:id
// @access  Private
export const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('requestedBy', 'name email phone address')
      .populate('acceptedBy', 'name phone rating profession skills');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user has access to this job
    if (req.user.role === 'client' && job.requestedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this job'
      });
    }

    if (req.user.role === 'provider' && job.acceptedBy && job.acceptedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this job'
      });
    }

    res.json({
      success: true,
      job
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update job status
// @route   PATCH /api/jobs/:id/status
// @access  Private
export const updateJobStatus = async (req, res) => {
  try {
    const { status, providerNotes, duration, cost } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Authorization check
    if (req.user.role === 'provider' && job.acceptedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    const updateData = { status };
    if (providerNotes) updateData.providerNotes = providerNotes;
    if (duration) updateData.duration = duration;
    if (cost) updateData.cost = cost;

    // Set actual start time when status changes to in-progress
    if (status === 'in-progress' && job.status !== 'in-progress') {
      updateData.actualStartTime = new Date();
    }

    // Handle job completion
    if (status === 'completed' && job.status !== 'completed') {
      const completedJob = await JobAssignmentService.completeJob(job._id);
      return res.json({
        success: true,
        job: completedJob,
        message: 'Job completed successfully'
      });
    }

    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('requestedBy', 'name email phone')
     .populate('acceptedBy', 'name phone rating profession');

    res.json({
      success: true,
      job: updatedJob,
      message: 'Job status updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add rating and review to job
// @route   PATCH /api/jobs/:id/rating
// @access  Private (Client)
export const addRating = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user is the client who requested the job
    if (job.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to rate this job'
      });
    }

    // Check if job is completed
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only rate completed jobs'
      });
    }

    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      { rating, review },
      { new: true }
    ).populate('requestedBy', 'name email phone')
     .populate('acceptedBy', 'name phone rating profession');

    // Update provider's average rating
    if (rating && job.acceptedBy) {
      await updateProviderRating(job.acceptedBy);
    }

    res.json({
      success: true,
      job: updatedJob,
      message: 'Rating added successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to update provider rating
const updateProviderRating = async (providerId) => {
  const jobs = await Job.find({
    acceptedBy: providerId,
    rating: { $gt: 0 }
  });

  if (jobs.length > 0) {
    const averageRating = jobs.reduce((sum, job) => sum + job.rating, 0) / jobs.length;
    await User.findByIdAndUpdate(providerId, { rating: Math.round(averageRating * 10) / 10 });
  }
};
