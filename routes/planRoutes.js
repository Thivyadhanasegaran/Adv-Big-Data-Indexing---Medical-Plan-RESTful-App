import express from 'express';
import { createPlan, getPlan, deletePlan, getAllPlans } from '../controllers/planControllers.js';

const router = express.Router();

// Create a new plan
router.post('/', createPlan);

// Get a specific plan by ID
router.get('/:id', getPlan);

// Get all plans
router.get('/', getAllPlans);

// Delete a specific plan by ID
router.delete('/:id', deletePlan);

export default router;
