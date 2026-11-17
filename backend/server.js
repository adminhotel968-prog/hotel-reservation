const express = require("express");
const cors = require("cors");
const pool = require("./db");

const nodemailer = require("nodemailer");

const GMAIL_USER = "hazelmariechicano005@gmail.com";
const GMAIL_APP_PASSWORD = "wqjv wqjv qxqz qxqz";
const HOTEL_NAME = "Hytech Hotel & Bistro";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const peso = (value) => "PHP " + Number(value || 0).toLocaleString("en-PH");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function emailLayout(headline, intro, rows, footer) {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600;color:#1d3f40">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;border-top:5px solid #d8b46a;padding:24px;background:#faf6ec">
    <h2 style="margin:0 0 4px;color:#1d3f40">${escapeHtml(HOTEL_NAME)}</h2>
    <h3 style="margin:16px 0 8px;color:#1d3f40">${escapeHtml(headline)}</h3>
    <p style="color:#333;line-height:1.5">${escapeHtml(intro)}</p>
    <table style="border-collapse:collapse;font-size:0.95rem;margin:12px 0">${body}</table>
    <p style="color:#777;font-size:0.85rem;line-height:1.5">${escapeHtml(footer)}</p>
  </div>`;
}

async function sendEmail(to, subject, html) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.log(`[Email not sent, Gmail not set up] to ${to}: ${subject}`);
    return false;
  }
  try {
    await transporter.sendMail({ from: `"${HOTEL_NAME}" <${GMAIL_USER}>`, to, subject, html });
    return true;
  } catch (err) {
    console.error("Email failed:", err.message);
    return false;
  }
}

function reservationRows(r, roomNumber) {
  return [
    ["Booking reference", r.code],
    ["Guest", r.guestName],
    ["Room type", r.roomType],
    ["Room number", roomNumber || "Assigned once confirmed"],
    ["Check-in", r.checkIn],
    ["Check-out", r.checkOut],
    ["Guests", r.guests],
    ["Payment", `${r.paymentMethod}${r.paymentReference ? " (ref " + r.paymentReference + ")" : ""}`],
    ...(Number(r.discountAmount) > 0 ? [[`Discount (${r.voucherCode})`, "-" + peso(r.discountAmount)]] : []),
    ["Total", peso(r.totalAmount)],
    ["Special requests", r.notes || "None"],
  ];
}

const app = express();
app.use(cors());
app.use(express.json());

const PAYMENTS = ["GCash", "Cash",];
const STATUSES = ["Pending", "Confirmed", "Cancelled"];
const PAYMENT_STATUSES = ["Unpaid", "Paid"];
const ORDER_STATUSES = ["Pending", "Preparing", "Served", "Cancelled"];

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ message: "Server error. Please try again." });
  });

const RESERVATION_SELECT = `
  SELECT r.id, r.reservation_code AS code, r.guest_name AS guestName, r.email, r.phone,
         t.name AS roomType, r.check_in AS checkIn, r.check_out AS checkOut,
         r.guests, r.nights, r.total_amount AS totalAmount,
         r.payment_method AS paymentMethod, r.payment_reference AS paymentReference,
         r.payment_status AS paymentStatus, r.status, r.notes,
         r.room_number AS roomNumber, r.voucher_code AS voucherCode,
         r.discount_amount AS discountAmount, r.created_at AS createdAt
  FROM reservations r JOIN room_types t ON t.id = r.room_type_id`;

async function findReservation(id) {
  const [[row]] = await pool.query(`${RESERVATION_SELECT} WHERE r.id = ?`, [id]);
  return row || null;
}

function computeDiscount(voucher, base) {
  const value = Number(voucher.discount_value);
  const raw = voucher.discount_type === "fixed" ? value : (base * value) / 100;
  return Math.min(base, Math.round(raw * 100) / 100);
}

async function lookupVoucher(conn, code) {
  if (!code) return null;
  const [[voucher]] = await conn.query(
    `SELECT * FROM vouchers
     WHERE code = ? AND is_active = 1 AND (valid_until IS NULL OR valid_until >= CURDATE())`,
    [String(code).trim().toUpperCase()]
  );
  return voucher || null;
}

async function roomNumberTaken(roomNumber, checkIn, checkOut, excludeId) {
  const [[{ taken }]] = await pool.query(
    `SELECT COUNT(*) AS taken FROM reservations
     WHERE room_number = ? AND status <> 'Cancelled' AND id <> ?
       AND check_in < ? AND check_out > ?`,
    [roomNumber, excludeId, checkOut, checkIn]
  );
  return taken > 0;
}

app.get("/api/rooms", wrap(async (req, res) => {
  const where = req.query.all === "1" ? "" : "WHERE is_active = 1";
  const [rows] = await pool.query(
    `SELECT id, slug, name, category, price, capacity, total_units, is_active
     FROM room_types ${where} ORDER BY price`
  );
  res.json(rows);
}));

app.put("/api/rooms/:id", wrap(async (req, res) => {
  const { name, category, price, capacity, totalUnits, isActive } = req.body;
  if (!name || !category) return res.status(400).json({ message: "Name and category are required." });
  if (!(Number(price) >= 0) || !(Number(capacity) >= 1) || !(Number(totalUnits) >= 0))
    return res.status(400).json({ message: "Price, capacity and total rooms must be valid numbers." });
  const [r] = await pool.query(
    `UPDATE room_types SET name = ?, category = ?, price = ?, capacity = ?, total_units = ?, is_active = ?
     WHERE id = ?`,
    [name, category, Number(price), Number(capacity), Number(totalUnits), isActive === false ? 0 : 1, req.params.id]
  );
  if (!r.affectedRows) return res.status(404).json({ message: "Room type not found." });
  res.json({ message: "Room updated." });
}));

const KEY_STATUSES = ["Available", "Assigned", "Lost", "Damaged"];

function parseKeyRecord(body) {
  const keyCode = String(body.keyCode || "").trim();
  const keyType = String(body.keyType || "").trim();
  const roomNumber = String(body.roomNumber || "").trim();
  const guestName = String(body.guestName || "").trim();
  const reservationCode = String(body.reservationCode || "").trim();
  const status = String(body.status || "Available");
  const issuedAt = body.issuedAt || (status === "Assigned" ? new Date().toISOString().slice(0, 10) : null);
  const returnedAt = body.returnedAt || null;
  const notes = String(body.notes || "").trim();
  const validDate = (date) => {
    if (!date) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
  };

  if (!keyCode || keyCode.length > 60)
    return { error: "Key ID is required and must be 60 characters or fewer." };
  if (!keyType || keyType.length > 40)
    return { error: "Key type is required and must be 40 characters or fewer." };
  if (!KEY_STATUSES.includes(status))
    return { error: "Choose a valid key status." };
  if (roomNumber.length > 20 || guestName.length > 120 || reservationCode.length > 50 || notes.length > 500)
    return { error: "Room, guest, reservation or notes value is too long." };
  if (status === "Assigned" && (!roomNumber || !guestName))
    return { error: "An assigned key needs a room number and guest name." };
  if (![issuedAt, returnedAt].every(validDate))
    return { error: "Issue and return dates must be valid dates." };
  if (issuedAt && returnedAt && returnedAt < issuedAt)
    return { error: "Return date cannot be before the issue date." };

  return {
    value: {
      keyCode,
      keyType,
      roomNumber: roomNumber || null,
      guestName: guestName || null,
      reservationCode: reservationCode || null,
      status,
      issuedAt,
      returnedAt,
      notes: notes || null,
    },
  };
}

app.get("/api/keys", wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, key_code AS keyCode, key_type AS keyType, room_number AS roomNumber,
            guest_name AS guestName, reservation_code AS reservationCode, status,
            issued_at AS issuedAt, returned_at AS returnedAt, notes
     FROM room_keys ORDER BY updated_at DESC, id DESC`
  );
  res.json(rows);
}));

