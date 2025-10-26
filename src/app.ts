import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import router from '@/routes';
import { apiLimiter, errorHandler, notFound } from '@/middlewares';
import status from 'http-status';
import { connectDB } from '@/config/db';

const app: Application = express();

// Connect to database for serverless
connectDB().catch(err => console.error('[DB] Initial connection error:', err));

const corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: status.OK
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(morgan('dev'));

app.use('/api/v1', apiLimiter, router)

const entryRoute = (req: Request, res: Response) => {
  const message = 'Server is running...';
  res.send(message)
}

app.get('/', entryRoute)

app.use(notFound);

app.use(errorHandler);

export default app;