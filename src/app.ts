import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import router from '@/routes';
import { errorHandler, notFound } from '@/middlewares';
const app: Application = express();

// CORS configuration
const corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200
};

// parsers
app.use(express.json());
app.use(cors(corsOptions));
app.use(morgan('dev'));

// application routes
app.use('/api/v1', router)

const entryRoute = (req: Request, res: Response) => {
  const message = 'Server is running...';
  res.send(message)
}

app.get('/', entryRoute)

//Not Found
app.use(notFound);

app.use(errorHandler);

export default app;