import { createClient } from 'redis';
import { redisUrl } from '../config/redisConfig.js';  

// Create the Redis client using the redisUrl from config
const client = createClient({
    url: redisUrl 
});

const redisConnection = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            await client.connect();
            console.log('Connected to Redis');
            resolve("Connected to Redis");
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            reject(error);
        }
    });
};

const healthCheck = async (req, res, next) => {
    try {
        if (!client.isOpen) {
            await redisConnection();
            console.log("Called connect");
        } else {
            console.log("Client is already open");
        }
        console.log("Calling next");
        next();
    } catch (err) {
        res.status(500).send(err);
    }
};

export { healthCheck, client };
