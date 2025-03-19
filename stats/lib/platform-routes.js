import {
  fetchDailyStationCount,
  fetchMonthlyStationCount,
  fetchDailyRewardTransfers,
  fetchTopEarningParticipants,
  fetchParticipantsWithTopMeasurements,
  fetchDailyStationMeasurementCounts,
  fetchParticipantsSummary,
  fetchAccumulativeDailyParticipantCount,
  fetchDailyDesktopUsers
} from './platform-stats-fetchers.js'

import { filterPreHandlerHook, filterOnSendHook } from './request-helpers.js'

/** @typedef {import('./typings.js').RequestWithFilter} RequestWithFilter */

/**
 * Create an adapter to convert Fastify pg to the expected pgPools format
 * @param {any} pg Fastify pg object
 * @returns {object} pgPools compatible object
 */

function adaptPgPools(pg) {
  return {
    stats: pg.stats,
    evaluate: pg.evaluate,
    end: async () => {} // Empty implementation
  };
}


export const addPlatformRoutes = (app) => {
  app.register(async app => {
    app.addHook('preHandler', filterPreHandlerHook)
    app.addHook('onSend', filterOnSendHook)

    app.get('/stations/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyStationCount(request.server.pg.evaluate, request.filter))
    })
    app.get('/stations/monthly', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchMonthlyStationCount(request.server.pg.evaluate, request.filter))
    })
    app.get('/stations/desktop/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyDesktopUsers(request.server.pg.stats, request.filter))
    })
    app.get('/measurements/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyStationMeasurementCounts(request.server.pg.evaluate, request.filter))
    })
    app.get('/participants/top-measurements', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchParticipantsWithTopMeasurements(request.server.pg.evaluate, request.filter))
    })
    app.get('/participants/top-earning', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchTopEarningParticipants(pgPools.stats, request.filter))    })

    app.get('/participants/accumulative/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchAccumulativeDailyParticipantCount(request.server.pg.evaluate, request.filter))
    })
    app.get('/transfers/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchDailyRewardTransfers(pgPools.stats, request.filter))
    })
  })

  app.get('/participants/summary', async (request, reply) => {
    reply.header('cache-control', `public, max-age=${24 * 3600 /* one day */}`)
    reply.send(await fetchParticipantsSummary(request.server.pg.evaluate))
  })
}
