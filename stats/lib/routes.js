import { filterPreHandlerHook, filterOnSendHook } from './request-helpers.js'
import {
  fetchDailyDealStats,
  fetchDailyParticipants,
  fetchMinersRSRSummary,
  fetchMonthlyParticipants,
  fetchParticipantChangeRates,
  fetchParticipantScheduledRewards,
  fetchParticipantRewardTransfers,
  fetchRetrievalSuccessRate,
  fetchDealSummary,
  fetchDailyRetrievalResultCodes,
  fetchDailyMinerRSRSummary,
  fetchDailyRetrievalTimings,
  fetchDailyMinerRetrievalTimings,
  fetchMinersTimingsSummary,
  fetchDailyClientRSRSummary,
  fetchClientsRSRSummary
} from './stats-fetchers.js'

/** @typedef {import('./typings.js').RequestWithFilter} RequestWithFilter */
/** @typedef {import('./typings.js').RequestWithFilterAndAddress} RequestWithFilterAndAddress */
/** @typedef {import('./typings.js').RequestWithFilterAndMinerId} RequestWithFilterAndMinerId */
/** @typedef {import('./typings.js').RequestWithFilterAndClientId} RequestWithFilterAndClientId */

/**
 * Create an adapter to convert Fastify pg to the expected pgPools format
 * @param {any} pg Fastify pg object
 * @returns {object} pgPools compatible object
 */

function adaptPgPools(pg) {
  return {
    stats: pg.stats,
    evaluate: pg.evaluate,
    end: async () => {} 
  };
}

export const addRoutes = (app, SPARK_API_BASE_URL) => {
  app.register(async app => {
    app.addHook('preHandler', filterPreHandlerHook)
    app.addHook('onSend', filterOnSendHook)

    app.get('/deals/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchDailyDealStats(pgPools, request.filter))
    })
    
    
    app.get('/deals/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg)
      reply.send(await fetchDealSummary(pgPools, request.filter))
    })
    app.get('/retrieval-success-rate', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchRetrievalSuccessRate(pgPools, request.filter))
    })
    app.get('/participants/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg)
      reply.send(await fetchDailyParticipants(pgPools, request.filter))
    })
    app.get('/participants/monthly', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchMonthlyParticipants(pgPools, request.filter))
    })
    app.get('/participants/change-rates', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchParticipantChangeRates(pgPools, request.filter))
    })
    app.get('/participant/:address/scheduled-rewards', async (/** @type {RequestWithFilterAndAddress} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchParticipantScheduledRewards(pgPools, request.filter, request.params.address))
    })
    app.get('/participant/:address/reward-transfers', async (/** @type {RequestWithFilterAndAddress} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchParticipantRewardTransfers(pgPools, request.filter, request.params.address))
    })
    app.get('/miners/retrieval-success-rate/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchMinersRSRSummary(pgPools, request.filter))
    })
    app.get('/miners/retrieval-timings/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchMinersTimingsSummary(pgPools, request.filter))
    })
    app.get('/retrieval-result-codes/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchDailyRetrievalResultCodes(pgPools, request.filter))
    })
    app.get('/retrieval-timings/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchDailyRetrievalTimings(pgPools, request.filter))
    })
    app.get('/miner/:minerId/retrieval-timings/summary', async (/** @type {RequestWithFilterAndMinerId} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchDailyMinerRetrievalTimings(pgPools, request.filter, request.params.minerId))
    })
    app.get('/miner/:minerId/retrieval-success-rate/summary', async (/** @type {RequestWithFilterAndMinerId} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchDailyMinerRSRSummary(pgPools, request.filter, request.params.minerId))
    })
    app.get('/clients/retrieval-success-rate/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchClientsRSRSummary(pgPools, request.filter))
    })
    app.get('/client/:clientId/retrieval-success-rate/summary', async (/** @type {RequestWithFilterAndClientId} */ request, reply) => {
      const pgPools = adaptPgPools(request.server.pg);
      reply.send(await fetchDailyClientRSRSummary(pgPools, request.filter, request.params.clientId))
    })
  })

  app.get('/miner/:minerId/deals/eligible/summary', (request, reply) => {
    redirectToSparkApi(request, reply, SPARK_API_BASE_URL)
  })
  app.get('/client/:clientId/deals/eligible/summary', (request, reply) => {
    redirectToSparkApi(request, reply, SPARK_API_BASE_URL)
  })
  app.get('/allocator/:allocatorId/deals/eligible/summary', (request, reply) => {
    redirectToSparkApi(request, reply, SPARK_API_BASE_URL)
  })
}

/**
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 * @param {string} SPARK_API_BASE_URL
 */
const redirectToSparkApi = (request, reply, SPARK_API_BASE_URL) => {
  // Cache the response for 6 hours
  reply.header('cache-control', `max-age=${6 * 3600}`)

  const location = new URL(request.url, SPARK_API_BASE_URL).toString()
  reply.redirect(location, 302)
}