app.post("/api/keys", wrap(async (req, res) => {
  const parsed = parseKeyRecord(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  const key = parsed.value;
  try {
    const [result] = await pool.query(
      `INSERT INTO room_keys
        (key_code, key_type, room_number, guest_name, reservation_code, status, issued_at, returned_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [key.keyCode, key.keyType, key.roomNumber, key.guestName, key.reservationCode,
        key.status, key.issuedAt, key.returnedAt, key.notes]
    );
    res.status(201).json({ id: result.insertId, message: "Key record created." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "A key with this ID already exists." });
    throw err;
  }
}));

app.put("/api/keys/:id", wrap(async (req, res) => {
  const parsed = parseKeyRecord(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  const key = parsed.value;
  try {
    const [result] = await pool.query(
      `UPDATE room_keys
       SET key_code = ?, key_type = ?, room_number = ?, guest_name = ?, reservation_code = ?,
           status = ?, issued_at = ?, returned_at = ?, notes = ?
       WHERE id = ?`,
      [key.keyCode, key.keyType, key.roomNumber, key.guestName, key.reservationCode,
        key.status, key.issuedAt, key.returnedAt, key.notes, req.params.id]
    );
    if (!result.affectedRows) {
      const [[existing]] = await pool.query("SELECT id FROM room_keys WHERE id = ?", [req.params.id]);
      if (!existing) return res.status(404).json({ message: "Key record not found." });
    }
    res.json({ message: "Key record updated." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "A key with this ID already exists." });
    throw err;
  }
}));

app.delete("/api/keys/:id", wrap(async (req, res) => {
  const [result] = await pool.query("DELETE FROM room_keys WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Key record not found." });
  res.json({ message: "Key record deleted." });
}));

app.get("/api/vouchers", wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, code, discount_type AS discountType, discount_value AS discountValue,
            valid_until AS validUntil, is_active AS isActive
     FROM vouchers ORDER BY created_at DESC`
  );
  res.json(rows);
}));

app.get("/api/vouchers/check", wrap(async (req, res) => {
  const voucher = await lookupVoucher(pool, req.query.code);
  if (!voucher) return res.status(404).json({ message: "This discount code is not valid." });
  const base = Number(req.query.amount) || 0;
  res.json({
    code: voucher.code,
    discountType: voucher.discount_type,
    discountValue: Number(voucher.discount_value),
    discountAmount: computeDiscount(voucher, base),
  });
}));

app.post("/api/vouchers", wrap(async (req, res) => {
  const { code, discountType = "percent", discountValue, validUntil = null } = req.body;
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(cleanCode))
    return res.status(400).json({ message: "Code must be 3 to 40 letters or numbers." });
  if (!["percent", "fixed"].includes(discountType))
    return res.status(400).json({ message: "Invalid discount type." });
  const value = Number(discountValue);
  if (!(value > 0) || (discountType === "percent" && value > 100))
    return res.status(400).json({ message: "Invalid discount value." });
  try {
    await pool.query(
      "INSERT INTO vouchers (code, discount_type, discount_value, valid_until) VALUES (?,?,?,?)",
      [cleanCode, discountType, value, validUntil || null]
    );
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "This code already exists." });
    throw err;
  }
  res.status(201).json({ message: "Voucher created." });
}));

