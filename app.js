// ================== APLIKASI IPL WARGA - app.js (versi fetch) ==================
// GANTI dengan URL Web App Apps Script Anda (yang berakhiran /exec)
var API_URL = "https://script.google.com/macros/s/AKfycbzEHUQ3sluP1X4I9eE6XBblGYBXsiwGRz_dDSX7Z0X9xRFughP9LD3Qyf_r_ynaNWNq/exec";

// Nomor WhatsApp bendahara (format bebas: 0812... atau 62812...) - WAJIB DIGANTI
var WA_BENDAHARA = "085890056992";

var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
             "Agustus", "September", "Oktober", "November", "Desember"];

var KOMPONEN = [
  { key: "keamanan", label: "Keamanan",      cb: "cb-keamanan" },
  { key: "sampah",   label: "Sampah",        cb: "cb-sampah" },
  { key: "dakem",    label: "Dana Kematian", cb: "cb-dakem" },
  { key: "kas_rw",   label: "Kas RW016",     cb: "cb-rw" },
  { key: "kas_rt",   label: "Kas RT",        cb: "cb-rt" },
  { key: "thr",      label: "Iuran THR",     cb: "cb-thr" }
];

var namaWargaAktif = "";
var rumahAktif = "";
var pinAktif = "";
var hpAktif = "";
var adaTokenAktif = false;
var tokenInfo = null;
var hasilResetAktif = null;
var kuitansiAktif = null;
var rekapAktif = null;
var riwayatData = [];
var pinPengurusAktif = "";

// ---------- Pemanggil API (fetch) ----------
// text/plain sengaja dipakai agar tidak kena preflight CORS Apps Script
function callApi(action, payload) {
  var body = Object.assign({ action: action }, payload || {});
  return fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  })
    .then(function (res) {
      if (!res.ok) throw new Error("Server membalas status " + res.status);
      return res.json();
    })
    .then(function (json) {
      if (json.error) throw new Error(json.error);
      return json.result;
    });
}

