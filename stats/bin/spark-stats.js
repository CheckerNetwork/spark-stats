import '../lib/instrument.js'
import { createApp } from '../lib/app.js'

const {
  PORT = '8080',
  HOST = '127.0.0.1',
  SPARK_API_BASE_URL = 'https://api.filspark.com/',
  REQUEST_LOGGING = 'true',
  DATABASE_URL,
  EVALUATE_DB_URL
} = process.env


const app = await createApp({
  SPARK_API_BASE_URL,
  DATABASE_URL,
  EVALUATE_DB_URL,
  logger: {
    level: ['1', 'true'].includes(REQUEST_LOGGING) ? 'info' : 'error'
  }
})

console.log('Starting the http server on host %j port %s', HOST, PORT)
await app.listen({ port: Number(PORT), host: HOST })
console.log(`Server listening at ${HOST}:${PORT}`)

