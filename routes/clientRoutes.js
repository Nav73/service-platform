import express from 'express';
import { 
  getProvidersByService, 
  getProvider, 
  getClientDashboard 
} from '../controllers/clientController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('client'));

router.get('/providers', getProvidersByService);
router.get('/providers/:id', getProvider);
router.get('/dashboard', getClientDashboard);

export default router;
