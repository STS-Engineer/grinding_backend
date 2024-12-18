const { Pool } = require('pg');

const pool = new Pool({
  user: 'adminavo',  // Matches the user in docker-compose
  host: 'avo-adb-001.postgres.database.azure.com',  // 'db' is the service name in Docker Compose, not 'localhost'
  database: 'web_app_competitor',  // The database name as per docker-compose
  password: '$#fKcdXPg4@ue8AW',  // Password as per docker-compose
  port: 5432,  // Default PostgreSQL port
  ssl: { rejectUnauthorized: false },  // Enable SSL if you're connecting to Azure
});

module.exports = pool;
