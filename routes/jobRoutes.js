import express from 'express';
import {
  createJob,
  getMyJobs,
  getJob,
  updateJobStatus,
  addRating
} from '../controllers/jobController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('client'), createJob);
router.get('/my-jobs', getMyJobs);
router.get('/:id', getJob);
router.patch('/:id/status', updateJobStatus);
router.patch('/:id/rating', authorize('client'), addRating);

export default router;
