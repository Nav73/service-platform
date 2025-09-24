import express from 'express';
import {
  getUsers,
  getPendingProviders,
  approveProvider,
  deleteUser,
  getDashboardStats
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/users', getUsers);
router.get('/providers/pending', getPendingProviders);
router.patch('/providers/:id/approve', approveProvider);
router.delete('/users/:id', deleteUser);
router.get('/dashboard', getDashboardStats);

export default router;
