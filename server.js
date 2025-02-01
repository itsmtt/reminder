const express = require("express");
const cron = require("node-cron");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const Joi = require("joi");

const app = express();
const JWT_SECRET = "supersecretkey123!";

app.use(cors());
app.use(express.json()); // Menggunakan express.json() sebagai pengganti bodyParser

let users = [];
let reminders = new Map(); // Menggunakan Map untuk pengingat
let sentReminders = new Map(); // Menggunakan Map untuk pengingat terkirim
// Data untuk menyimpan daftar kontak
let contacts = new Map();

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Schemas untuk user login dan register
const userSchema = Joi.object({
  username: Joi.string().min(3).required(),
  password: Joi.string().min(6).required(),
});

// Schema validasi untuk kontak
const contactSchema = Joi.object({
  name: Joi.string().required(),
  phoneNumber: Joi.string().pattern(/^\d+$/).required(),
});

// Schema validasi menggunakan Joi
const reminderSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^\d+$/).required(),
  paymentDate: Joi.date().iso().required(),
  reminderTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required(),
  message: Joi.string().required(),
});

// Routes
app.post("/register", async (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { username, password } = value;
  if (users.some((u) => u.username === username)) {
    return res.status(400).json({ message: "Username already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ id: Date.now(), username, password: hashedPassword });
  res.status(201).json({ message: "User registered successfully" });
});

app.post("/login", async (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { username, password } = value;
  const user = users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, {
    expiresIn: "1h",
  });
  res.json({ token });
});

// Protected Routes
app.use(authenticateToken);

// Endpoint untuk menambahkan kontak
app.post("/add-contact", (req, res) => {
  const { error, value } = contactSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { name, phoneNumber } = value;
  const id = Date.now(); // ID unik menggunakan timestamp
  const contact = { id, name, phoneNumber };

  contacts.set(id, contact);
  res.json({ message: "Kontak berhasil ditambahkan!", contact });
});

// Endpoint untuk mendapatkan daftar kontak
app.get("/get-contacts", (req, res) => {
  const contactList = Array.from(contacts.values());
  res.json({ contacts: contactList });
});

// Endpoint untuk menghapus kontak berdasarkan ID
app.delete("/delete-contact/:id", (req, res) => {
  const id = parseInt(req.params.id);

  if (!contacts.delete(id)) {
    return res.status(404).json({ message: "Kontak tidak ditemukan!" });
  }

  res.json({ message: "Kontak berhasil dihapus!" });
});

let qrCodeData = null;
let isAuthenticated = false;

// Membuat instance klien WhatsApp
const whatsappClient = new Client({
  authStrategy: new LocalAuth(), // Menyimpan sesi secara lokal
});

// Menampilkan QR code untuk login
whatsappClient.on("qr", (qr) => {
  console.log("QR code untuk login:");
  qrcode.generate(qr, { small: true });
  qrCodeData = qr;
  isAuthenticated = false;
});

// Saat klien siap digunakan
whatsappClient.on("ready", () => {
  console.log("Bot WhatsApp siap digunakan dan terhubung ke akun WhatsApp.");
  isAuthenticated = true;
  qrCodeData = null;
});

// Endpoint untuk mendapatkan status WhatsApp
app.get("/whatsapp-status", authenticateToken, (req, res) => {
  res.json({
    authenticated: isAuthenticated,
    qrCode: qrCodeData,
  });
});

// Endpoint untuk menambahkan pengingat
app.post("/schedule-reminder", authenticateToken, (req, res) => {
  const { error, value } = reminderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { phoneNumber, paymentDate, reminderTime, message } = value;
  console.log(
    `Received: ${phoneNumber}, ${paymentDate}, ${reminderTime}, ${message}`
  );

  // Ensure the date and time are correctly formatted
  const date = new Date(paymentDate);
  const [year, month, day] = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ];
  const [hours, minutes] = reminderTime.split(":");
  const reminderDateTime = new Date(year, month - 1, day, hours, minutes);
  console.log(`Parsed Date: ${reminderDateTime}`);

  // Ensure the date is correctly parsed
  if (isNaN(reminderDateTime.getTime())) {
    return res.status(400).json({ message: "Invalid date or time format" });
  }

  // ID unik menggunakan tim
  // 
  // 
  // 
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  estamp
  const reminder = {
    id: Date.now(),
    phoneNumber,
    reminderDateTime,
    message,
  };

  // Tambahkan pengingat ke Map
  reminders.set(reminder.id, reminder);

  res.json({ message: "Pengingat pembayaran berhasil dijadwalkan!", reminder });
});

// Endpoint untuk mendapatkan daftar pengingat dengan pagination
app.get("/get-reminders", authenticateToken, (req, res) => {
  const { page = 1, limit = 5 } = req.query;
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  const paginatedReminders = Array.from(reminders.values()).slice(
    (pageNumber - 1) * limitNumber,
    pageNumber * limitNumber
  );

  res.json({
    page: pageNumber,
    totalPages: Math.ceil(reminders.size / limitNumber),
    reminders: paginatedReminders,
  });
});

// Endpoint untuk memperbarui pengingat berdasarkan ID
app.put("/update-reminder/:id", authenticateToken, (req, res) => {
  const { error, value } = reminderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { phoneNumber, paymentDate, reminderTime, message } = value;
  console.log(
    `Received: ${phoneNumber}, ${paymentDate}, ${reminderTime}, ${message}`
  );

  // Ensure the date and time are correctly formatted
  const date = new Date(paymentDate);
  const [year, month, day] = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ];
  const [hours, minutes] = reminderTime.split(":");
  const reminderDateTime = new Date(year, month - 1, day, hours, minutes);
  console.log(`Parsed Date: ${reminderDateTime}`);

  // Ensure the date is correctly parsed
  if (isNaN(reminderDateTime.getTime())) {
    return res.status(400).json({ message: "Invalid date or time format" });
  }

  const id = parseInt(req.params.id);

  if (!reminders.has(id)) {
    return res.status(404).json({ message: "Pengingat tidak ditemukan!" });
  }

  // Perbarui pengingat
  const updatedReminder = { id, phoneNumber, reminderDateTime, message };
  reminders.set(id, updatedReminder);

  res.json({
    message: "Pengingat berhasil diperbarui!",
    reminder: updatedReminder,
  });
});

