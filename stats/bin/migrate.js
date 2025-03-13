import {
  migrateEvaluateDB,
  migrateStatsDB,
  getPgPools
} from '@filecoin-station/spark-stats-db'

const {
  DATABASE_URL,
  EVALUATE_DB_URL
} = process.env

try {
  console.log('Running migrations for stats database...')
  const pgPools = await getPgPools()
  
  // @ts-ignore - PgPoolStats actually does have a query method at runtime
  await migrateStatsDB(pgPools.stats)
  
  // @ts-ignore - Similarly for evaluate
  await migrateEvaluateDB(pgPools.evaluate)
  
  await pgPools.end()
  
  console.log('All migrations completed successfully')
} catch (error) {
  console.error('Migration failed:', error)
  process.exit(1)
}