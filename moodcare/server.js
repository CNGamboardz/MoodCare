const express = require("express");
const conversaciones = {};
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hash = await bcrypt.hash(password, 10);
    const foto = req.file ? req.file.filename : null;

    // 1️⃣ Crear usuario
    const result = await client.query(
      `INSERT INTO usuarios 
      (nombre, correo, password_hash, fecha_nacimiento, telefono, foto_perfil)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_usuario`,
      [nombre, correo, hash, fecha_nacimiento, telefono, foto]
    );

    const userId = result.rows[0].id_usuario;

    // 2️⃣ Obtener rol "usuario"
    const rol = await client.query(
      `SELECT id_rol FROM roles WHERE nombre = 'usuario' LIMIT 1`
    );

    if (rol.rows.length === 0) {
      throw new Error("No existe el rol usuario");
    }

    // 3️⃣ Asignar rol
    await client.query(
      `INSERT INTO usuarios_roles (id_usuario, id_rol)
       VALUES ($1, $2)`,
      [userId, rol.rows[0].id_rol]
    );

    await client.query("COMMIT");

    res.json({ ok: true });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ ok: false });

  } finally {
    client.release();
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
  const { mensaje, userId } = req.body;

  try {
    console.log("👤 USER:", userId);
    console.log("💬 MENSAJE:", mensaje);

    // 🔴 VALIDAR USER ID
    if (!userId) {
      return res.status(400).json({
        respuesta: "No se recibió userId ❌"
      });
    }

    // 🔎 VERIFICAR SI EL USUARIO EXISTE
    const userCheck = await pool.query(
      `SELECT id_usuario FROM usuarios WHERE id_usuario = $1`,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      console.log("❌ USER NO EXISTE EN DB");

      return res.status(400).json({
        respuesta: "El usuario no existe en la base de datos ❌"
      });
    }

    console.log("✅ USER EXISTE");

    // 🔎 EMISORES
    const emisorUsuario = await pool.query(
      `SELECT id_emisor FROM cat_emisores_mensaje WHERE codigo = 'usuario'`
    );

    const emisorIA = await pool.query(
      `SELECT id_emisor FROM cat_emisores_mensaje WHERE codigo = 'asistente'`
    );

    const idUsuarioEmisor = emisorUsuario.rows[0].id_emisor;
    const idIAEmisor = emisorIA.rows[0].id_emisor;

    // 🔎 CONVERSACIÓN
    let conv = await pool.query(
      `SELECT id_conversacion 
       FROM conversaciones 
       WHERE id_usuario = $1 
       ORDER BY creado_en DESC LIMIT 1`,
      [userId]
    );

    let idConversacion;

    if (conv.rows.length === 0) {
      console.log("🆕 CREANDO CONVERSACIÓN");

      const nueva = await pool.query(
        `INSERT INTO conversaciones (id_usuario)
         VALUES ($1) RETURNING id_conversacion`,
        [userId]
      );

      idConversacion = nueva.rows[0].id_conversacion;
    } else {
      idConversacion = conv.rows[0].id_conversacion;
    }

    // 💾 MENSAJE USUARIO
    await pool.query(
      `INSERT INTO mensajes (id_conversacion, id_emisor, contenido)
       VALUES ($1, $2, $3)`,
      [idConversacion, idUsuarioEmisor, mensaje]
    );

    console.log("✅ MENSAJE USUARIO GUARDADO");

    // =========================
    // 🧠 DETECTAR EMOCIÓN
    // =========================
    const emocion = detectarEmocion(mensaje);

    console.log("🧠 EMOCIÓN DETECTADA:", emocion);

    // =========================
    // 💾 GUARDAR EMOCIÓN (AQUÍ ESTABA TU FALLO)
    // =========================
    try {
      const result = await pool.query(
        `INSERT INTO registros_estado_animo 
        (id_usuario, puntuacion, etiqueta, nota)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [userId, emocion.puntuacion, emocion.etiqueta, mensaje]
      );

      console.log("✅ EMOCIÓN GUARDADA:", result.rows[0]);

    } catch (err) {
      console.error("💥 ERROR GUARDANDO EMOCIÓN:");
      console.error(err);
    }

    // 📥 HISTORIAL
    const historialDB = await pool.query(
      `SELECT contenido, id_emisor 
       FROM mensajes 
       WHERE id_conversacion = $1
       ORDER BY creado_en ASC`,
      [idConversacion]
    );

    const historialTexto = historialDB.rows
      .map(m =>
        `${m.id_emisor === idUsuarioEmisor ? "Usuario" : "Asistente"}: ${m.contenido}`
      )
      .join("\n");

    // 🤖 IA
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3",
      prompt: `
Eres MoodCare, un asistente emocional con memoria real.

Conversación:
${historialTexto}

Responde al último mensaje.
Asistente:
      `,
      stream: false
    });

    const respuestaIA = response.data.response;

    // 💾 RESPUESTA IA
    await pool.query(
      `INSERT INTO mensajes (id_conversacion, id_emisor, contenido)
       VALUES ($1, $2, $3)`,
      [idConversacion, idIAEmisor, respuestaIA]
    );

    console.log("🤖 RESPUESTA IA GUARDADA");

    res.json({ respuesta: respuestaIA });

  } catch (error) {
    console.error("💥 ERROR COMPLETO:", error);

    res.status(500).json({
      respuesta: "Error interno 😢"
    });
  }
});


// =========================
// 🧠 FUNCIÓN EMOCIÓN
// =========================
function detectarEmocion(texto) {
  texto = texto.toLowerCase();

  if (texto.includes("feliz")) return { etiqueta: "feliz", puntuacion: 8 };
  if (texto.includes("triste")) return { etiqueta: "triste", puntuacion: 3 };
  if (texto.includes("ansiedad")) return { etiqueta: "ansiedad", puntuacion: 4 };

  return { etiqueta: "neutral", puntuacion: 6 };
}

// =========================
// 🚀 SERVIDOR
// =========================
app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});