// Endpoint untuk menghapus pengingat berdasarkan ID
app.delete("/delete-reminder/:id", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);

  if (!reminders.delete(id)) {
    return res.status(404).json({ message: "Pengingat tidak ditemukan!" });
  }

  res.json({ message: "Pengingat berhasil dihapus!" });
});

// Fungsi untuk mengirim pesan ke WhatsApp
const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const chatId = `${phoneNumber}@c.us`;
    await whatsappClient.sendMessage(chatId, message);
    console.log(`Pesan berhasil dikirim ke ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error("Gagal mengirim pesan:", error);
    return false;
  }
};

// Fungsi untuk menjalankan cron job
cron.schedule("* * * * *", async () => {
  const now = new Date();

  for (const reminder of reminders.values()) {
    if (now >= reminder.reminderDateTime) {
      const success = await sendWhatsAppMessage(reminder.phoneNumber, reminder.message);
      if (success) {
        console.log(`Pengingat untuk ${reminder.phoneNumber} berhasil dikirim.`);
        sentReminders.set(reminder.id, reminder);
        reminders.delete(reminder.id);
      } else {
        console.error(`Gagal mengirim pengingat ke ${reminder.phoneNumber}`);
      }
    }
  }
});

// Handle 404 untuk endpoint yang tidak ditemukan
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
});

// Menjalankan server
app.listen(3000, () => {
  console.log("Server berjalan di port 3000");
});

// Menginisialisasi klien WhatsApp
whatsappClient.initialize();