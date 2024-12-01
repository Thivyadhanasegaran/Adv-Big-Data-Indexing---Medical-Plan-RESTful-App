import Ajv from 'ajv';
import { redisConnection } from '../middlewares/redisConnection.js'; 
import planSchema from '../models/planSchema.js'; 
import planSchemaPatch from '../models/planSchemaPatch.js'; 
import { etagCreater } from '../middlewares/etagCreater.js';  
import { rabbit } from "../services/rabbitmq.service.js";


// Flatten keys function
const flattenKeys = async (data) => {
    const parentKey = `${data.objectType}:${data.objectId}`;
    let newObj = {};
    for (let [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && !Array.isArray(value)) {
            const newKey = `${parentKey}:${key}`;
            const res = await flattenKeys(value);
            await redisConnection.set(newKey, JSON.stringify(res));
            newObj[key] = newKey;
        } else if (Array.isArray(value)) {
            let arr = [];
            for (let i = 0; i < value.length; i++) {
                arr.push(await flattenKeys(value[i]));
            }
            const newKey = `${parentKey}:${key}`;
            await redisConnection.set(newKey, JSON.stringify(arr));
            newObj[key] = newKey;
        } else {
            newObj[key] = value;
        }
    }
    await redisConnection.set(parentKey, JSON.stringify(newObj));
    return parentKey;
};

