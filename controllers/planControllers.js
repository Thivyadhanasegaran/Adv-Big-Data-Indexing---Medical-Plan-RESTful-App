import { etagCreater } from '../middlewares/etagCreater.js';
import rabbit from "../services/rabbitmq.service.js";
import AJV from 'ajv';
import dataSchema from '../models/dataSchema.js';
import { client } from '../middlewares/healthCheck.js';

const ajv = new AJV();

const flattenKeys = async (data) =>{
    const parentKey=`${data.objectType}:${data.objectId}`;
    let newObj = {}; 
    for(let [key,value] of Object.entries(data)){
        if(typeof value == 'object' && !Array.isArray(value)){
            const newKey = `${parentKey}:${key}`;
            const res = await flattenKeys(value);
            await client.set(newKey, JSON.stringify(res),(err, reply) => {
                if (err) {
                    return res.status(500).send();
                }
            })
            newObj[key] =newKey; 
        }
        else if(Array.isArray(value)){
            let arr = [];
            for(let i=0;i<value.length;i++){
                arr.push(await flattenKeys(value[i]));
            }
            const newKey = `${parentKey}:${key}`;
            await client.set(newKey, JSON.stringify(arr),(err, reply) => {
                if (err) {
                    return res.status(500).send();
                }
            })
            newObj[key] = newKey;
        }
        else{
            newObj[key] = value;
        }
    }

    await client.set(parentKey, JSON.stringify(newObj),(err, reply) => {
        if (err) {
            return res.status(500).send();
        }
    })
    return parentKey;
}

const unflattenKeys = async (parentKey) =>{
    let response = await client.get(parentKey);
    if(response == null) return null;
    let data = JSON.parse(response);
    let newObj = {};
    if(typeof data == 'string'){
        if(data.split(':').length > 1){
            return unflattenKeys(data);
        }
    }
    else if(Array.isArray(data)){
        let arr = [];
        for(let i=0;i<data.length;i++){
            if(data[i].split(':').length > 1){
                const res= await unflattenKeys(data[i]);
                arr.push(res);
            }
        }
        return arr;
    }
    for(let [key,value] of Object.entries(data)){
        if(typeof value == 'string'){
            value.split(':').length > 1 ? newObj[key] = await unflattenKeys(value) : newObj[key] = value;
        }
        else if(Array.isArray(value)){
            let arr = [];
            for(let i=0;i<value.length;i++){
                const res= await unflattenKeys(value[i]);
                arr.push(res);
            }
            newObj[key] = arr;
        }
        else{
            newObj[key] = value;
        }        
    }
    return newObj;
}

export const createPlan = async (req, res) => {
    if (req._body == false || req.get('Content-length') == 0 || !req.body['objectId'] || ajv.validate(dataSchema, req.body) == false) {
        res.setHeader('Transfer-Encoding', 'chunked');
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .header('Pragma', 'no-cache')
        .header('X-Content-Type-Options', 'nosniff');
        return res.status(400).json({
            message: 'Bad Request - Invalid input data',
            statusCode: 400,
        });
    }
    const parentKey = `plan:${req.body.objectId}`;
    const checkIfExist = await client.get(parentKey);
    if (checkIfExist != null) {
        return res.status(409).json({
            message: 'Conflict - Object already exists',
            statusCode: 409,
        });
    }

    await flattenKeys(req.body);
    const etag = etagCreater(JSON.stringify(req.body));
    res.set('Etag', etag); 
    const message = {operation:"STORE", body:req.body};
    rabbit.producer(message);
   
   res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
   .header('Pragma', 'no-cache')
   .header('X-Content-Type-Options', 'nosniff');
   return res.status(201).json({ message: `Plan with ID: ${req.body.objectId} created successfully`, objectId: req.body.objectId, statusCode: 201 });

}

export const getAllPlans = async (req, res) => {
    try {
        const keys = await client.keys('*');
        let result = [];
        for (let key of keys) {
            const value = await client.get(key);
            result.push(JSON.parse(value));
        }
        const etagRes = etagCreater(JSON.stringify(result));
        if (req.get('If-None-Match') && etagRes == req.get('If-None-Match')) {
            return res.status(304).send();
        }
        res.set('Etag', etagRes);
        return res.status(200).send(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).send();
    }
}


