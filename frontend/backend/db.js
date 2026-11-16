const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "hotel_reservation",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

module.exports = pool;