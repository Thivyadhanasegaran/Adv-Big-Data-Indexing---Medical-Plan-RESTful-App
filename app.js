
import express from 'express';
import planRoutes from './routes/planRoutes.js';
import healthRoute from './routes/healthRoute.js';


const app = express();

// Middleware to parse JSON body
app.use(express.json());

// Routes
app.use('/', healthRoute);
app.use('/plan', planRoutes);


// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
