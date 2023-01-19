require("dotenv").config();

const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASS,
  connectionLimit: 5,
});

const pool_pps = mariadb.createPool({
  host: process.env.HOST_PPS,
  user: process.env.USER_PPS,
  password: process.env.PASS_PPS,
  connectionLimit: 5,
});

module.exports = { pool, pool_pps };