// Unflatten keys function
const unflattenKeys = async (parentKey) => {
    let response = await redisConnection.get(parentKey);
    if (response == null) return null;
    let data = JSON.parse(response);
    let newObj = {};
    
    if (typeof data === 'string' && data.split(':').length > 1) {
        return unflattenKeys(data);
    }
    
    if (Array.isArray(data)) {
        let arr = [];
        for (let i = 0; i < data.length; i++) {
            const res = await unflattenKeys(data[i]);
            arr.push(res);
        }
        return arr;
    }

    for (let [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.split(':').length > 1) {
            newObj[key] = await unflattenKeys(value);
        } else if (Array.isArray(value)) {
            let arr = [];
            for (let i = 0; i < value.length; i++) {
                const res = await unflattenKeys(value[i]);
                arr.push(res);
            }
            newObj[key] = arr;
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};

const ajv = new Ajv();
const validate = ajv.compile(planSchema);
const validatePatch = ajv.compile(planSchemaPatch);

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

    const objectId = req.body.objectId;

    try {
        // Check if the plan with the given objectId already exists
        const existingPlan = await redisConnection.get(objectId);
        if (existingPlan) {
            return res.status(409).json({
                message: `Conflict: Plan with ID ${objectId} already exists.`,
                statusCode: 409,
            });
        }

        // Flatten the keys in the plan data
        const parentKey = await flattenKeys(req.body);

        // Save the entire plan to Redis (This step is already covered by flattenKeys)
        // Set the ETag header based on the JSON data
        const planData = await redisConnection.get(parentKey);
        res.set('Etag', etagCreater(JSON.stringify(planData))); // Set ETag header
        
        // Send message to RabbitMQ for async processing
        const message = { operation: "STORE", body: req.body };
        rabbit.producer(message);

        res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
            .header('Pragma', 'no-cache')
            .header('X-Content-Type-Options', 'nosniff');
        return res.status(201).json({
            message: `Plan with ID: ${objectId} created successfully`,
            objectId,
            statusCode: 201,
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Error creating plan' });
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

// Get a plan by ID
export const getPlan = async (req, res) => {
    try {
        const planId = req.params.id;
        const parentKey = `plan:${planId}`;
        
        // Retrieve and unflatten the plan from Redis
        const planData = await unflattenKeys(parentKey);
        
        if (!planData) {
            return res.status(404).json({
                message: `Plan with ID: ${planId} does not exist`,
                status: 404
            });
        }

        // Create an ETag based on the plan data
        const etagRes = etagCreater(JSON.stringify(planData));

        // Check if the request has an 'If-None-Match' header and if the ETag matches
        if (req.get('If-None-Match') && etagRes === req.get('If-None-Match')) {
            // Return a 304 Not Modified response if the ETag matches
            return res.status(304).send();
        }

        // Check for 'If-Match' header
        const ifMatchHeader = req.get('If-Match');
        if (ifMatchHeader && ifMatchHeader !== etagRes) {
            // If the ETag does not match, respond with 412 Precondition Failed
            return res.status(412).json({
                message: 'Precondition Failed: ETag does not match',
                status: 412
            });
        }

        // Set the ETag header and respond with the plan data
        res.set('Etag', etagRes);
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
            .header('Pragma', 'no-cache')
            .header('X-Content-Type-Options', 'nosniff');
        return res.status(200).json(planData);

    } catch (error) {
        console.error('Error fetching plan:', error);
        return res.status(500).json({
            message: 'Error fetching plan',
            error: error.message
        });
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

        // Check 'If-None-Match' header to prevent updating if no changes were made
        const ifNoneMatchHeader = req.get('If-None-Match');
        if (ifNoneMatchHeader && ifNoneMatchHeader === etagRes) {
            // If the ETag matches, respond with 304 Not Modified
            return res.status(304).send();
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

export const updatePlan = async (req, res) => {
    const planId = req.params.id;
    const updateData = req.body;

    // Validate updateData
    const valid = validatePatch(updateData);
    if (!valid) {
        return res.status(400).json({
            message: 'Invalid fields in update request',
            errors: validate.errors,
        });
    }

    try {
        // Retrieve the existing plan from Redis
        const existingPlan = await redisConnection.get(planId);
        if (!existingPlan) {
            return res.status(404).json({ message: `Plan with ID: ${planId} does not exist`, status: 404 });
        }

        // Parse the existing plan data
        const existingPlanData = JSON.parse(existingPlan);

        // Create an ETag for the existing plan
        const etagRes = etagCreater(JSON.stringify(existingPlanData));

        // Check 'If-Match' header for optimistic concurrency control
        const ifMatchHeader = req.get('If-Match');
        if (ifMatchHeader && ifMatchHeader !== etagRes) {
            return res.status(412).json({
                message: 'Precondition Failed: ETag does not match',
                status: 412
            });
        }

        // Check 'If-None-Match' header to avoid updating unchanged resources
        const ifNoneMatchHeader = req.get('If-None-Match');
        if (ifNoneMatchHeader && ifNoneMatchHeader === etagRes) {
            return res.status(304).send();
        }

        // Merge the new data with the existing data
        const mergeData = (oldResponse, newData) => {
            const mergedResponse = { ...oldResponse };

            for (let [key, value] of Object.entries(newData)) {
                if (Array.isArray(value)) {
                    const oldArray = mergedResponse[key] || [];
                    for (let i = 0; i < value.length; i++) {
                        const newItem = value[i];
                        const oldData = oldArray.find(item => item.objectId === newItem.objectId);

                        if (!oldData) {
                            oldArray.push(newItem);
                        } else {
                            Object.assign(oldData, newItem);
                        }
                    }
                    mergedResponse[key] = oldArray;
                } else {
                    mergedResponse[key] = value;
                }
            }

            return mergedResponse;
        };

        const updatedPlanData = mergeData(existingPlanData, updateData);

        // Save the updated plan back to Redis
        await redisConnection.set(planId, JSON.stringify(updatedPlanData));

        // Create a new ETag for the updated plan
        const newEtagRes = etagCreater(JSON.stringify(updatedPlanData));
        res.set('Etag', newEtagRes);

        // Log operation to the RabbitMQ producer
        rabbit.producer({ operation: "STORE", body: updatedPlanData });

        return res.status(200).json({
            message: `Plan with ID: ${planId} updated successfully`,
            updatedPlanData
        });
    } catch (error) {
        console.error('Error updating plan:', error);
        return res.status(500).json({
            message: 'Error updating plan',
            error: error.message
        });
    }
};

const deleteAllKeys = async (parentKey) => {
    const res = await redisConnection.get(parentKey);
    const data = JSON.parse(res);
    if (data == null) return;

    if (typeof data === 'string') {
        if (data.split(':').length > 1) {
            await deleteAllKeys(data);
        }
    } else if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i].split(':').length > 1) {
                await deleteAllKeys(data[i]);
            }
        }
    } else {
        for (let [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                if (value.split(':').length > 1) {
                    await deleteAllKeys(value);
                }
            } else if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    await deleteAllKeys(value[i]);
                }
            }
        }
    }
    await redisConnection.del(parentKey);
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
                status: 412,
            });
        }

        // Delete all keys related to the plan recursively
        await deleteAllKeys(planId);

        // Log the deletion for debugging purposes
        console.log(`Successfully deleted plan with ID: ${planId}`);

        // Respond with 204 No Content
        return res.status(204).send();
    } catch (error) {
        console.error('Error deleting plan:', error);
        return res.status(500).json({ message: 'Error deleting plan', error: error.message });
    }
};
