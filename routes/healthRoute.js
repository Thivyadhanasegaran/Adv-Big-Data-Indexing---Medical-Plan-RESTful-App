import express from 'express';
import { healthCheck } from '../middlewares/healthCheck.js';
import planRouter from './planRoutes.js';

const router = express.Router();

/* GET home page. */
router.get('/test', healthCheck, (req, res, next) => {
  res.status(200).send('Connected to Redis');
});

router.use('/v1', planRouter);

router.use((req, res) => {
  res.status(404).send('Not Found');
});

export default router;