app.patch("/api/vouchers/:id", wrap(async (req, res) => {
  const [r] = await pool.query("UPDATE vouchers SET is_active = ? WHERE id = ?", [
    req.body.isActive ? 1 : 0,
    req.params.id,
  ]);
  if (!r.affectedRows) return res.status(404).json({ message: "Voucher not found." });
  res.json({ message: "Voucher updated." });
}));

app.delete("/api/vouchers/:id", wrap(async (req, res) => {
  const [r] = await pool.query("DELETE FROM vouchers WHERE id = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Voucher not found." });
  res.json({ message: "Voucher deleted." });
}));

app.get("/api/reservations", wrap(async (req, res) => {
  const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
  const [rows] = email
    ? await pool.query(`${RESERVATION_SELECT} WHERE LOWER(r.email) = ? ORDER BY r.created_at DESC`, [email])
    : await pool.query(`${RESERVATION_SELECT} ORDER BY r.created_at DESC`);
  res.json(rows);
}));

app.post("/api/reservations", wrap(async (req, res) => {
  const { guestName, email, phone, roomType, checkIn, checkOut,
          guests = 1, paymentMethod = "GCash", paymentReference = null,
          voucherCode = null, notes = null } = req.body;

  if (!guestName || !email || !phone || !roomType || !checkIn || !checkOut)
    return res.status(400).json({ message: "Missing required fields." });
  if (!PAYMENTS.includes(paymentMethod))
    return res.status(400).json({ message: "Invalid payment method." });
  if (paymentMethod === "GCash" && String(paymentReference || "").trim().length < 6)
    return res.status(400).json({ message: "Enter the GCash reference number from your payment." });

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (!Number.isFinite(nights) || nights < 1)
    return res.status(400).json({ message: "Check-out must be after check-in." });

  const conn = await pool.getConnection();
  let reservationId;
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

    const base = nights * Number(room.price);
    let discount = 0;
    let appliedCode = null;
    if (voucherCode) {
      const voucher = await lookupVoucher(conn, voucherCode);
      if (!voucher) { await conn.rollback(); return res.status(400).json({ message: "This discount code is not valid." }); }
      discount = computeDiscount(voucher, base);
      appliedCode = voucher.code;
    }
    const total = base - discount;
    const code = "RES-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);

    const [result] = await conn.query(
      `INSERT INTO reservations
       (reservation_code, room_type_id, guest_name, email, phone, check_in, check_out,
        guests, nights, total_amount, payment_method, payment_reference, voucher_code,
        discount_amount, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'Pending', ?)`,
      [code, room.id, guestName, email, phone, checkIn, checkOut,
       guests, nights, total, paymentMethod,
       paymentMethod === "GCash" ? String(paymentReference).trim() : null,
       appliedCode, discount, notes]
    );
    reservationId = result.insertId;
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const reservation = await findReservation(reservationId);
  sendEmail(
    reservation.email,
    `Booking received: ${reservation.code}`,
    emailLayout(
      "We received your booking",
      "Thank you for booking with us. The hotel will review it and email you again once it is confirmed.",
      reservationRows(reservation, null),
      "Keep this email as your receipt. You can also see your booking status under My Bookings on our website."
    )
  );
  res.status(201).json({ id: reservation.id, code: reservation.code, reservation });
}));

