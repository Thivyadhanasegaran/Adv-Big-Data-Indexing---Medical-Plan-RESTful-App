import { redisConnection } from '../middlewares/redisConnection.js';

const healthCheck = async (req, res) => {
  try {
    const result = await redisConnection.ping();

    if (result === 'PONG') {
      res
        .status(200)
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .header('Pragma', 'no-cache')
        .header('X-Content-Type-Options', 'nosniff')
        .json({ status: 'Healthy', redis: 'Connected' });
    } else {
      res.status(500).json({ status: 'Unhealthy', redis: 'Not Connected' });
    }
  } catch (error) {
    res
      .status(500)
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .header('Pragma', 'no-cache')
      .header('X-Content-Type-Options', 'nosniff')
      .json({ status: 'Unhealthy', redis: 'Error', message: error.message });
  }
};

export default healthCheck;