// ---------- Utilitas ----------
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function rp(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function isiPilihanBulan(id, pilihIndex) {
  var el = document.getElementById(id);
  el.innerHTML = BULAN.map(function (b, i) {
    return '<option value="' + b + '"' + (i === pilihIndex ? " selected" : "") + ">" + b + "</option>";
  }).join("");
}

function isiPilihanTahun(id) {
  var el = document.getElementById(id);
  var now = new Date().getFullYear();
  var html = "";
  for (var t = now + 1; t >= now - 3; t--) {
    html += '<option value="' + t + '"' + (t === now ? " selected" : "") + ">" + t + "</option>";
  }
  el.innerHTML = html;
}

window.addEventListener("DOMContentLoaded", function () {
  var bulanIni = new Date().getMonth();
  isiPilihanBulan("form-bulan", bulanIni);
  isiPilihanBulan("rekap-bulan", bulanIni);
  isiPilihanTahun("form-tahun");
  isiPilihanTahun("riwayat-tahun");
  isiPilihanTahun("rekap-tahun");

  if (API_URL.indexOf("GANTI_DENGAN") !== -1) {
    tampilkanError("⚠️ API_URL di app.js belum diisi dengan URL Web App Apps Script (/exec).");
  }
});

function tampilkanError(pesan) {
  var el = document.getElementById("banner-error");
  el.innerText = pesan;
  el.classList.remove("hidden");
}

function sembunyikanError() {
  document.getElementById("banner-error").classList.add("hidden");
}

function togglePin(id, btn) {
  var input = document.getElementById(id);
  if (input.type === "password") {
    input.type = "text";
    btn.innerText = "🙈";
  } else {
    input.type = "password";
    btn.innerText = "👁";
  }
}

var HALAMAN = ["login", "signup", "lupapin", "dashboard", "token", "kuitansi", "admin-login", "admin"];

function pindahKe(halaman) {
  sembunyikanError();
  HALAMAN.forEach(function (h) {
    document.getElementById("box-" + h).classList.add("hidden");
  });
  document.getElementById("box-" + halaman).classList.remove("hidden");
  window.scrollTo(0, 0);
}

// ---------- Input rumah: Blok + No Blok + No Rumah ----------
function sanitasiBlok(el) {
  el.value = el.value.toUpperCase().replace(/[^A-Z]/g, "");
}

function sanitasiAngka(el) {
  el.value = el.value.replace(/\D/g, "");
}

function kodeRumah(prefix) {
  var blok = document.getElementById(prefix + "-blok").value;
  var noBlok = document.getElementById(prefix + "-noblok").value;
  var noRumah = document.getElementById(prefix + "-norumah").value;
  if (!blok || !noBlok || !noRumah) return "";
  return blok + noBlok + "/" + noRumah;
}

function previewRumah(prefix) {
  document.getElementById(prefix + "-preview").innerText = kodeRumah(prefix) || "-";
}

function kosongkanRumah(prefix) {
  ["blok", "noblok", "norumah"].forEach(function (f) {
    document.getElementById(prefix + "-" + f).value = "";
  });
  previewRumah(prefix);
}

// ---------- Daftar ----------
function daftar() {
  var data = {
    nama: document.getElementById("reg-nama").value,
    rumah: kodeRumah("reg"),
    hp: document.getElementById("reg-hp").value,
    email: document.getElementById("reg-email").value,
    pin: document.getElementById("reg-pin").value
  };

  if (!data.nama || !data.rumah || !data.hp || !data.pin) {
    alert("Harap isi Nama, Blok, No Blok, No Rumah, No WhatsApp, dan PIN!");
    return;
  }

  var btn = document.getElementById("btn-daftar");
  btn.disabled = true;
  btn.innerText = "Menyimpan...";

  callApi("daftarAkun", { data: data })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        ["reg-nama", "reg-hp", "reg-email", "reg-pin"].forEach(function (id) {
          document.getElementById(id).value = "";
        });
        kosongkanRumah("reg");
        tampilToken({
          token: respon.token,
          judul: "✅ Pendaftaran Berhasil",
          info: "Akun " + data.nama + " (" + data.rumah + ") sudah terdaftar. Ini Token Pemulihan Anda:",
          hp: data.hp, nama: data.nama, kembali: "login"
        });
      } else {
        alert(respon.pesan || "Pendaftaran gagal.");
      }
    })
    .catch(function (err) { tampilkanError("Gagal daftar: " + err.message); })
    .finally(function () {
      btn.disabled = false;
      btn.innerText = "Daftar Akun";
    });
}

// ---------- Login ----------
function login() {
  var nama = document.getElementById("login-nama").value;
  var pin = document.getElementById("login-pin").value;

  if (!nama || !pin) {
    alert("Masukkan Nama dan PIN Anda!");
    return;
  }

  var btn = document.getElementById("btn-login");
  btn.disabled = true;
  btn.innerText = "Memeriksa...";

  callApi("prosesLogin", { nama: nama, pin: pin })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        namaWargaAktif = respon.nama;
        rumahAktif = respon.rumah;
        pinAktif = pin;
        hpAktif = respon.hp || "";
        adaTokenAktif = !!respon.adaToken;
        document.getElementById("user-display").innerText = respon.nama;
        document.getElementById("rumah-display").innerText = respon.rumah;
        gantiTab("bayar");
        perbaruiNotifToken();
        pindahKe("dashboard");
        muatRiwayat();
      } else if (respon.status === "Error") {
        tampilkanError("Error: " + respon.pesan);
      } else {
        alert("Nama Pemilik atau PIN salah!");
      }
    })
    .catch(function (err) { tampilkanError("Gagal login: " + err.message); })
    .finally(function () {
      btn.disabled = false;
      btn.innerText = "Masuk";
    });
}

