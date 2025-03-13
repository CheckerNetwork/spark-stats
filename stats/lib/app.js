import * as Sentry from '@sentry/node'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import urlData from '@fastify/url-data'
import fastifyPostgres from '@fastify/postgres'

import { addRoutes } from './routes.js'
import { addPlatformRoutes } from './platform-routes.js'

/** @typedef {import('@filecoin-station/spark-stats-db').PgPools} PgPools */
/** @typedef {import('./typings.js').DateRangeFilter} DateRangeFilter */

/**
 * @param {object} args
 * @param {string} args.SPARK_API_BASE_URL
 * @param {string} args.DATABASE_URL - Connection string for stats database
 * @param {string} args.EVALUATE_DB_URL - Connection string for evaluate database
 * @param {import('fastify').FastifyLoggerOptions} args.logger
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export const createApp = async ({
  SPARK_API_BASE_URL,
  DATABASE_URL,
  EVALUATE_DB_URL,
  logger
}) => {
  const app = Fastify({ logger })
  Sentry.setupFastifyErrorHandler(app)

  await app.register(fastifyPostgres, {
    connectionString: DATABASE_URL,
    name: 'stats'
  })

  await app.register(fastifyPostgres, {
    connectionString: EVALUATE_DB_URL,
    name: 'evaluate',
  })

  const pgPools = {
    stats: app.pg.stats,
    evaluate: app.pg.evaluate,
    async end() {
      await app.close()
    }
  }

  app.register(cors, {
    origin: [
      'http://localhost:3000',
      'app://-',
      'https://checker-draft.webflow.io',
      'https://www.checker.network'
    ]
  })
  app.register(urlData)
  addRoutes(app, pgPools, SPARK_API_BASE_URL)
  addPlatformRoutes(app, pgPools)
  app.get('/', (request, reply) => {
    reply.send('OK')
  })

  return app
}