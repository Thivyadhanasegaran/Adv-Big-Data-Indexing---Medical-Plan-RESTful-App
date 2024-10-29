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
        res.setHeader('Transfer-Encoding', 'chunked');
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .header('Pragma', 'no-cache')
        .header('X-Content-Type-Options', 'nosniff');
        return res.status(400).json({
            message: 'Missing or invalid fields in request body',
            statusCode: 400,
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


// Update a plan by ID (PATCH)
export const updatePlan = async (req, res) => {
    const planId = req.params.id;
    const updateData = req.body;

    // Optionally validate updateData here
    const valid = validate(updateData);
    if (!valid) {
        return res.status(400).json({
            message: 'Invalid fields in update request',
            errors: validate.errors,
        });
    }

    try {
        const existingPlan = await redisConnection.get(planId);
        if (!existingPlan) {
            return res.status(404).json({ message: `Plan with ID: ${planId} does not exist`, status: 404 });
        }

        const existingPlanData = JSON.parse(existingPlan);
        const etagRes = etagCreater(JSON.stringify(existingPlanData));

        // Check if the request has an 'If-Match' header and if the ETag matches
        const ifMatchHeader = req.get('If-Match');
        if (ifMatchHeader && ifMatchHeader !== etagRes) {
            // If the ETag does not match, respond with 412 Precondition Failed
            return res.status(412).json({
                message: 'Precondition Failed: ETag does not match',
                status: 412
            });
        }

        // Update the plan data
        const updatedPlanData = { ...existingPlanData, ...updateData };

        // Save the updated plan back to Redis
        await redisConnection.set(planId, JSON.stringify(updatedPlanData));

        // Create a new ETag for the updated plan
        const newEtagRes = etagCreater(JSON.stringify(updatedPlanData));
        res.set('Etag', newEtagRes);
        return res.status(200).json({ message: `Plan with ID: ${planId} updated successfully`, updatedPlanData });
    } catch (error) {
        console.error('Error updating plan:', error);
        return res.status(500).json({ message: 'Error updating plan', error: error.message });
    }
};

// Replace a plan by ID (PUT)
export const putPlan = async (req, res) => {
    const planId = req.params.id;
    const newPlanData = req.body;

    // Optionally validate newPlanData here
    const valid = validate(newPlanData);
    if (!valid) {
        return res.status(400).json({
            message: 'Invalid fields in replace request',
            errors: validate.errors,
        });
    }

    try {
        const existingPlan = await redisConnection.get(planId);
        if (!existingPlan) {
            return res.status(404).json({ message: `Plan with ID: ${planId} does not exist`, status: 404 });
        }

        const existingPlanData = JSON.parse(existingPlan);
        const etagRes = etagCreater(JSON.stringify(existingPlanData));

        // Check if the request has an 'If-Match' header and if the ETag matches
        const ifMatchHeader = req.get('If-Match');
        if (ifMatchHeader && ifMatchHeader !== etagRes) {
            // If the ETag does not match, respond with 412 Precondition Failed
            return res.status(412).json({
                message: 'Precondition Failed: ETag does not match',
                status: 412
            });
        }

        // Replace the plan data
        await redisConnection.set(planId, JSON.stringify(newPlanData));

        // Create a new ETag for the replaced plan
        const newEtagRes = etagCreater(JSON.stringify(newPlanData));
        res.set('Etag', newEtagRes);
        return res.status(200).json({ message: `Plan with ID: ${planId} replaced successfully`, newPlanData });
    } catch (error) {
        console.error('Error replacing plan:', error);
        return res.status(500).json({ message: 'Error replacing plan', error: error.message });
    }
};


// Delete a plan by ID
export const deletePlan = async (req, res) => {
    try {
        const planId = req.params.id;
        console.log(`Attempting to delete plan with ID: ${planId}`);

        // Retrieve the existing plan to get its current ETag
        const existingPlan = await redisConnection.get(planId);
        if (!existingPlan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const existingPlanData = JSON.parse(existingPlan);
        const etagRes = etagCreater(JSON.stringify(existingPlanData));

        // Check if the request has an 'If-Match' header and if the ETag matches
        const ifMatchHeader = req.get('If-Match');
        if (ifMatchHeader && ifMatchHeader !== etagRes) {
            // If the ETag does not match, respond with 412 Precondition Failed
            return res.status(412).json({
                message: 'Precondition Failed: ETag does not match',
                status: 412
            });
        }

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