// ---------- Lupa PIN (pakai Token Pemulihan) ----------
function resetPinToken() {
  var nama = document.getElementById("lp-nama").value;
  var token = document.getElementById("lp-token").value;
  var pin1 = document.getElementById("lp-pin").value;
  var pin2 = document.getElementById("lp-pin2").value;

  if (!nama || !token || !pin1 || !pin2) {
    alert("Harap isi Nama, Token, dan PIN baru!");
    return;
  }
  if (!/^\d{4,12}$/.test(pin1)) {
    alert("PIN baru harus berupa angka, minimal 4 digit.");
    return;
  }
  if (pin1 !== pin2) {
    alert("Ulangi PIN baru tidak sama. Coba lagi.");
    return;
  }

  var btn = document.getElementById("btn-lupapin");
  btn.disabled = true;
  btn.innerText = "Memeriksa...";

  callApi("resetPin", { nama: nama, token: token, pinBaru: pin1 })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        ["lp-nama", "lp-token", "lp-pin", "lp-pin2"].forEach(function (id) {
          document.getElementById(id).value = "";
        });
        tampilToken({
          token: respon.token,
          judul: "✅ PIN Berhasil Diganti",
          info: "Silakan login dengan PIN baru. Token lama sudah hangus, simpan Token Pemulihan baru ini:",
          hp: respon.hp, nama: nama, kembali: "login"
        });
      } else {
        alert(respon.pesan || "Data tidak cocok.");
      }
    })
    .catch(function (err) { tampilkanError("Gagal membuat PIN baru: " + err.message); })
    .finally(function () {
      btn.disabled = false;
      btn.innerText = "Buat PIN Baru";
    });
}

function waMintaResetPengurus() {
  if (WA_BENDAHARA.indexOf("GANTI") !== -1) {
    alert("Nomor WhatsApp pengurus belum diatur di app.js.");
    return;
  }
  var nama = document.getElementById("lp-nama").value.trim();
  bukaWa(nomorWa(WA_BENDAHARA),
    "Assalamualaikum, saya lupa PIN dan token aplikasi IPL Warga, mohon dibantu reset.\n" +
    "Nama: " + (nama || "(isi nama)") + "\n" +
    "Rumah: (isi blok/nomor, contoh C6/13)");
}

// ---------- Halaman Token Pemulihan ----------
function tokenFmt(t) {
  t = String(t || "");
  return t.length === 8 ? t.substring(0, 4) + "-" + t.substring(4) : t;
}

function tampilToken(opsi) {
  tokenInfo = opsi;
  document.getElementById("token-judul").innerText = opsi.judul;
  document.getElementById("token-info").innerText = opsi.info || "";
  document.getElementById("token-tampil").innerText = tokenFmt(opsi.token);
  document.getElementById("token-sudah").checked = false;
  document.getElementById("btn-token-lanjut").disabled = true;
  pindahKe("token");
}

function cekTokenSudah() {
  document.getElementById("btn-token-lanjut").disabled = !document.getElementById("token-sudah").checked;
}

function salinToken() {
  if (!tokenInfo) return;
  var teks = tokenFmt(tokenInfo.token);
  function cadangan() {
    var ta = document.createElement("textarea");
    ta.value = teks;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); alert("Token disalin."); }
    catch (e) { alert("Gagal menyalin. Silakan catat token secara manual."); }
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(teks).then(function () { alert("Token disalin."); }, cadangan);
  } else {
    cadangan();
  }
}

function kirimTokenWaSaya() {
  if (!tokenInfo) return;
  if (!tokenInfo.hp) {
    alert("Nomor WhatsApp Anda tidak ditemukan di data pendaftaran. Silakan screenshot token ini.");
    return;
  }
  bukaWa(nomorWa(tokenInfo.hp),
    "*Token Pemulihan PIN - IPL Warga*\n" +
    "Nama: " + (tokenInfo.nama || "") + "\n" +
    "Token: " + tokenFmt(tokenInfo.token) + "\n\n" +
    "Simpan baik-baik. Token dipakai untuk membuat PIN baru jika lupa PIN.");
}

function selesaiToken() {
  var tujuan = tokenInfo && tokenInfo.kembali ? tokenInfo.kembali : "login";
  tokenInfo = null;
  document.getElementById("token-tampil").innerText = "----";
  pindahKe(tujuan);
}

// Warga yang sudah login: buat token pertama kali atau buat ulang
function perbaruiNotifToken() {
  document.getElementById("notif-token").classList.toggle("hidden", adaTokenAktif);
}

