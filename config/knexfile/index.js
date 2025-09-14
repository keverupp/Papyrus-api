const path = require("path");

// Explicitly load the root `.env` file since the knex CLI changes the
// working directory to this folder when executing migrations or seeds.
// Without the `path` option, `dotenv` would look for an `.env` inside
// `config/knexfile/`, causing database connection variables to be
// undefined.
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_DATABASE || "papyrus",
    },
    migrations: {
      directory: "../migrations",
      tableName: "knex_migrations",
    },
    seeds: {
      directory: "../seeds",
    },
  },

  production: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    },
    pool: {
      min: 5,
      max: 15,
    },
    migrations: {
      directory: "../migrations",
      tableName: "knex_migrations",
    },
    seeds: {
      directory: "../seeds",
    },
    ssl: {
      rejectUnauthorized: false,
    },
  },
};
