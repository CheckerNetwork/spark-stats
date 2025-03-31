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

export const addPlatformRoutes = (app) => {
  app.register(async app => {
    app.addHook('preHandler', filterPreHandlerHook)
    app.addHook('onSend', filterOnSendHook)

    app.get('/stations/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyStationCount(request.server.pg, request.filter))
    })
    app.get('/stations/monthly', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchMonthlyStationCount(request.server.pg, request.filter))
    })
    app.get('/stations/desktop/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyDesktopUsers(request.server.pg, request.filter))
    })
    app.get('/measurements/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyStationMeasurementCounts(request.server.pg, request.filter))
    })
    app.get('/participants/top-measurements', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchParticipantsWithTopMeasurements(request.server.pg, request.filter))
    })
    app.get('/participants/top-earning', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchTopEarningParticipants(request.server.pg, request.filter))
    })

    app.get('/participants/accumulative/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchAccumulativeDailyParticipantCount(request.server.pg, request.filter))
    })
    app.get('/transfers/daily', async (/** @type {RequestWithFilter} */ request, reply) => {
      reply.send(await fetchDailyRewardTransfers(request.server.pg, request.filter))
    })
  })

  app.get('/participants/summary', async (request, reply) => {
    reply.header('cache-control', `public, max-age=${24 * 3600 /* one day */}`)
    reply.send(await fetchParticipantsSummary(request.server.pg))
  })
}
