const express = require("express");
const axios = require("axios");
const path = require("path");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const multer = require("multer");

const app = express();

// =========================
// 🧩 MIDDLEWARES
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 👈 importante para forms
app.use(express.static(path.join(__dirname, "public")));

// =========================
// 📂 CONFIGURAR SUBIDA DE IMÁGENES
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    const nombre = Date.now() + "-" + file.originalname;
    cb(null, nombre);
  }
});

const upload = multer({ storage });

// =========================
// 🔌 POSTGRESQL
// =========================
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "moodcare",
  password: "1234", // 👈 tu contraseña real
  port: 5432
});

// =========================
// 📝 REGISTER (CON FOTO)
// =========================
app.post("/register", upload.single("foto"), async (req, res) => {
  const { nombre, correo, password, fecha_nacimiento, telefono } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    const foto = req.file ? req.file.filename : null;

    const result = await pool.query(
      `INSERT INTO usuarios 
      (nombre, correo, password_hash, fecha_nacimiento, telefono, foto_perfil)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_usuario`,
      [nombre, correo, hash, fecha_nacimiento, telefono, foto]
    );

    const userId = result.rows[0].id_usuario;

    // 🎭 asignar rol "usuario"
    const rol = await pool.query(
      `SELECT id_rol FROM roles WHERE nombre = 'usuario' LIMIT 1`
    );

    if (rol.rows.length > 0) {
      await pool.query(
        `INSERT INTO usuarios_roles (id_usuario, id_rol)
         VALUES ($1, $2)`,
        [userId, rol.rows[0].id_rol]
      );
    }

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

// =========================
// 🔐 LOGIN (CON FOTO)
// =========================
app.post("/login", async (req, res) => {
  const { correo, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT * FROM usuarios WHERE correo = $1`,
      [correo]
    );

    if (result.rows.length === 0) {
      return res.json({ ok: false });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.json({ ok: false });
    }

    res.json({
      ok: true,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        correo: user.correo,
        foto: user.foto_perfil // 👈 IMPORTANTE
      }
    });

  } catch (error) {
    console.error(error);
    res.json({ ok: false });
  }
});

// =========================
// 🤖 IA (OLLAMA)
// =========================
app.post("/chat", async (req, res) => {
  const mensaje = req.body.mensaje;

  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3",
      prompt: `
Eres MoodCare, un asistente emocional.

- Eres empático
- No juzgas
- Ayudas al usuario
- No das consejos médicos
- Respondes claro y corto

Usuario: ${mensaje}
      `,
      stream: false
    });

    res.json({
      respuesta: response.data.response
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error con IA" });
  }
});

// =========================
// 🚀 SERVIDOR
// =========================
app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});