import express from 'express';
import verifyToken from '../middlewares/authorizationMiddleware.js';
import { createPlan, getPlan, deletePlan, getAllPlans, updatePlan ,putPlan } from '../controllers/planControllers.js';

const router = express.Router();

// Create a new plan
router.post('/', verifyToken, createPlan);

// Get a specific plan by ID
router.get('/:id', verifyToken, getPlan);

// Get all plans
router.get('/',verifyToken, getAllPlans);

// Update a specific plan by ID (PATCH)
router.patch('/:id', verifyToken, updatePlan);

// Update a entire plan by ID (PUT)
router.put('/:id', verifyToken, putPlan);

// Delete a specific plan by ID
router.delete('/:id',verifyToken, deletePlan);

export default router;
