// Authentication Logic
function auth() {
  return {
    isLogin: true,
    form: { username: "", password: "" },

    async submit() {
      try {
        const response = await fetch("http://202.70.133.37:3000/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.form),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        if (this.isLogin) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("username", this.form.username);
          window.location.href = "app.html";
        }
      } catch (error) {
        alert(error.message);
      }
    },
  };
}

async function fetchData(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message);
  }
  return response.json();
}

// Function to check if user is authenticated
function checkAuthentication() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "index.html";
  }
}

// Call checkAuthentication on app.html load
if (window.location.pathname === "app.html") {
  checkAuthentication();
}

function reminderApp() {
  return {
    token: localStorage.getItem("token"),
    username: localStorage.getItem("username"),
    // Data form reminder
    form: {
      phoneNumber: "",
      paymentDate: "",
      reminderTime: "",
      message: "",
      reminderId: "",
    },

    // Data reminders
    reminders: [],
    currentPage: 1,
    limit: 2,
    totalPages: 1,

    // Data kontak
    contacts: [],
    currentPageContacts: 1,
    limitContacts: 1,
    totalPagesContacts: 1,
    contactForm: {
      name: "",
      phoneNumber: "",
    },

    // Data kontak yang sudah dikirim
    sentReminders: [],
    currentPageSentReminders: 1,
    limitSentReminders: 1,
    totalPagesSentReminders: 1,

    // Template pesan
    messageTemplates: [
      {
        name: "Pembayaran Listrik",
        content:
          "Hai [Nama], jangan lupa bayar tagihan listrik Rp [Jumlah] sebelum [Tanggal].",
      },
      {
        name: "Pembayaran Sekolah",
        content:
          "Reminder pembayaran SPP sekolah untuk bulan [Bulan] sebesar Rp [Jumlah].",
      },
      {
        name: "Pembayaran Cicilan",
        content:
          "Pengingat pembayaran cicilan ke-[Angka] sebesar Rp [Jumlah] jatuh tempo [Tanggal].",
      },
      {
        name: "Tagihan Air",
        content:
          "Pengingat pembayaran tagihan air bulan [Bulan] sebesar Rp [Jumlah].",
      },
    ],

    // State dropdown
    isDropdownOpen: false,
    isContactDropdownOpen: false,

    showQrModal: false,
    qrStatus: "Memuat QR Code...",
    qrInterval: null,

    // Toast Function
    showToast(message, type = "success") {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.className = `toast ${type}`;
      toast.classList.add("show");

      setTimeout(() => {
        toast.classList.remove("show");
      }, 3000);
    },

    init() {
      if (!this.token) window.location.href = "index.html";
      this.checkWhatsAppStatus();
      this.fetchContacts();
      this.fetchReminders();
      this.fetchSentReminders();

      // Auto-refresh setiap 5 menit
      setInterval(() => {
        this.fetchReminders();
      }, 60000); // 5 menit dalam milidetik
    },

    // Di dalam function app() - script.js
    async checkWhatsAppStatus() {
      try {
        const status = await fetchData(
          "http://202.70.133.37:3000/whatsapp-status",
          {
            headers: { Authorization: `Bearer ${this.token}` },
          }
        );

        if (!status.authenticated) {
          this.showQrModal = true;
          if (status.qrCode) {
            this.generateQRCode(status.qrCode);
            this.qrStatus = "Scan QR Code untuk melanjutkan";
          } else {
            this.qrStatus = "Menghubungkan ke WhatsApp...";
          }

          // Mulai interval jika belum ada
          if (!this.qrInterval) {
            this.qrInterval = setInterval(async () => {
              const newStatus = await this.checkWhatsAppStatus();
              if (newStatus?.authenticated) {
                clearInterval(this.qrInterval);
                this.qrInterval = null;
                this.showQrModal = false;
                this.$nextTick(() => {
                  alert("WhatsApp terhubung! Silahkan lanjutkan.");
                });
              }
            }, 2000);
          }
        } else {
          // Jika sudah terautentikasi, pastikan modal ditutup
          this.showQrModal = false;
          clearInterval(this.qrInterval);
          this.qrInterval = null;
          return { authenticated: true };
        }
      } catch (error) {
        console.error("Error checking WhatsApp status:", error);
      }
    },

    generateQRCode(qrData) {
      const container = document.getElementById("qrCodeContainer");
      container.innerHTML = "";

      // Gunakan library QRCode.js
      new QRCode(container, {
        text: qrData,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });
    },

    /* ------------------------ METHOD UNTUK REMINDER ------------------------ */

    // Ambil data reminders
    async fetchReminders() {
      const result = await fetchData(
        `http://202.70.133.37:3000/get-reminders?page=${this.currentPage}&limit=${this.limit}`,
     
      );
      this.reminders = result.reminders;
      this.totalPages = result.totalPages;
    },

    // Submit form reminder
    async submitForm() {
      const url = this.form.reminderId
        ? `http://202.70.133.37:3000/update-reminder/${this.form.reminderId}`
        : "http://202.70.133.37:3000/schedule-reminder";

      const method = this.form.reminderId ? "PUT" : "POST";

      const data = {
        phoneNumber: this.form.phoneNumber,
        paymentDate: this.form.paymentDate,
        reminderTime: this.form.reminderTime,
        message: this.form.message,
      };

      const result = await fetchData(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(data),
      });

      // alert(result.message);
      this.showToast("Reminder berhasil disimpan!");
      this.fetchReminders();
      this.resetForm();
    },

    // Reset form reminder
    resetForm() {
      this.form = {
        phoneNumber: "",
        paymentDate: "",
        reminderTime: "",
        message: "",
        reminderId: "",
      };
    },

    // Batalkan update reminder
    cancelUpdate() {
      this.resetForm();
    },

    // Handle update reminder
    handleUpdate(reminder) {
      this.form.phoneNumber = reminder.phoneNumber;
      this.form.paymentDate = new Date(reminder.reminderDateTime)
        .toISOString()
        .split("T")[0];
      this.form.reminderTime = new Date(reminder.reminderDateTime)
        .toTimeString()
        .split(" ")[0]
        .substring(0, 5);
      this.form.message = reminder.message;
      this.form.reminderId = reminder.id;
    },

    // Hapus reminder
    async handleDelete(id) {
      const result = await fetchData(
        `http://202.70.133.37:3000/delete-reminder/${id}`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
          method: "DELETE",
        }
      );

      // alert(result.message);
      this.showToast("Reminder dihapus!", "danger");
      this.fetchReminders();
    },

    /* ------------------------ METHOD UNTUK KONTAK ------------------------ */

    // Ambil data kontak
    async fetchContacts() {
      const result = await fetchData(
        `http://202.70.133.37:3000/get-contacts`,
  
      );
      this.contacts = result.contacts;
      this.totalPagesContacts = result.totalPagesContacts;
    },

    // Submit form kontak
    async submitContactForm() {
      const result = await fetchData("http://202.70.133.37:3000/add-contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(this.contactForm),
      });

      // alert(result.message);
      this.showToast("Kontak berhasil ditambahkan!");
      this.fetchContacts();
      this.contactForm = { name: "", phoneNumber: "" };
    },

    // Hapus kontak
    async handleDeleteContact(id) {
      const result = await fetchData(
        `http://202.70.133.37:3000/delete-contact/${id}`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
          method: "DELETE",
        }
      );

      // alert(result.message);
      this.showToast("Kontak dihapus!", "danger");
      this.fetchContacts();
    },

    // Pilih kontak dari dropdown
    selectContact(contact) {
      this.form.phoneNumber = contact.phoneNumber;
      this.isContactDropdownOpen = false;
    },

    /* ------------------------ FITUR TAMBAHAN ------------------------ */

    // Pagination reminder
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.fetchReminders();
      }
    },

    get visiblePages() {
      const total = this.totalPages;
      const current = this.currentPage;
      const range = 5; // Number of visible pages

      const start = Math.max(1, current - Math.floor(range / 2));
      const end = Math.min(total, start + range - 1);

      const pages = [];
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    },

    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.fetchReminders();
      }
    },

    // Pagination kontak
    prevPageContacts() {
      if (this.currentPageContacts > 1) {
        this.currentPageContacts--;
        this.fetchContacts();
      }
    },

    get visiblePagesContacts() {
      const total = this.totalPagesContacts;
      const current = this.currentPageContacts;
      const range = 5; // Number of visible pages

      const start = Math.max(1, current - Math.floor(range / 2));
      const end = Math.min(total, start + range - 1);

      const pages = [];
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    },

    nextPageContacts() {
      if (this.currentPageContacts < this.totalPagesContacts) {
        this.currentPageContacts++;
        this.fetchContacts();
      }
    },

    // Pagination sent reminders
    prevPageSentReminders() {
      if (this.currentPageSentReminders > 1) {
        this.currentPageSentReminders--;
        this.fetchSentReminders();
      }
    },

    get visiblePagesSentReminders() {
      const total = this.totalPagesSentReminders;
      const current = this.currentPageSentReminders;
      const range = 5; // Number of visible pages

      const start = Math.max(1, current - Math.floor(range / 2));
      const end = Math.min(total, start + range - 1);

      const pages = [];
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    },

    nextPageSentReminders() {
      if (this.currentPageSentReminders < this.totalPagesSentReminders) {
        this.currentPageSentReminders++;
        this.fetchSentReminders();
      }
    },

    // Template pesan
    applyTemplate(template) {
      // Cari kontak berdasarkan nomor telepon yang dipilih
      const selectedContact = this.contacts.find(
        (contact) => contact.phoneNumber === this.form.phoneNumber
      );

      // Jika kontak ditemukan, ganti [Nama] dengan nama kontak
      if (selectedContact) {
        this.form.message = template.content
          .replace("[Nama]", selectedContact.name)
          .replace("[Jumlah]", "[Jumlah]") // Biarkan [Jumlah] sebagai placeholder
          .replace("[Tanggal]", this.form.paymentDate)
          .replace(
            "[Bulan]",
            new Date(this.form.paymentDate).toLocaleString("id-ID", {
              month: "long",
            })
          );
      } else {
        // Jika kontak tidak ditemukan, beri peringatan
        alert("Pilih kontak terlebih dahulu dari dropdown!");
      }
      this.isDropdownOpen = false;
    },

    // Toggle dropdown
    toggleDropdown() {
      this.isDropdownOpen = !this.isDropdownOpen;
    },
    toggleContactDropdown() {
      this.isContactDropdownOpen = !this.isContactDropdownOpen;
    },

    logout() {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      window.location.href = "index.html";
    },

    async fetchSentReminders() {
      try {
        const response = await fetch(
          `http://202.70.133.37:3000/get-sent-reminders?page=${this.currentPageSentReminders}&limit=${this.limitSentReminders}`,
    
        );
        const data = await response.json();
        this.sentReminders = data.sentReminders;
        this.totalPagesSentReminders = data.totalPagesSentReminders;
      } catch (error) {
        console.error("Failed to fetch sent reminders:", error);
      }
    },

    async rescheduleReminder(reminder) {
      try {
        const response = await fetch(
          "http://202.70.133.37:3000/reschedule-reminder",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              phoneNumber: reminder.phoneNumber,
              paymentDate: new Date(reminder.reminderDateTime)
                .toISOString()
                .split("T")[0],
              reminderTime: new Date(reminder.reminderDateTime)
                .toTimeString()
                .split(" ")[0]
                .slice(0, 5),
              message: reminder.message,
            }),
          }
        );
        const data = await response.json();
        if (response.ok) {
          this.fetchReminders();
          this.fetchSentReminders();
          this.showToast(data.message);
        } else {
          this.showToast(data.message, "danger");
        }
      } catch (error) {
        console.error("Failed to reschedule reminder:", error);
        this.showToast("Failed to reschedule reminder", "danger");
      }
    },
  };
}

// Toast Element
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }
}
