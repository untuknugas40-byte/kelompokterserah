const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// Railway otomatis mengisi DATABASE_URL jika database sudah dihubungkan
const url = process.env.DATABASE_URL || "";
const pool = new Pool({
  connectionString: url,
  ssl: url.includes("rlwy.net") ? { rejectUnauthorized: false } : false,
});

// Mengisi tanda $1, $2 dengan nilai asli, hanya untuk DITAMPILKAN di jendela SQL
function isi(sql, params) {
  return sql.replace(/\$(\d+)/g, (m, n) => {
    const v = params[n - 1];
    return typeof v === "number" ? v : "'" + String(v).replace(/'/g, "''") + "'";
  });
}

// Menjalankan SQL ke database, lalu mengirim hasil + catatan SQL ke web
async function jalankan(sql, params, arti) {
  const r = await pool.query(sql, params);
  return {
    rows: r.rows,
    log: {
      sql: isi(sql, params),
      arti,
      baris: r.rowCount,
      waktu: new Date().toLocaleTimeString("id-ID"),
    },
  };
}

// Buat tabel otomatis saat server pertama jalan
async function siapkanTabel() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS siswa (
      id SERIAL PRIMARY KEY,
      nama VARCHAR(100) NOT NULL,
      kelas VARCHAR(20) NOT NULL,
      nilai INTEGER NOT NULL DEFAULT 0
    )
  `);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// READ
app.get("/api/siswa", async (req, res) => {
  try {
    res.json(await jalankan(
      "SELECT * FROM siswa ORDER BY id DESC",
      [],
      "Ambil semua baris dari tabel siswa, yang terbaru di atas."
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CREATE
app.post("/api/siswa", async (req, res) => {
  try {
    const { nama, kelas, nilai } = req.body;
    if (!nama || !kelas) return res.status(400).json({ error: "Nama dan kelas wajib diisi" });
    res.status(201).json(await jalankan(
      "INSERT INTO siswa (nama, kelas, nilai) VALUES ($1, $2, $3) RETURNING *",
      [nama, kelas, Number(nilai) || 0],
      "Tambah satu baris baru ke tabel siswa. Kolom id dibuat otomatis oleh database."
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// UPDATE
app.put("/api/siswa/:id", async (req, res) => {
  try {
    const { nama, kelas, nilai } = req.body;
    res.json(await jalankan(
      "UPDATE siswa SET nama = $1, kelas = $2, nilai = $3 WHERE id = $4 RETURNING *",
      [nama, kelas, Number(nilai) || 0, Number(req.params.id)],
      "Ubah isi satu baris. WHERE id memastikan hanya baris itu yang berubah."
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
app.delete("/api/siswa/:id", async (req, res) => {
  try {
    res.json(await jalankan(
      "DELETE FROM siswa WHERE id = $1",
      [Number(req.params.id)],
      "Hapus satu baris. Tanpa WHERE, semua baris bisa ikut terhapus!"
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
siapkanTabel()
  .then(() => app.listen(PORT, () => console.log("Server jalan di port " + PORT)))
  .catch((e) => {
    console.error("Gagal terhubung ke database:", e.message);
    process.exit(1);
  });