function buatTokenBaru() {
  if (adaTokenAktif && !confirm("Token lama akan hangus dan diganti token baru. Lanjutkan?")) return;

  callApi("buatToken", { nama: namaWargaAktif, pin: pinAktif })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        adaTokenAktif = true;
        perbaruiNotifToken();
        tampilToken({
          token: respon.token,
          judul: "🔑 Token Pemulihan Dibuat",
          info: "Token lama (jika ada) sudah tidak berlaku. Simpan token baru ini:",
          hp: respon.hp || hpAktif, nama: namaWargaAktif, kembali: "dashboard"
        });
      } else {
        alert(respon.pesan || "Gagal membuat token.");
      }
    })
    .catch(function (err) { tampilkanError("Gagal membuat token: " + err.message); });
}

// ---------- Tab dashboard ----------
function gantiTab(nama) {
  document.getElementById("panel-bayar").classList.toggle("hidden", nama !== "bayar");
  document.getElementById("panel-riwayat").classList.toggle("hidden", nama !== "riwayat");
  document.getElementById("tab-bayar").classList.toggle("active", nama === "bayar");
  document.getElementById("tab-riwayat").classList.toggle("active", nama === "riwayat");
  if (nama === "riwayat") muatRiwayat();
}

// ---------- Hitung total ----------
function hitungTotal() {
  var total = 0;
  document.querySelectorAll(".iuran-cb").forEach(function (cb) {
    if (cb.checked) total += parseInt(cb.value, 10);
  });
  document.getElementById("total-display").innerText = total.toLocaleString("id-ID");
}

// ---------- Kompres foto sebelum upload (cepat + tetap jelas + tahan di HP) ----------
function kompresFoto(file, maxSisi, kualitas) {
  return new Promise(function (resolve, reject) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) {
      reject(new Error("File yang dipilih bukan gambar. Pilih foto dari galeri."));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error("Ukuran foto terlalu besar (maks. 15 MB). Coba ambil ulang atau pilih yang lebih kecil."));
      return;
    }

    var selesai = false;
    var timeout = setTimeout(function () {
      if (!selesai) {
        selesai = true;
        reject(new Error("Waktu memproses foto habis. Coba pilih foto yang lebih kecil."));
      }
    }, 15000);

    function prosesGambar(img) {
      try {
        var w = img.width || 1;
        var h = img.height || 1;
        var skala = Math.min(1, maxSisi / Math.max(w, h));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * skala));
        canvas.height = Math.max(1, Math.round(h * skala));
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL("image/jpeg", kualitas);
        if (!dataUrl || dataUrl.length < 100) throw new Error("Gagal mengompres foto.");
        selesai = true;
        clearTimeout(timeout);
        resolve({ bytes: dataUrl.split(",")[1], type: "image/jpeg" });
      } catch (err) {
        selesai = true;
        clearTimeout(timeout);
        reject(new Error("Gagal memproses foto: " + (err.message || "unknown")));
      }
    }

    // Cara utama (lebih cepat & stabil di HP)
    try {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        prosesGambar(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        bacaDenganFileReader();
      };
      img.src = url;
    } catch (e) {
      bacaDenganFileReader();
    }

    function bacaDenganFileReader() {
      var reader = new FileReader();
      reader.onerror = function () {
        selesai = true;
        clearTimeout(timeout);
        reject(new Error("Gagal membaca file foto. Coba pilih foto lain atau ambil ulang dari kamera."));
      };
      reader.onload = function (e) {
        var img2 = new Image();
        img2.onload = function () { prosesGambar(img2); };
        img2.onerror = function () {
          selesai = true;
          clearTimeout(timeout);
          reject(new Error("File bukan gambar yang valid. Coba format JPG/PNG."));
        };
        img2.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

// ---------- Kirim iuran ----------
function kirimIuran() {
  var fileInput = document.getElementById("form-bukti");
  var btn = document.getElementById("btn-kirim");

  var dataIuran = {
    nama: namaWargaAktif,
    pin: pinAktif,
    bulan: document.getElementById("form-bulan").value,
    tahun: parseInt(document.getElementById("form-tahun").value, 10),
    total: 0
  };
  KOMPONEN.forEach(function (k) {
    var cb = document.getElementById(k.cb);
    dataIuran[k.key] = cb.checked ? parseInt(cb.value, 10) : 0;
    dataIuran.total += dataIuran[k.key];
  });

  if (dataIuran.total === 0) {
    alert("Pilih minimal satu iuran yang dibayar!");
    return;
  }
  if (fileInput.files.length === 0) {
    alert("Wajib mengunggah bukti foto transfer!");
    return;
  }

  // Cek di client: kalau sudah bayar bulan+tahun yang dipilih, langsung tolak
  var sudahAda = riwayatData.some(function (r) {
    return r.bulan.toLowerCase() === dataIuran.bulan.toLowerCase() && r.tahun === dataIuran.tahun;
  });
  if (sudahAda) {
    alert("Anda sudah membayar iuran " + dataIuran.bulan + " " + dataIuran.tahun +
          ".\nPembayaran ulang tidak diizinkan.\nPembayaran berikutnya bisa dilakukan untuk bulan berikutnya.");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Mengirim...";

  // 1100px + kualitas 0.72 → file lebih kecil (upload lebih cepat) tapi tetap jelas terbaca
  kompresFoto(fileInput.files[0], 1100, 0.72)
    .then(function (fileData) {
      return callApi("simpanIuran", { data: dataIuran, fileData: fileData });
    })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        fileInput.value = "";
        var item = {
          id: respon.id, tanggal: respon.tanggal, nama: respon.nama, rumah: respon.rumah,
          bulan: respon.bulan, tahun: respon.tahun, total: respon.total, bukti: respon.bukti
        };
        KOMPONEN.forEach(function (k) { item[k.key] = dataIuran[k.key]; });
        riwayatData.unshift(item);
        renderRiwayat();
        tampilKuitansi(item);
      } else {
        alert(respon.pesan || "Gagal mengirim iuran.");
      }
    })
    .catch(function (err) { tampilkanError("Gagal kirim iuran: " + err.message); })
    .finally(function () {
      btn.disabled = false;
      btn.innerText = "Kirim Pembayaran";
    });
}

