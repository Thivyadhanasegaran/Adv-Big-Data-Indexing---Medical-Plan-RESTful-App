import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import healthRoute from './routes/healthRoute.js';
import { elasticServiceConnection } from './services/elasticServiceConnection.js';

const app = express();

app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), 'public')));

app.use('/', healthRoute);

const PORT = process.env.PORT || 8000;


app.listen(PORT, async function () {
  try {
    await elasticServiceConnection();
    console.log(`Server is running on port ${PORT}`);

  } catch (err) {
    console.error(err);
  }
});

export default app;