export const getPlanById = async (req, res) => {
    try {
        const parentKey = `plan:${req.params.id}`;
        let response;

        try {
            // Try to fetch data
            response = await unflattenKeys(parentKey);
        } catch (fetchError) {
            // If there's an error fetching the data, log and handle it
            console.error('Error fetching from Redis:', fetchError);
            return res.status(404).json({
                message: `Plan with ID: ${req.params.id} does not exist`,
                status: 404,
            });
        }

        if (response == null) {
            // Key not found, return 404
            return res.status(404).json({
                message: `Plan with ID: ${req.params.id} does not exist`,
                status: 404,
            });
        }

        // ETag creation and validation
        const etagRes = etagCreater(JSON.stringify(response));
        if (req.get('If-None-Match') && etagRes == req.get('If-None-Match')) {
            res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
                .header('Pragma', 'no-cache')
                .header('X-Content-Type-Options', 'nosniff');
            res.header('Etag', etagRes);
            return res.status(304).send();
        }

        // Set ETag and send the response
        res.set('Etag', etagRes);
        return res.status(200).json(response);
    } catch (error) {
        console.error('Unexpected error fetching plan:', error);
        return res.status(500).json({
            message: 'Unexpected error fetching plan',
            error: error.message,
        });
    }
};

export const patchPlan = async (req, res) => {
    if (req._body == false || req.get('Content-length') == 0 || !req.body['objectId'] || ajv.validate(dataSchema, req.body) == false) {
        return res.status(400).send('Bad Request');
    }
    const planId = req.params.id;
    const parentKey = `plan:${req.params.id}`;  
    const response = await unflattenKeys(parentKey);
    if (response == null) {
        return res.status(404).json({ message: `Plan with ID: ${planId} does not exist`, status: 404 });        
    }

    if (req.get('If-Match') !== etagCreater(JSON.stringify(response))) {
     
        return res.status(412).json({
            message: 'Precondition Failed: ETag does not match',
            status: 412
        });
    }

    const oldResponse = await unflattenKeys(parentKey);
    for (let [key, value] of Object.entries(req.body)) {
        if (dataSchema.properties[key].type == 'array') {
            const oldArray = oldResponse[key];
            const newArray = value;
            for (let i = 0; i < newArray.length; i++) {
                const oldData = oldArray.filter((item) => item.objectId == newArray[i].objectId);
                if (oldData.length == 0) {
                    oldArray.push(newArray[i]);
                }
                else {
                    oldArray[oldArray.indexOf(oldData[0])] = newArray[i];
                }
            }
        }
        else {
            oldResponse[key] = value;
        }
    }
    await flattenKeys(oldResponse);
    const etagRes = etagCreater(JSON.stringify(oldResponse));
    res.set('Etag', etagRes);
    rabbit.producer({operation:"STORE", body:oldResponse});
    const updatedPlanData = oldResponse; 
    return res.status(200).json({
        message: `Plan with ID: ${planId} updated successfully`,
        updatedPlanData
    });
}

const deleteAllKeys = async (parentKey) => {
    try {
        const res = await client.get(parentKey);
        const data = JSON.parse(res);
        if (data == null) return;

        if (typeof data == 'string') {
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
                if (typeof value == 'string') {
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

        // Deleting the key after processing its children
        await client.del(parentKey);
    } catch (err) {
        console.log(`Error deleting key ${parentKey}:`, err);
    }
};

export const deletePlan = async (req, res) => {
    try {
        const parentKey = `plan:${req.params.id}`;
        const response = await client.get(parentKey);
        if (response == null) {
            return res.status(404).json({ 
                message: 'Plan not found', 
                status: 404 
            });
        }
        const clientData = await unflattenKeys(parentKey);
        const etagRes = etagCreater(JSON.stringify(clientData));

        // Check if the request has an 'If-Match' header and validate ETag
        const ifMatchHeader = req.get('If-Match');
        if (ifMatchHeader && ifMatchHeader !== etagRes) {
            return res.status(412).json({ 
                message: 'Precondition Failed: ETag does not match', 
                status: 412 
            });
        }

        await deleteAllKeys(parentKey);
        const message = {operation:"DELETE", body:clientData};
        rabbit.producer(message);
        return res.status(204).send();
    }
    catch (err) {
        console.log(err);
        return res.status(500).send();
    }
}