// ---------- Riwayat ----------
function muatRiwayat() {
  callApi("riwayat", { nama: namaWargaAktif, pin: pinAktif })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        riwayatData = respon.data;
        renderRiwayat();
      } else {
        tampilkanError(respon.pesan || "Gagal memuat riwayat.");
      }
    })
    .catch(function (err) { tampilkanError("Gagal memuat riwayat: " + err.message); });
}

function renderRiwayat() {
  var tahun = parseInt(document.getElementById("riwayat-tahun").value, 10);
  var dataTahun = riwayatData.filter(function (r) { return r.tahun === tahun; });

  document.getElementById("riwayat-chips").innerHTML = BULAN.map(function (b) {
    var lunas = dataTahun.some(function (r) { return r.bulan.toLowerCase() === b.toLowerCase(); });
    return '<div class="chip' + (lunas ? " lunas" : "") + '">' + b.substring(0, 3) + (lunas ? " ✓" : "") + "</div>";
  }).join("");

  var list = document.getElementById("riwayat-list");
  if (dataTahun.length === 0) {
    list.innerHTML = '<div class="empty">Belum ada pembayaran di tahun ' + tahun + ".</div>";
    return;
  }

  list.innerHTML = dataTahun.map(function (r) {
    var rincian = KOMPONEN.filter(function (k) { return r[k.key] > 0; })
      .map(function (k) { return k.label; }).join(", ");
    var linkBukti = /^https?:\/\//.test(r.bukti)
      ? '<a href="' + esc(r.bukti) + '" target="_blank" rel="noopener">Lihat bukti</a>' : "";
    return '<div class="item">' +
      '<div class="item-head"><b>' + esc(r.bulan) + " " + esc(r.tahun) + "</b>" +
      '<span class="item-total">' + rp(r.total) + "</span></div>" +
      '<div class="muted">Dibayar: ' + esc(r.tanggal) + "</div>" +
      '<div class="muted">' + esc(rincian) + "</div>" +
      '<div class="item-actions">' +
      '<button class="btn btn-secondary btn-sm" onclick="bukaKuitansi(\'' + esc(r.id) + '\')">🧾 Kuitansi</button>' +
      linkBukti + "</div></div>";
  }).join("");
}

