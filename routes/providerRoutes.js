import express from 'express';
import { 
  updateAvailability, 
  getProviderDashboard, 
  updateProviderProfile,
  getAvailableJobs
} from '../controllers/providerController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('provider'));

router.patch('/availability', updateAvailability);
router.get('/dashboard', getProviderDashboard);
router.put('/profile', updateProviderProfile);
router.get('/available-jobs', getAvailableJobs);

export default router;
