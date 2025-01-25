import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

import config from '../config.js'

const { format, transports } = winston

const upperCaseLevel = format(info => {
  info.level = info.level.toUpperCase()
  return info
})

const logFormat = format.printf(({ level, message, timestamp }) => `${timestamp} [${level}] ${message}`)
const fileDateFormat = 'YYYY-MM-DD'

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: format.combine(
    upperCaseLevel(),
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ssZ' }),
    logFormat,
  ),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      level: 'debug',
      filename: config.logDir + '/debug-%DATE%.log',
      format: format.uncolorize(),
      datePattern: fileDateFormat,
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
    }),
    new DailyRotateFile({
      level: 'error',
      filename: config.logDir + '/error-%DATE%.log',
      format: format.uncolorize(),
      datePattern: fileDateFormat,
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
    }),
  ],
})

export default logger