// ---------- Kuitansi ----------
function bukaKuitansi(id) {
  var item = riwayatData.filter(function (r) { return r.id === id; })[0];
  if (item) tampilKuitansi(item);
}

function tampilKuitansi(r) {
  kuitansiAktif = r;
  var baris = KOMPONEN.filter(function (k) { return r[k.key] > 0; }).map(function (k) {
    return '<div class="baris"><span>' + esc(k.label) + "</span><span>" + rp(r[k.key]) + "</span></div>";
  }).join("");

  document.getElementById("kuitansi-isi").innerHTML =
    '<h3 class="title-primary">KUITANSI IPL</h3>' +
    '<div class="sub-judul">Iuran Pengelolaan Lingkungan Warga</div>' +
    '<div class="baris"><span>No. Transaksi</span><span>' + esc(r.id) + "</span></div>" +
    '<div class="baris"><span>Tanggal</span><span>' + esc(r.tanggal) + "</span></div>" +
    '<div class="baris"><span>Nama</span><span>' + esc(r.nama || namaWargaAktif) + "</span></div>" +
    '<div class="baris"><span>Rumah</span><span>' + esc(r.rumah || rumahAktif) + "</span></div>" +
    '<div class="baris"><span>Periode</span><span>' + esc(r.bulan) + " " + esc(r.tahun) + "</span></div>" +
    "<hr>" + baris +
    '<div class="baris total"><span>TOTAL</span><span>' + rp(r.total) + "</span></div>" +
    '<div class="catatan">Terima kasih atas pembayaran Anda. Kuitansi ini sah tanpa tanda tangan.</div>';

  pindahKe("kuitansi");
}

// ---------- WhatsApp (gratis, lewat tautan wa.me) ----------
// 0812.. / 812.. / +62812.. -> 62812..
function nomorWa(hp) {
  var d = String(hp || "").replace(/\D/g, "");
  if (d.indexOf("62") === 0) return d;
  if (d.indexOf("0") === 0) return "62" + d.substring(1);
  if (d.indexOf("8") === 0) return "62" + d;
  return d;
}

function bukaWa(nomor, teks) {
  window.open("https://wa.me/" + nomor + "?text=" + encodeURIComponent(teks), "_blank");
}

function teksKuitansi(r) {
  var baris = KOMPONEN.filter(function (k) { return r[k.key] > 0; })
    .map(function (k) { return "- " + k.label + ": " + rp(r[k.key]); }).join("\n");
  return "*KUITANSI IPL WARGA*\n" +
    "No. Transaksi: " + r.id + "\n" +
    "Tanggal: " + r.tanggal + "\n" +
    "Nama: " + (r.nama || namaWargaAktif) + "\n" +
    "Rumah: " + (r.rumah || rumahAktif) + "\n" +
    "Periode: " + r.bulan + " " + r.tahun + "\n\n" +
    "Rincian:\n" + baris + "\n\n" +
    "*TOTAL: " + rp(r.total) + "*\n\n" +
    "Terima kasih.";
}

function kirimWaBendahara() {
  if (!kuitansiAktif) return;
  if (WA_BENDAHARA.indexOf("GANTI") !== -1) {
    alert("Nomor WhatsApp bendahara belum diatur di app.js.");
    return;
  }
  bukaWa(nomorWa(WA_BENDAHARA),
    "Assalamualaikum, saya mengonfirmasi pembayaran IPL.\n\n" + teksKuitansi(kuitansiAktif));
}

function kirimWaSaya() {
  if (!kuitansiAktif) return;
  if (!hpAktif) {
    alert("Nomor WhatsApp Anda tidak ditemukan di data pendaftaran.");
    return;
  }
  bukaWa(nomorWa(hpAktif), teksKuitansi(kuitansiAktif));
}

