import Fastify from 'fastify'
import fastifyPostgres from '@fastify/postgres'
import {
  migrateEvaluateDB,
  migrateStatsDB
} from '@filecoin-station/spark-stats-db'

const {
  DATABASE_URL,
  EVALUATE_DB_URL
} = process.env

const app = Fastify({ logger: false })

await app.register(fastifyPostgres, {
  connectionString: DATABASE_URL,
  name: 'stats'
})

await app.register(fastifyPostgres, {
  connectionString: EVALUATE_DB_URL,
  name: 'evaluate'
})

try {
  console.log('Running migrations for stats database...')
  await migrateStatsDB(app.pg.stats)
  
  console.log('Running migrations for evaluate database...')
  await migrateEvaluateDB(app.pg.evaluate)
  
  console.log('All migrations completed successfully')
} catch (error) {
  console.error('Migration failed:', error)
  process.exit(1)
} finally {
  await app.close()
}