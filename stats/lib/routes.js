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
  fetchClientsRSRSummary,
  fetchAllocatorsRSRSummary,
  fetchDailyAllocatorRSRSummary
} from './stats-fetchers.js'

/** @typedef {import('./typings.js').RequestWithFilter} RequestWithFilter */
/** @typedef {import('./typings.js').RequestWithFilterAndAddress} RequestWithFilterAndAddress */
/** @typedef {import('./typings.js').RequestWithFilterAndMinerId} RequestWithFilterAndMinerId */
/** @typedef {import('./typings.js').RequestWithFilterAndClientId} RequestWithFilterAndClientId */

export const addRoutes = (app, SPARK_API_BASE_URL) => {
  app.register(async app => {
    app.addHook('preHandler', filterPreHandlerHook)
    app.addHook('onSend', filterOnSendHook)

    app.get('/deals/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyDealStats(request.server.pg, request.filter))
    })

    app.get('/deals/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDealSummary(request.server.pg, request.filter))
    })
    app.get('/retrieval-success-rate', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchRetrievalSuccessRate(request.server.pg, request.filter))
    })
    app.get('/participants/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyParticipants(request.server.pg, request.filter))
    })
    app.get('/participants/monthly', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchMonthlyParticipants(request.server.pg, request.filter))
    })
    app.get('/participants/change-rates', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchParticipantChangeRates(request.server.pg, request.filter))
    })
    app.get('/participant/:address/scheduled-rewards', async (/** @type {RequestWithFilterAndAddress} */ request, reply) => {
      reply.send(await fetchParticipantScheduledRewards(request.server.pg, request.filter, request.params.address))
    })
    app.get('/participant/:address/reward-transfers', async (/** @type {RequestWithFilterAndAddress} */ request, reply) => {
      reply.send(await fetchParticipantRewardTransfers(request.server.pg, request.filter, request.params.address))
    })
    app.get('/miners/retrieval-success-rate/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchMinersRSRSummary(request.server.pg, request.filter))
    })
    app.get('/miners/retrieval-timings/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchMinersTimingsSummary(request.server.pg, request.filter))
    })
    app.get('/retrieval-result-codes/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyRetrievalResultCodes(request.server.pg, request.filter))
    })
    app.get('/retrieval-timings/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyRetrievalTimings(request.server.pg, request.filter))
    })
    app.get('/miner/:minerId/retrieval-timings/summary', async (/** @type {RequestWithFilterAndMinerId} */ request, reply) => {
      reply.send(await fetchDailyMinerRetrievalTimings(request.server.pg, request.filter, request.params.minerId))
    })
    app.get('/miner/:minerId/retrieval-success-rate/summary', async (/** @type {RequestWithFilterAndMinerId} */ request, reply) => {
      reply.send(await fetchDailyMinerRSRSummary(request.server.pg, request.filter, request.params.minerId))
    })
    app.get('/clients/retrieval-success-rate/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchClientsRSRSummary(request.server.pg, request.filter))
    })
    app.get('/client/:clientId/retrieval-success-rate/summary', async (/** @type {RequestWithFilterAndClientId} */ request, reply) => {
      reply.send(await fetchDailyClientRSRSummary(request.server.pg, request.filter, request.params.clientId))
    })
    app.get('/allocators/retrieval-success-rate/summary', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchAllocatorsRSRSummary(request.server.pg, request.filter))
    })
    app.get('/allocator/:allocatorId/retrieval-success-rate/summary', async (/** @type {RequestWithFilterAndClientId} */ request, reply) => {
      reply.send(await fetchDailyAllocatorRSRSummary(request.server.pg, request.filter, request.params.allocatorId))
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