// Pengurus: kirim pengingat ke warga yang belum bayar
function ingatkanWa(i) {
  if (!rekapAktif || !rekapAktif.belum[i]) return;
  var w = rekapAktif.belum[i];
  if (!w.hp) {
    alert("Nomor WhatsApp " + w.nama + " belum tersedia.");
    return;
  }
  var bulan = rekapAktif.bulan.charAt(0).toUpperCase() + rekapAktif.bulan.slice(1);
  bukaWa(w.hp,
    "Assalamualaikum Bapak/Ibu " + w.nama + " (" + w.rumah + "), mengingatkan iuran IPL " +
    bulan + " " + rekapAktif.tahun + " belum tercatat. Pembayaran dapat dilakukan lewat aplikasi: " +
    location.href.split("?")[0] + " . Terima kasih.");
}

// ---------- Pengurus ----------
function loginPengurus() {
  var pin = document.getElementById("admin-pin").value;
  if (!pin) {
    alert("Masukkan PIN pengurus!");
    return;
  }

  var btn = document.getElementById("btn-admin");
  btn.disabled = true;
  btn.innerText = "Memeriksa...";

  var now = new Date();
  callApi("rekap", { pin: pin, bulan: BULAN[now.getMonth()], tahun: now.getFullYear() })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        pinPengurusAktif = pin;
        document.getElementById("admin-pin").value = "";
        pindahKe("admin");
        renderRekap(respon);
      } else {
        alert(respon.pesan || "PIN pengurus salah.");
      }
    })
    .catch(function (err) { tampilkanError("Gagal masuk pengurus: " + err.message); })
    .finally(function () {
      btn.disabled = false;
      btn.innerText = "Masuk";
    });
}

function muatRekap() {
  var btn = document.getElementById("btn-rekap");
  btn.disabled = true;
  btn.innerText = "Memuat...";

  callApi("rekap", {
    pin: pinPengurusAktif,
    bulan: document.getElementById("rekap-bulan").value,
    tahun: parseInt(document.getElementById("rekap-tahun").value, 10)
  })
    .then(function (respon) {
      if (respon.status === "Berhasil") renderRekap(respon);
      else alert(respon.pesan || "Gagal memuat rekap.");
    })
    .catch(function (err) { tampilkanError("Gagal memuat rekap: " + err.message); })
    .finally(function () {
      btn.disabled = false;
      btn.innerText = "Tampilkan Rekap";
    });
}

function renderRekap(r) {
  rekapAktif = r;
  var t = r.totals;
  var rincian = KOMPONEN.map(function (k) {
    return '<div class="baris"><span>' + esc(k.label) + "</span><span>" + rp(t[k.key]) + "</span></div>";
  }).join("");

  var sudahHtml = r.sudah.length === 0
    ? '<div class="empty">Belum ada yang membayar.</div>'
    : r.sudah.map(function (s) {
        var link = /^https?:\/\//.test(s.bukti)
          ? ' · <a href="' + esc(s.bukti) + '" target="_blank" rel="noopener">bukti</a>' : "";
        return '<div class="row-simple"><span>' + esc(s.nama) + " (" + esc(s.rumah) + ")" + link +
               "</span><b>" + rp(s.total) + "</b></div>";
      }).join("");

  var belumHtml = r.belum.length === 0
    ? '<div class="empty">Semua warga sudah membayar 🎉</div>'
    : r.belum.map(function (b, i) {
        return '<div class="row-simple"><span>' + esc(b.nama) + " (" + esc(b.rumah) + ")</span>" +
               '<button class="btn btn-secondary btn-sm" onclick="ingatkanWa(' + i + ')">📲 Ingatkan</button></div>';
      }).join("");

  document.getElementById("rekap-hasil").innerHTML =
    '<div class="rekap-box">' +
    '<div class="baris"><span>Periode</span><b>' + esc(r.bulan.charAt(0).toUpperCase() + r.bulan.slice(1)) + " " + esc(r.tahun) + "</b></div>" +
    '<div class="baris"><span>Sudah bayar</span><b>' + r.sudah.length + " dari " + r.jumlahWarga + " rumah</b></div>" +
    rincian +
    '<div class="baris total"><span>Total terkumpul</span><span>' + rp(t.total) + "</span></div></div>" +
    '<div class="rekap-judul">✅ Sudah Bayar (' + r.sudah.length + ")</div>" + sudahHtml +
    '<div class="rekap-judul">⏳ Belum Bayar (' + r.belum.length + ")</div>" + belumHtml +
    '<div style="height:16px"></div>';
}

