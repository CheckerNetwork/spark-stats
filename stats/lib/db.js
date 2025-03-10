// stats/lib/db.js
import Fastify from 'fastify'
import fastifyPostgres from '@fastify/postgres'

let fastifyApp = null
let isInitialized = false

/**
 * Initialize database connections
 * @param {Object} options 
 * @param {string} options.statsConnectionString - Stats DB connection string
 * @param {string} options.evaluateConnectionString - Evaluate DB connection string
 * @returns {Promise<void>}
 */
export async function initializeDb({ statsConnectionString, evaluateConnectionString }) {
  if (isInitialized) return
  
  // Create a minimal Fastify instance for database connections
  fastifyApp = Fastify({ logger: false })
  
  // Register the Postgres plugin for stats DB
  await fastifyApp.register(fastifyPostgres, {
    connectionString: statsConnectionString,
    name: 'stats',
    pool: {
      min: 0,
      max: 100,
      idleTimeoutMillis: 1000,
      maxLifetimeSeconds: 60
    }
  })
  
  // Register the Postgres plugin for evaluate DB
  await fastifyApp.register(fastifyPostgres, {
    connectionString: evaluateConnectionString,
    name: 'evaluate',
    pool: {
      min: 0,
      max: 100,
      idleTimeoutMillis: 1000,
      maxLifetimeSeconds: 60
    }
  })
  
  isInitialized = true
  console.log('Database connections initialized')
}

/**
 * Execute a query on the stats database
 * @param {Function} queryFn - Function that takes a client and executes a query
 * @returns {Promise<*>} The result of the query function
 */
export async function withStatsDb(queryFn) {
  if (!isInitialized) {
    throw new Error('Database connections not initialized')
  }
  
  const client = await fastifyApp.pg.stats.connect()
  try {
    return await queryFn(client)
  } finally {
    client.release()
  }
}

/**
 * Execute a query on the evaluate database
 * @param {Function} queryFn - Function that takes a client and executes a query
 * @returns {Promise<*>} The result of the query function
 */
export async function withEvaluateDb(queryFn) {
  if (!isInitialized) {
    throw new Error('Database connections not initialized')
  }
  
  const client = await fastifyApp.pg.evaluate.connect()
  try {
    return await queryFn(client)
  } finally {
    client.release()
  }
}

/**
 * Get PgPools object compatible with the existing API
 * @returns {Object} PgPools object
 */
export function getPgPools() {
  if (!isInitialized) {
    throw new Error('Database connections not initialized')
  }
  
  return {
    stats: fastifyApp.pg.stats,
    evaluate: fastifyApp.pg.evaluate,
    async end() {
      await closeDb()
    }
  }
}

/**
 * Close all database connections
 * @returns {Promise<void>}
 */
export async function closeDb() {
  if (isInitialized && fastifyApp) {
    await fastifyApp.close()
    isInitialized = false
    console.log('Database connections closed')
  }
}