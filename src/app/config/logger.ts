import { createLogger, format, transports } from 'winston'
const { combine, timestamp, printf, colorize } = format;
import 'winston-mongodb'
import config from '.';

const isProd = config.NODE_ENV === 'production';
const logger = createLogger({
    level: isProd ? 'info' : 'debug',
    format: combine(
        ...(!isProd ? [colorize()] : []),
        timestamp({ format: isProd ? 'YYYY-MM-DD HH:mm:ss' : 'HH:mm:ss' }),
        printf(({ level, message, timestamp }) => {
            return `[${level}] : ${timestamp} :: ${message}`;
        })
    ),
    transports: [
        new transports.Console({}),
        ...(isProd
            ? [new transports.MongoDB({
                db: config.DATABASE_URL as string,
                level: 'info',
                options: { useUnifiedTopology: true },
            })]
            : [])
    ],
});

export { logger }