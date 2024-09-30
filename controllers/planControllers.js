import Ajv from 'ajv';
import { redisConnection } from '../middlewares/redisConnection.js'; 
import planSchema from '../models/planSchema.js'; 
import { etagCreater } from '../middlewares/etagCreater.js';  


const ajv = new Ajv();
const validate = ajv.compile(planSchema);

// Create a new plan
export const createPlan = async (req, res) => {
    const valid = validate(req.body);

    if (!valid) {
        console.error('Validation errors:', validate.errors);
        return res.status(400).json({
            message: 'Missing or invalid fields in request body',
            statusCode: 400,
            errors: validate.errors,
        });
    }

    try {
        const planId = req.body.objectId;

        // Save the entire plan to Redis as a JSON string
        await redisConnection.set(planId, JSON.stringify(req.body), (err, reply) => {
            if (err) {
                console.error('Error saving plan:', err);
                return res.status(500).send();
            }
        });

        const response = await redisConnection.get(planId);
        res.set('Etag', etagCreater(JSON.stringify(response))); 
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .header('Pragma', 'no-cache')
        .header('X-Content-Type-Options', 'nosniff');
        return res.status(201).json({ message: `Plan with ID: ${planId} created successfully`, planId, statusCode: 201 });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Error creating plan' });
    }
};

// Get a plan by ID
export const getPlan = async (req, res) => {
    try {
        const planId = req.params.id;

        // Retrieve the plan from Redis
        const plan = await redisConnection.get(planId);

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        if (!plan) {
            return res.status(404).json({              
                message: `Plan with ID: ${planId} does not exist`, 
                status: 404
            });
        }

        // Parse the stored JSON string back into an object
        const planData = JSON.parse(plan);

        // Create an ETag based on the plan data
        const etagRes = etagCreater(JSON.stringify(planData));

        // Check if the request has an 'If-None-Match' header and if the ETag matches
        if (req.get('If-None-Match') && etagRes === req.get('If-None-Match')) {
            
            res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
            .header('Pragma', 'no-cache')
            .header('X-Content-Type-Options', 'nosniff');
            res.header('Etag', etagRes);
            return res.status(304).send();  
           
        }

        res.set('Etag', etagRes);
        return res.status(200).json(planData);
    } catch (error) {
        console.error('Error fetching plan:', error);
        return res.status(500).json({ message: 'Error fetching plan', error: error.message });
    }
};

// Fetch all plans
export const getAllPlans = async (req, res) => {
    try {
        const keys = await redisConnection.keys('*');
        let result = [];
        for (let key of keys) {
            const value = await redisConnection.get(key);
            result.push(JSON.parse(value));
        }
        const etagRes = etagCreater(JSON.stringify(result));
        if (req.get('If-None-Match') && etagRes === req.get('If-None-Match')) {
            return res.status(304).send();
        }
        res.set('Etag', etagRes);
        return res.status(200).send(result);
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
  };

// Delete a plan by ID
export const deletePlan = async (req, res) => {
    try {
        const planId = req.params.id;
        console.log(`Attempting to delete plan with ID: ${planId}`);

        // Delete the plan from Redis
        const result = await redisConnection.del(planId); 
        console.log(`Deletion result for plan ID ${planId}:`, result);

        // Check if the result indicates the plan was found and deleted
        if (result === 0) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting plan:', error);
        return res.status(500).json({ message: 'Error deleting plan', error: error.message });
    }
};
