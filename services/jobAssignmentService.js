import Job from '../models/Job.js';
import User from '../models/User.js';

export class JobAssignmentService {
  static async assignBestProvider(jobId, serviceType) {
    try {
      // 1. Find available providers with matching skills
      const availableProviders = await User.find({
        role: 'provider',
        isAvailable: true,
        skills: serviceType,
        approved: true
      }).sort({ rating: -1, totalJobsCompleted: -1 });

      // 2. If available providers found, assign the best one
      if (availableProviders.length > 0) {
        const bestProvider = availableProviders[0];
        return await this.assignJobToProvider(jobId, bestProvider._id);
      }

      // 3. If no available providers, find busy providers and calculate availability
      const busyProviders = await User.find({
        role: 'provider',
        skills: serviceType,
        approved: true,
        isAvailable: false
      }).populate('currentJob');

      if (busyProviders.length === 0) {
        return {
          assigned: false,
          message: 'No providers available for this service type'
        };
      }

      // Calculate when each provider will be available
      const providersWithAvailability = await Promise.all(
        busyProviders.map(async (provider) => {
          const availableAt = await this.calculateProviderAvailability(provider._id);
          return {
            provider,
            availableAt
          };
        })
      );

      // Sort by earliest availability
      providersWithAvailability.sort((a, b) => a.availableAt - b.availableAt);
      const earliestProvider = providersWithAvailability[0];

      // Update job with estimated times
      const job = await Job.findByIdAndUpdate(
        jobId,
        {
          estimatedStartTime: earliestProvider.availableAt,
          estimatedCompletionTime: new Date(
            earliestProvider.availableAt.getTime() + 
            (earliestProvider.provider.averageCompletionTime || 60) * 60000
          )
        },
        { new: true }
      );

      const waitTime = Math.round((earliestProvider.availableAt - new Date()) / 60000); // in minutes

      return {
        assigned: false,
        estimatedWaitTime: waitTime > 0 ? waitTime : 0,
        nextAvailableProvider: earliestProvider.provider._id,
        queuePosition: providersWithAvailability.length,
        message: `Next available provider in approximately ${waitTime} minutes`
      };
    } catch (error) {
      throw new Error(`Job assignment failed: ${error.message}`);
    }
  }

  static async assignJobToProvider(jobId, providerId) {
    const session = await Job.startSession();
    session.startTransaction();

    try {
      // Update job
      const job = await Job.findByIdAndUpdate(
        jobId,
        {
          acceptedBy: providerId,
          status: 'accepted',
          estimatedStartTime: new Date(),
          estimatedCompletionTime: new Date(Date.now() + 60 * 60000) // Default 60 minutes
        },
        { new: true, session }
      );

      // Update provider
      await User.findByIdAndUpdate(
        providerId,
        {
          isAvailable: false,
          currentJob: jobId
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      const provider = await User.findById(providerId).select('name phone rating profession');

      return {
        assigned: true,
        job,
        provider,
        message: 'Provider assigned successfully'
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  static async calculateProviderAvailability(providerId) {
    const currentJob = await Job.findOne({
      acceptedBy: providerId,
      status: { $in: ['accepted', 'in-progress'] }
    });

    if (!currentJob) {
      return new Date(); // Provider is actually available
    }

    // Calculate based on job's estimated completion time
    if (currentJob.estimatedCompletionTime) {
      return new Date(currentJob.estimatedCompletionTime);
    }

    // Fallback: use provider's average completion time
    const provider = await User.findById(providerId);
    const averageTime = provider.averageCompletionTime || 60;
    const startTime = currentJob.actualStartTime || currentJob.createdAt;
    
    return new Date(startTime.getTime() + averageTime * 60000);
  }

  static async completeJob(jobId) {
    const session = await Job.startSession();
    session.startTransaction();

    try {
      // Update job status
      const job = await Job.findByIdAndUpdate(
        jobId,
        {
          status: 'completed',
          actualCompletionTime: new Date()
        },
        { new: true, session }
      );

      if (!job) {
        throw new Error('Job not found');
      }

      // Free up the provider
      if (job.acceptedBy) {
        await User.findByIdAndUpdate(
          job.acceptedBy,
          {
            isAvailable: true,
            $inc: { totalJobsCompleted: 1 },
            $unset: { currentJob: 1 }
          },
          { session }
        );

        // Update provider's average completion time
        await this.updateProviderStats(job.acceptedBy, job.duration, session);
      }

      await session.commitTransaction();
      session.endSession();

      // Assign next job in queue if any
      await this.assignNextJobInQueue(job.serviceType);

      return job;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  static async updateProviderStats(providerId, jobDuration, session) {
    if (!jobDuration) return;

    const provider = await User.findById(providerId).session(session);
    const totalJobs = provider.totalJobsCompleted + 1;
    const newAverage = ((provider.averageCompletionTime * provider.totalJobsCompleted) + jobDuration) / totalJobs;

    await User.findByIdAndUpdate(
      providerId,
      { averageCompletionTime: Math.round(newAverage) },
      { session }
    );
  }

  static async assignNextJobInQueue(serviceType) {
    try {
      // Find the oldest pending job for this service type
      const nextJob = await Job.findOne({
        serviceType,
        status: 'pending'
      }).sort({ createdAt: 1 });

      if (nextJob) {
        await this.assignBestProvider(nextJob._id, serviceType);
      }
    } catch (error) {
      console.error('Error assigning next job:', error);
    }
  }
}
