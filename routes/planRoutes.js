import express from 'express';
import { healthCheck } from '../middlewares/healthCheck.js';
import verifyToken  from '../middlewares/authorizationMiddleware.js';
import { 
    createPlan, 
    getAllPlans, 
    getPlanById, 
    patchPlan, 
    deletePlan 
} from '../controllers/planControllers.js';

const router = express.Router();

router.post('/plan', healthCheck, verifyToken, createPlan);
router.get('/plan', healthCheck, verifyToken, getAllPlans);
router.get('/plan/:id', healthCheck, verifyToken, getPlanById);
router.patch('/plan/:id', healthCheck, verifyToken, patchPlan);
router.delete('/plan/:id', healthCheck, verifyToken, deletePlan);

export default router;
