import { migrateWithPgClient as migrateEvaluateDB } from 'spark-evaluate/lib/migrate.js'
import { mapParticipantsToIds } from 'spark-evaluate/lib/platform-stats.js'
import pg from 'pg'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Postgrator from 'postgrator'

// re-export types
/** @typedef {import('./typings.js').PgPools} PgPools */
/** @typedef {import('./typings.js').PgPoolStats} PgPoolStats */
/** @typedef {import('./typings.js').PgPoolEvaluate} PgPoolEvaluate */
/** @typedef {import('./typings.js').Queryable} Queryable */

export { migrateEvaluateDB }

const {
  // DATABASE_URL points to `spark_stats` database managed by this monorepo
  DATABASE_URL = 'postgres://localhost:5432/spark_stats',

  // EVALUATE_DB_URL points to `spark_evaluate` database managed by spark-evaluate repo.
  // Eventually, we should move the code updating stats from spark-evaluate to this repo
  // and then we won't need two connection strings.
  EVALUATE_DB_URL = 'postgres://localhost:5432/spark_evaluate'
} = process.env

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations'
)

const poolConfig = {
  // allow the pool to close all connections and become empty
  min: 0,
  // this values should correlate with service concurrency hard_limit configured in fly.toml
  // and must take into account the connection limit of our PG server, see
  // https://fly.io/docs/postgres/managing/configuration-tuning/
  max: 100,
  // close connections that haven't been used for one second
  idleTimeoutMillis: 1000,
  // automatically close connections older than 60 seconds
  maxLifetimeSeconds: 60
}

const onError = err => {
  // Prevent crashing the process on idle client errors, the pool will recover
  // itself. If all connections are lost, the process will still crash.
  // https://github.com/brianc/node-postgres/issues/1324#issuecomment-308778405
  console.error('An idle client has experienced an error', err.stack)
}

/**
 * @returns {Promise<PgPoolStats>}
 */
export const getStatsPgPool = async () => {
  const stats = Object.assign(
    new pg.Pool({
      ...poolConfig,
      connectionString: DATABASE_URL
    }),
    /** @type {const} */({ db: 'stats' })
  )
  stats.on('error', onError)
  await stats.query('SELECT 1')
  return stats
}

/**
 * @returns {Promise<PgPoolEvaluate>}
 */
export const getEvaluatePgPool = async () => {
  const evaluate = Object.assign(
    new pg.Pool({
      ...poolConfig,
      connectionString: EVALUATE_DB_URL
    }),
    /** @type {const} */({ db: 'evaluate' })
  )
  evaluate.on('error', onError)
  await evaluate.query('SELECT 1')
  return evaluate
}

/**
 * @returns {Promise<PgPools>}
 */
export const getPgPools = async () => {
  const stats = await getStatsPgPool()
  const evaluate = await getEvaluatePgPool()
  const end = async () => { await Promise.all([stats.end(), evaluate.end()]) }

  return { stats, evaluate, end }
}

/**
 * @param {Queryable} client
 */
export const migrateStatsDB = async (client) => {
  const postgrator = new Postgrator({
    migrationPattern: join(migrationsDirectory, '*'),
    driver: 'pg',
    execQuery: (query) => client.query(query)
  })
  console.log(
    'Migrating `spark-stats` DB schema from version %s to version %s',
    await postgrator.getDatabaseVersion(),
    await postgrator.getMaxVersion()
  )

  await postgrator.migrate()

  console.log('Migrated `spark-stats` DB schema to version', await postgrator.getDatabaseVersion())
}

/**
 * @param {import('./typings.js').Queryable} pgPool
 * @param {string} day
 * @param {string[]} participantAddresses
 */
export const givenDailyParticipants = async (pgPool, day, participantAddresses) => {
  const ids = await mapParticipantsToIds(pgPool, new Set(participantAddresses))
  await pgPool.query(`
    INSERT INTO daily_participants (day, participant_id)
    SELECT $1 as day, UNNEST($2::INT[]) AS participant_id
    ON CONFLICT DO NOTHING
  `, [
    day,
    Array.from(ids.values())
  ])
}