app.put("/api/reservations/:id", wrap(async (req, res) => {
  const { guestName, email, phone, roomType, checkIn, checkOut, totalAmount, status, roomNumber } = req.body;
  if (!guestName || !email || !phone || !roomType || !checkIn || !checkOut)
    return res.status(400).json({ message: "Missing required fields." });
  if (status && !STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (!Number.isFinite(nights) || nights < 1)
    return res.status(400).json({ message: "Check-out must be after check-in." });

  const [[room]] = await pool.query("SELECT id FROM room_types WHERE name = ?", [roomType]);
  if (!room) return res.status(400).json({ message: "Unknown room type." });

  const cleanRoomNumber = roomNumber ? String(roomNumber).trim() : null;
  if (cleanRoomNumber && (await roomNumberTaken(cleanRoomNumber, checkIn, checkOut, req.params.id)))
    return res.status(409).json({ message: `Room ${cleanRoomNumber} is already assigned for those dates.` });

  const [r] = await pool.query(
    `UPDATE reservations SET guest_name = ?, email = ?, phone = ?, room_type_id = ?, check_in = ?,
            check_out = ?, nights = ?, total_amount = ?, status = ?, room_number = ?
     WHERE id = ?`,
    [guestName, email, phone, room.id, checkIn, checkOut, nights, Number(totalAmount) || 0,
     status || "Pending", cleanRoomNumber, req.params.id]
  );
  if (!r.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Reservation updated." });
}));

app.patch("/api/reservations/:id/status", wrap(async (req, res) => {
  const { status, roomNumber } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });

  const current = await findReservation(req.params.id);
  if (!current) return res.status(404).json({ message: "Reservation not found." });

  let finalRoomNumber = roomNumber ? String(roomNumber).trim() : current.roomNumber;
  if (status === "Confirmed") {
    if (!finalRoomNumber) return res.status(400).json({ message: "Assign a room number before confirming." });
    if (await roomNumberTaken(finalRoomNumber, current.checkIn, current.checkOut, current.id))
      return res.status(409).json({ message: `Room ${finalRoomNumber} is already assigned for those dates.` });
  }
  if (status === "Cancelled") finalRoomNumber = current.roomNumber;

  await pool.query("UPDATE reservations SET status = ?, room_number = ? WHERE id = ?", [
    status,
    finalRoomNumber || null,
    current.id,
  ]);

  if (status !== current.status) {
    const updated = { ...current, status };
    if (status === "Confirmed") {
      sendEmail(
        current.email,
        `Booking confirmed: ${current.code}`,
        emailLayout(
          "Your booking is confirmed",
          `Your room is ${finalRoomNumber}. We look forward to welcoming you.`,
          reservationRows(updated, finalRoomNumber),
          "Please show this email or your booking reference at check-in."
        )
      );
    } else if (status === "Cancelled") {
      sendEmail(
        current.email,
        `Booking cancelled: ${current.code}`,
        emailLayout(
          "Your booking was cancelled",
          "If this is a mistake, please contact the hotel.",
          reservationRows(updated, current.roomNumber),
          ""
        )
      );
    }
  }
  res.json({ message: "Status updated." });
}));

