import { sequelize, initDb } from './database.js'

async function migrate() {
  try {
    console.log('Starting database migration...')
    
    // Force sync will drop and recreate all tables
    // WARNING: This will delete all existing data
    await sequelize.sync({ force: true })
    
    console.log('✅ Database migration completed successfully!')
    console.log('All tables have been recreated with new schema.')
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrate()
