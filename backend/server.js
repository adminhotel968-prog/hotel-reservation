const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const PAYMENTS = ["GCash", "Cash", "Bank Transfer", "Credit/Debit Card"];
const STATUSES = ["Pending", "Confirmed", "Cancelled"];

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ message: "Server error. Please try again." });
  });

app.get("/api/rooms", wrap(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, slug, name, category, price, capacity, total_units FROM room_types WHERE is_active = 1 ORDER BY price"
  );
  res.json(rows);
}));

app.get("/api/reservations", wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.id, r.reservation_code AS code, r.guest_name AS guestName, r.email, r.phone,
            t.name AS roomType, r.check_in AS checkIn, r.check_out AS checkOut,
            r.guests, r.nights, r.total_amount AS totalAmount,
            r.payment_method AS paymentMethod, r.status, r.notes, r.created_at AS createdAt
     FROM reservations r JOIN room_types t ON t.id = r.room_type_id
     ORDER BY r.created_at DESC`
  );
  res.json(rows);
}));

app.post("/api/reservations", wrap(async (req, res) => {
  const { guestName, email, phone, roomType, checkIn, checkOut,
          guests = 1, paymentMethod = "GCash", notes = null } = req.body;

  if (!guestName || !email || !phone || !roomType || !checkIn || !checkOut)
    return res.status(400).json({ message: "Missing required fields." });
  if (!PAYMENTS.includes(paymentMethod))
    return res.status(400).json({ message: "Invalid payment method." });

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (!Number.isFinite(nights) || nights < 1)
    return res.status(400).json({ message: "Check-out must be after check-in." });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[room]] = await conn.query(
      "SELECT id, price, capacity, total_units FROM room_types WHERE name = ? AND is_active = 1 FOR UPDATE",
      [roomType]
    );
    if (!room) { await conn.rollback(); return res.status(400).json({ message: "Unknown room type." }); }
    if (Number(guests) < 1 || Number(guests) > room.capacity) {
      await conn.rollback();
      return res.status(400).json({ message: `This room allows 1 to ${room.capacity} guests.` });
    }

    const [[{ booked }]] = await conn.query(
      `SELECT COUNT(*) AS booked FROM reservations
       WHERE room_type_id = ? AND status <> 'Cancelled'
         AND check_in < ? AND check_out > ?`,
      [room.id, checkOut, checkIn]
    );
    if (booked >= room.total_units) {
      await conn.rollback();
      return res.status(409).json({ message: "No rooms of this type are available for those dates." });
    }

    const total = nights * Number(room.price);
    const code = "RES-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);

    const [result] = await conn.query(
      `INSERT INTO reservations
       (reservation_code, room_type_id, guest_name, email, phone, check_in, check_out,
        guests, nights, total_amount, payment_method, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'Pending', ?)`,
      [code, room.id, guestName, email, phone, checkIn, checkOut,
       guests, nights, total, paymentMethod, notes]
    );
    await conn.commit();
    res.status(201).json({ id: result.insertId, code, nights, totalAmount: total, status: "Pending" });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.patch("/api/reservations/:id/status", wrap(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });
  const [r] = await pool.query("UPDATE reservations SET status = ? WHERE id = ?", [status, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Status updated." });
}));

app.delete("/api/reservations/:id", wrap(async (req, res) => {
  const [r] = await pool.query("DELETE FROM reservations WHERE id = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Reservation deleted." });
}));

process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e));
process.on("uncaughtException", (e) => console.error("Uncaught exception:", e));

pool.query("SELECT 1")
  .then(() => app.listen(8080, () => console.log("Server running on port 8080, DB connected")))
  .catch((e) => { console.error("Cannot connect to MySQL. Is it started in XAMPP?\n", e.message); process.exit(1); });