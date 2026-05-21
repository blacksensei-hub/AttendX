// server/src/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require:            true,
          rejectUnauthorized: false,
        },
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max:     10,
        min:     0,
        acquire: 30000,
        idle:    10000,
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