# ☕ Coffey

<p align="center">
  <img src="https://raw.githubusercontent.com/Bruhrbx/Coffey/refs/heads/main/asset/%E2%98%95%20Coffey.png" alt="Size">
</p>


<p align="center">
  <img src="https://img.shields.io/badge/Size-1.72%20MB-blue?style=for-the-badge&logo=webassembly&logoColor=white" alt="Size">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Status-Beta%20/%20Unstable-orange?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Platform-Chromium%20%7C%20Firefox-lightgrey?style=for-the-badge" alt="Platform">
</p>


## 💖 Show Out Untuk Kontributor
<a href="https://github.com/Bruhrbx/Coffey/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Bruhrbx/Coffey" />
</a>

---
# ☕ Apa Itu Coffey?

**Coffey** adalah ekstensi pemblokir iklan (*ad-blocker*) masa depan yang dirancang sebagai alternatif uBlock yang ultra-cepat, super kecil, dan sepenuhnya *open-source*. Dengan ukuran bundle hanya **1.72 MB**, Coffey berfokus pada efisiensi eksekusi jaringan tanpa membebani memori (RAM) perangkat Anda.

Berbeda dengan pemblokir iklan konvensional yang memproses filter list berat di latar belakang menggunakan skrip JavaScript yang kompleks, Coffey memanfaatkan arsitektur modern untuk menyaring request langsung pada level inti browser.

---

## ✨ Fitur Unggulan

* 🚀 **Performa Ultra Cepat:** Pemrosesan aturan pemblokiran secepat kilat dengan overhead CPU yang hampir nol.
* 📦 **Ukuran Sangat Kecil (Tiny Size):** Hanya **1.72 MB**, menjadikannya salah satu pemblokir iklan paling ringan di dunia.
* 🔒 **Fokus Privasi & Open-Source:** Tidak ada pelacakan data, tidak ada analitik tersembunyi, dan kode sumber 100% transparan untuk komunitas.
* ⚡ **Efisiensi Energi & RAM:** Sangat cocok untuk perangkat berspesifikasi rendah (*low-end*) maupun laptop yang ingin menghemat baterai.

---

## ⚠️ Status Proyek

> [!WARNING]
> **Coffey saat ini masih dalam fase Unstable / Beta.**
> Ekstensi ini sudah dapat berfungsi dengan baik untuk pemblokiran iklan harian, namun Anda mungkin akan menemui beberapa *bug* kosmetik atau kerusakan minor pada tata letak situs web tertentu (*page breakage*). Kami sangat mengapresiasi umpan balik (*feedback*) dan pelaporan masalah melalui tab Issues.

---

## 🛠️ Cara Instalasi (Panduan Pengembang / Manual)

Karena proyek ini masih dalam tahap pengembangan aktif dan belum didistribusikan secara resmi di Chrome Web Store atau Firefox Add-ons, Anda dapat memasangnya secara manual menggunakan langkah-langkah di bawah ini:

### 🌐 Untuk Browser Berbasis Chromium (Google Chrome, Brave, Edge, Opera, Vivaldi)
1. Unduh repositori ini dengan mengklik tombol **Code** lalu pilih **Download ZIP** (atau kloning menggunakan git: `git clone https://github.com/Bruhrbx/Coffey.git`).
2. Ekstrak file ZIP yang telah diunduh ke dalam sebuah folder khusus di komputer Anda.
3. Buka browser Anda dan masuk ke halaman ekstensi melalui URL: `chrome://extensions/`.
4. Aktifkan **Developer mode** (Mode pengembang) di sudut kanan atas halaman.
5. Klik tombol **Load unpacked** (Muat ekstensi yang belum dikemas) di sudut kiri atas.
6. Pilih folder hasil ekstrak repositori Coffey (pastikan memilih folder yang berisi file `manifest.json`).
7. Selesai! Coffey kini aktif di browser Anda.

### 🦊 Untuk Mozilla Firefox
1. Unduh dan ekstrak repositori Coffey seperti langkah di atas.
2. Buka Firefox dan ketik `about:debugging` pada bilah alamat, lalu tekan Enter.
3. Klik menu **This Firefox** di sisi kiri.
4. Klik tombol **Load Temporary Add-on...** (Muat Pengaya Sementara...).
5. Pilih file `manifest.json` dari folder Coffey yang sudah diekstrak.
6. *Catatan: Pada Firefox biasa, ekstensi sementara ini akan hilang setelah browser ditutup. Untuk pemasangan permanen, gunakan Firefox Developer Edition atau Nightly.*

---

## ⚙️ Detail Teknis & Aturan Filter (Filter Lists)

Coffey dibangun menggunakan standar arsitektur **Manifest V3** untuk memastikan kepatuhan penuh terhadap kebijakan keamanan browser modern dan mempertahankan efisiensi tinggi.

Secara bawaan, Coffey mengintegrasikan versi kompresi tinggi dari aturan-aturan esensial berikut:
* 🛡️ **EasyList Core:** Memblokir sebagian besar iklan jaringan, spanduk, dan pop-up global.
* 👤 **EasyPrivacy Minimal:** Mencegah skrip pelacak pihak ketiga (*third-party trackers*) mengumpulkan data penjelajahan Anda.
* ❌ **Custom Ad-Block Rules:** Aturan internal Coffey yang dioptimalkan khusus untuk memangkas elemen iklan tanpa memicu deteksi anti-adblock.

---

## 🤝 Kontribusi & Kolaborasi

Kami sangat menyambut kontribusi dari komunitas! Karena Coffey masih dalam tahap awal, bantuan Anda dalam hal-hal berikut akan sangat berharga:
* Melaporkan iklan yang lolos atau situs web yang rusak (*broken layout*).
* Mengoptimalkan algoritma pemrosesan string pada aturan filter.
* Memperbaiki tata letak UI (User Interface) pada menu popup ekstensi.

### Cara Berkontribusi:
1. Lakukan *Fork* pada repositori ini.
2. Buat *Branch* fitur baru Anda (`git checkout -b fitur/FiturKerenSaya`).
3. Lakukan *Commit* perubahan Anda (`git commit -m 'Menambahkan fitur keren'`).
4. *Push* ke *Branch* tersebut (`git push origin fitur/FiturKerenSaya`).
5. Buka sebuah *Pull Request*.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License**. Anda bebas menggunakan, memodifikasi, dan mendistribusikan ulang kode ini selama menyertakan atribusi hak cipta asli. Sila pelajari file [LICENSE](LICENSE) untuk informasi hukum lebih lanjut.

---

<p align="center">
  Dibuat dengan ☕ oleh <a href="https://github.com/Bruhrbx">Bruhrbx</a> dan kontributor open-source.
</p>
