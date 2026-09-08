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
      pool: {
        max:     10,
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