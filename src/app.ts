import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import router from '@/routes';
import { errorHandler, notFound } from '@/middlewares';

const app: Application = express();

app.set('trust proxy', 1);

const corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(morgan('dev'));

app.use('/api/v1', router)

const entryRoute = (req: Request, res: Response) => {
  const message = 'Server is running...';
  res.send(message)
}

app.get('/', entryRoute)

app.use(notFound);

app.use(errorHandler);

export default app;