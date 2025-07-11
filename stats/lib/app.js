import Fastify from 'fastify'
import cors from '@fastify/cors'
import urlData from '@fastify/url-data'

import { addRoutes } from './routes.js'
import { addPlatformRoutes } from './platform-routes.js'

/** @typedef {import('@filecoin-station/spark-stats-db').PgPools} PgPools */
/** @typedef {import('./typings.js').DateRangeFilter} DateRangeFilter */

/**
 * @param {object} args
 * @param {string} args.SPARK_API_BASE_URL
 * @param {import('@filecoin-station/spark-stats-db').PgPools} args.pgPools
 * @param {Fastify.FastifyLoggerOptions} args.logger
 * @returns
 */
export const createApp = ({
  SPARK_API_BASE_URL,
  pgPools,
  logger
}) => {
  const app = Fastify({ logger })

  app.register(cors, {
    origin: [
      'http://localhost:3000',
      'app://-',
      'https://checker-draft.webflow.io',
      'https://www.checker.network',
      'https://leaderboard.checker.network',
      'https://leaderboard-f1i.pages.dev',
      // Allow all subdomains of leaderboard-f1i.pages.dev
      // generated by Cloudflare Pages preview deployments
      /^https:\/\/[^.]+\.leaderboard-f1i\.pages\.dev$/
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