app.patch("/api/reservations/:id/payment", wrap(async (req, res) => {
  const { paymentStatus } = req.body;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return res.status(400).json({ message: "Invalid payment status." });
  const [r] = await pool.query("UPDATE reservations SET payment_status = ? WHERE id = ?", [paymentStatus, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Payment updated." });
}));

app.delete("/api/reservations/:id", wrap(async (req, res) => {
  const [r] = await pool.query("DELETE FROM reservations WHERE id = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Reservation deleted." });
}));

const ORDER_SELECT = `
  SELECT id, order_code AS code, guest_name AS guestName, email, phone, room_number AS roomNumber,
         items, total_amount AS totalAmount, notes, status, created_at AS createdAt
  FROM food_orders`;

const parseOrder = (row) => {
  let items = [];
  try { items = JSON.parse(row.items); } catch (e) { items = []; }
  return { ...row, items };
};

app.get("/api/orders", wrap(async (req, res) => {
  const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
  const [rows] = email
    ? await pool.query(`${ORDER_SELECT} WHERE LOWER(email) = ? ORDER BY created_at DESC`, [email])
    : await pool.query(`${ORDER_SELECT} ORDER BY created_at DESC`);
  res.json(rows.map(parseOrder));
}));

app.post("/api/orders", wrap(async (req, res) => {
  const { guestName, email, phone, roomNumber = null, items, notes = null } = req.body;
  if (!guestName || !email || !phone) return res.status(400).json({ message: "Missing required fields." });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Your order is empty." });

  const cleanItems = items.map((i) => ({
    title: String(i.title || "").slice(0, 120),
    price: Number(i.price) || 0,
    qty: Math.max(1, Math.min(50, Number(i.qty) || 1)),
  }));
  if (cleanItems.some((i) => !i.title || i.price <= 0)) return res.status(400).json({ message: "Invalid order items." });

  const total = cleanItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const code = "ORD-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);

  const [result] = await pool.query(
    `INSERT INTO food_orders (order_code, guest_name, email, phone, room_number, items, total_amount, notes)
     VALUES (?,?,?,?,?,?,?,?)`,
    [code, guestName, email, phone, roomNumber || null, JSON.stringify(cleanItems), total, notes]
  );
  const [[row]] = await pool.query(`${ORDER_SELECT} WHERE id = ?`, [result.insertId]);
  const order = parseOrder(row);
  sendEmail(
    order.email,
    `Food order received: ${order.code}`,
    emailLayout(
      "We received your food order",
      "The kitchen will prepare it shortly. Pay when your order is served.",
      [
        ["Order reference", order.code],
        ["Deliver to", order.roomNumber || "Not specified"],
        ...order.items.map((i) => [`${i.qty} x ${i.title}`, peso(i.price * i.qty)]),
        ["Total", peso(order.totalAmount)],
        ["Special requests", order.notes || "None"],
      ],
      ""
    )
  );
  res.status(201).json(order);
}));

app.patch("/api/orders/:id/status", wrap(async (req, res) => {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });
  const [r] = await pool.query("UPDATE food_orders SET status = ? WHERE id = ?", [status, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Order not found." });
  res.json({ message: "Order updated." });
}));

process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e));
process.on("uncaughtException", (e) => console.error("Uncaught exception:", e));

pool.query("SELECT 1")
  .then(() => pool.query(`CREATE TABLE IF NOT EXISTS room_keys (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    key_code VARCHAR(60) NOT NULL,
    key_type VARCHAR(40) NOT NULL,
    room_number VARCHAR(20) NULL,
    guest_name VARCHAR(120) NULL,
    reservation_code VARCHAR(50) NULL,
    status ENUM('Available', 'Assigned', 'Lost', 'Damaged') NOT NULL DEFAULT 'Available',
    issued_at DATE NULL,
    returned_at DATE NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY room_keys_key_code_unique (key_code),
    KEY room_keys_status_index (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`))
  .then(() => app.listen(8080, () => console.log("Server running on port 8080, DB connected")))
  .catch((e) => { console.error("Cannot connect to MySQL. Is it started in XAMPP?\n", e.message); process.exit(1); });