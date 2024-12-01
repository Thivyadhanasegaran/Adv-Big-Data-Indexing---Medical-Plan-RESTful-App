import express from 'express';
import planRoutes from './routes/planRoutes.js';
import healthRoute from './routes/healthRoute.js';
import { elasticServiceConnection, client } from './services/elasticServiceConnection.js';
import receiver from './pubsub/receiver.js';

const app = express();

// Middleware to parse JSON body
app.use(express.json());

// Routes
app.use('/', healthRoute);
app.use('/v1/plan', planRoutes);

// Start the server and initialize services
const PORT = process.env.PORT || 8000;

app.listen(PORT, async () => {
  try {
    // Initialize Elasticsearch connection
    const elasticResponse = await elasticServiceConnection();
    if (elasticResponse.status === 200) {
      console.log('Elasticsearch is connected.');
    } else {
      console.error('Failed to connect to Elasticsearch.');
    }

    // Start RabbitMQ consumer for queuing operations
    receiver();
    console.log('RabbitMQ consumer is running.');

    console.log(`Server is running on port ${PORT}`);
  } catch (err) {
    console.error('Error during server initialization:', err);
  }
});

export default app;
