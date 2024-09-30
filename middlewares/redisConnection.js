import redis from 'redis';
import { redisUrl } from '../config/redisConfig.js';

const redisConnection = redis.createClient({
  url: redisUrl,
});

const connectRedis = async () => {
  return new Promise(async (resolve, reject) => {
    try {
        redisConnection.on('error', (err) => {
        console.error('Redis Client Error:', err);
        reject(err);
      });

      await redisConnection.connect();
      console.log('Connected to Redis');
      resolve(redisConnection);
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      reject(error);
    }
  });
};


connectRedis();

export { redisConnection }; 

