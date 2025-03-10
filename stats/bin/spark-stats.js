import '../lib/instrument.js'
import Fastify from 'fastify'
import fastifyPostgres from '@fastify/postgres'
import { createApp } from '../lib/app.js'

const {
  PORT = '8080',
  HOST = '127.0.0.1',
  SPARK_API_BASE_URL = 'https://api.filspark.com/',
  REQUEST_LOGGING = 'true',
  DATABASE_URL,

} = process.env

const pgPools = await getPgPools()

const dbFastify = Fastify({ logger: false })

await dbFastify.register(fastifyPostgres, {
  connectionString: DATABASE_URL,
  name: 'stats',
  pool: {
    min: 0,
    max: 100,
    idleTimeoutMillis: 1000,
    maxLifetimeSeconds: 60
  }
})

const pgPools = {
  stats: dbFastify.pg.stats,
  evaluate: dbFastify.pg.evaluate,
  async end() {
    await dbFastify.close()
  }
}


export const withDb = async (poolName, queryFn) => {
  const client = await dbFastify.pg[poolName].connect()
  try {
    return await queryFn(client)
  } finally {
    client.release()
  }
}

const app = await createApp({
  SPARK_API_BASE_URL,
  pgPools,
  logger: {
    level: ['1', 'true'].includes(REQUEST_LOGGING) ? 'info' : 'error'
  }
})
console.log('Starting the http server on host %j port %s', HOST, PORT)
const baseUrl = app.listen({ port: Number(PORT), host: HOST })
console.log(baseUrl)
