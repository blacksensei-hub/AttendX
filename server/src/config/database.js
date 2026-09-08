const { Sequelize } = require('sequelize');
require('dotenv').config();

// Prefer DATABASE_URL (Neon, Railway, any hosted Postgres) when present.
// Falls back to the discrete DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS
// fields for plain local Postgres, where no connection string is needed
// and SSL isn't used.
//
// This file previously ignored DATABASE_URL entirely and always built
// the connection from the DB_* fields — so setting DATABASE_URL in .env
// silently did nothing; the app kept talking to whatever DB_HOST pointed
// at. That's the bug this fixes.
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      // Neon's pooled endpoint is PgBouncer in transaction mode. A raw TCP
      // connection to it succeeds even when Sequelize's own connect fails —
      // confirmed via a debug route that opened a bare socket successfully
      // from the same host where Sequelize was refused. That gap points at
      // the Postgres-protocol/pool layer, not the network: PgBouncer in
      // transaction mode doesn't support some session-level behaviour
      // Sequelize assumes by default (prepared statement caching being the
      // classic one). `pgbouncer: true` tells Sequelize's pg dialect to
      // disable that behaviour. A smaller pool matches Neon's stricter
      // per-connection limits on the free tier — 10 simultaneous connection
      // attempts from a cold pool is a plausible way to get intermittently
      // refused where a single bare socket connects fine.
      pool: {
        max:     5,
        min:     0,
        acquire: 30000,
        idle:    10000,
      },
      dialectOptions: {
        // Neon and Railway both require SSL. rejectUnauthorized: false is
        // standard for these managed providers — they use certificates
        // that Node's default CA bundle doesn't recognise, and both
        // platforms document this exact setting for Node/Sequelize.
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
        // Required when connecting through Neon's (or any) PgBouncer pooler
        // in transaction mode.
        pgbouncer: true,
      },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASS,
      {
        host:    process.env.DB_HOST,
        port:    process.env.DB_PORT,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max:     10,
          min:     0,
          acquire: 30000,
          idle:    10000,
        },
      }
    );

module.exports = sequelize;