function gantiTabAdmin(nama) {
  document.getElementById("panel-rekap").classList.toggle("hidden", nama !== "rekap");
  document.getElementById("panel-reset").classList.toggle("hidden", nama !== "reset");
  document.getElementById("admin-tab-rekap").classList.toggle("active", nama === "rekap");
  document.getElementById("admin-tab-reset").classList.toggle("active", nama === "reset");
}

function resetPengurusWarga() {
  var rumah = kodeRumah("rs");
  if (!rumah) {
    alert("Isi Blok, No Blok, dan No Rumah warga!");
    return;
  }
  if (!confirm("Reset PIN & token untuk rumah " + rumah + "? PIN dan token lama akan hangus.")) return;

  var btn = document.getElementById("btn-reset-warga");
  btn.disabled = true;
  btn.innerText = "Memproses...";

  callApi("resetPengurus", { pin: pinPengurusAktif, rumah: rumah })
    .then(function (respon) {
      if (respon.status === "Berhasil") {
        hasilResetAktif = respon;
        kosongkanRumah("rs");
        document.getElementById("reset-hasil").innerHTML =
          '<div class="rekap-box">' +
          '<div class="baris"><span>Warga</span><b>' + esc(respon.nama) + " (" + esc(respon.rumah) + ")</b></div>" +
          '<div class="baris"><span>PIN sementara</span><b>' + esc(respon.pin) + "</b></div>" +
          '<div class="baris"><span>Token baru</span><b>' + esc(tokenFmt(respon.token)) + "</b></div></div>" +
          '<div class="peringatan">Kirim hanya ke nomor WhatsApp warga yang terdaftar. Halaman ini tidak menyimpan PIN/token setelah ditutup.</div>' +
          '<button class="btn btn-success" onclick="kirimHasilResetWa()">📲 Kirim ke WhatsApp Warga</button>';
      } else {
        document.getElementById("reset-hasil").innerHTML = "";
        alert(respon.pesan || "Gagal reset.");
      }
    })
    .catch(function (err) { tampilkanError("Gagal reset: " + err.message); })
    .finally(function () {
      btn.disabled = false;
      btn.innerText = "Reset PIN & Token";
    });
}

function kirimHasilResetWa() {
  var r = hasilResetAktif;
  if (!r) return;
  if (!r.hp) {
    alert("Nomor WhatsApp warga belum tersedia di data. Isi dulu kolom Nomor_HP di sheet.");
    return;
  }
  bukaWa(r.hp,
    "Assalamualaikum Bapak/Ibu " + r.nama + ", PIN dan Token aplikasi IPL Warga Anda sudah direset oleh pengurus.\n\n" +
    "PIN baru: " + r.pin + "\n" +
    "Token pemulihan: " + tokenFmt(r.token) + "\n\n" +
    "Simpan baik-baik. Jika ingin mengganti PIN, pakai menu Lupa PIN dengan token ini.");
}

function logoutPengurus() {
  hasilResetAktif = null;
  document.getElementById("reset-hasil").innerHTML = "";
  gantiTabAdmin("rekap");
  pinPengurusAktif = "";
  document.getElementById("rekap-hasil").innerHTML = "";
  pindahKe("login");
}

// ---------- Logout warga ----------
function logout() {
  namaWargaAktif = "";
  rumahAktif = "";
  pinAktif = "";
  hpAktif = "";
  adaTokenAktif = false;
  kuitansiAktif = null;
  riwayatData = [];
  document.getElementById("login-nama").value = "";
  document.getElementById("login-pin").value = "";
  pindahKe("login");
}

