const express = require("express");
const cron = require("node-cron");
const cors = require("cors");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const Joi = require("joi");

const app = express();

app.use(cors());
app.use(express.json()); // Menggunakan express.json() sebagai pengganti bodyParser

let reminders = new Map(); // Menggunakan Map untuk pengingat
let sentReminders = new Map(); // Menggunakan Map untuk pengingat terkirim
// Data untuk menyimpan daftar kontak
let contacts = new Map();

// Schema validasi untuk kontak
const contactSchema = Joi.object({
  name: Joi.string().required(),
  phoneNumber: Joi.string().pattern(/^\d+$/).required(),
});

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
// Membuat instance klien WhatsApp
const whatsappClient = new Client({
  authStrategy: new LocalAuth(), // Menyimpan sesi secara lokal
});

// Menampilkan QR code untuk login
whatsappClient.on("qr", (qr) => {
  console.log("QR code untuk login:");
  qrcode.generate(qr, { small: true });
});

// Saat klien siap digunakan
whatsappClient.on("ready", () => {
  console.log("Bot WhatsApp siap digunakan dan terhubung ke akun WhatsApp.");
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

// Endpoint untuk menambahkan pengingat
app.post("/schedule-reminder", (req, res) => {
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

  // ID unik menggunakan timestamp
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
app.get("/get-reminders", (req, res) => {
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
app.put("/update-reminder/:id", (req, res) => {
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
app.delete("/delete-reminder/:id", (req, res) => {
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
  } catch (error) {
    console.error("Gagal mengirim pesan:", error);
    throw error;
  }
};

// Fungsi untuk menjalankan cron job
cron.schedule("* * * * *", async () => {
  const now = new Date();

  for (const reminder of reminders.values()) {
    if (now >= reminder.reminderDateTime) {
      try {
        await sendWhatsAppMessage(reminder.phoneNumber, reminder.message);
        console.log(
          `Pengingat untuk ${reminder.phoneNumber} berhasil dikirim.`
        );

        // Pindahkan pengingat ke sentReminders
        sentReminders.set(reminder.id, reminder);
        reminders.delete(reminder.id); // Hapus dari daftar pengingat aktif
      } catch (error) {
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
