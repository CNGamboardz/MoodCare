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

// 🔥 LOGIN
app.post("/login", async (req, res) => {
  const { correo, password } = req.body;

  try {
    const result = await pool.query(
      `
      SELECT 
        u.id_usuario,
        u.nombre,
        u.correo,
        u.password_hash,
        u.foto_perfil,
        r.nombre AS rol
      FROM usuarios u
      LEFT JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN roles r ON ur.id_rol = r.id_rol
      WHERE u.correo = $1
      LIMIT 1
      `,
      [correo]
    );

    if (result.rows.length === 0) {
      return res.json({ ok: false, msg: "Usuario no existe" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.json({ ok: false, msg: "Contraseña incorrecta" });
    }

    res.json({
      ok: true,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        correo: user.correo,
        foto: user.foto_perfil,
        rol: user.rol // 🔥 CLAVE
      }
    });

  } catch (error) {
    console.error(error);
    res.json({ ok: false, msg: "Error servidor" });
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
      Sistema:
      Eres MoodCare, un asistente emocional humano.

      Reglas OBLIGATORIAS:
      - Responde como una persona real (no robot)
      - Máximo 2–3 líneas
      - NO repitas frases típicas como "no te juzgo"
      - NO ignores el historial
      - NO hagas preguntas si no aportan
      - Mantén coherencia con lo que el usuario ya dijo

      Comportamiento:
      1. Detecta la emoción
      2. Valida de forma natural (sin exagerar)
      3. Responde como alguien cercano
      4. Opcional: una pregunta corta si tiene sentido

      IMPORTANTE:
      - Si es saludo → responde saludo simple
      - Si el usuario ya explicó algo → NO lo repitas ni lo preguntes otra vez

      Ejemplos:

      Usuario: Hola
      Asistente: Hola 😊 ¿cómo estás?

      Usuario: Estoy triste
      Asistente: Suena pesado… a veces esos días llegan sin avisar. ¿Te pasó algo en particular?

      Usuario: Ya te dije que fue por la escuela
      Asistente: Ah, entonces sí te pegó fuerte eso… la escuela a veces cansa más de lo que parece.

      ---

      Conversación:
      ${historialTexto}

      Usuario: ${mensaje}

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
  if (texto.includes("enojado")) return { etiqueta: "enojado", puntuacion: 2 };
  if (texto.includes("estresado")) return { etiqueta: "estresado", puntuacion: 3 };
  if (texto.includes("cansado")) return { etiqueta: "cansado", puntuacion: 4 };
  if  (texto.includes("aburrido")) return { etiqueta: "aburrido", puntuacion: 5 };
  if (texto.includes("relajado")) return { etiqueta: "relajado", puntuacion: 7 };
  if  (texto.includes("solo")) return { etiqueta: "solo", puntuacion: 3 };
  if (texto.includes("conectado")) return { etiqueta: "conectado", puntuacion: 7 };

  return { etiqueta: "neutral", puntuacion: 6 };
}

// =========================
// 📊 ESTADO EMOCIONAL DEBUG
// =========================
app.get("/estado-hoy/:userId", async (req, res) => {
  const { userId } = req.params;

  console.log("👤 USER ID RECIBIDO:", userId);

  try {

    // 🔍 VER TODO SIN FILTRO
    const debugAll = await pool.query(`
      SELECT id_usuario, etiqueta, creado_en
      FROM registros_estado_animo
      ORDER BY creado_en DESC
      LIMIT 5
    `);

    console.log("🧾 ÚLTIMOS REGISTROS:", debugAll.rows);

    // 🔍 CONSULTA REAL
    const result = await pool.query(`
      SELECT etiqueta, COUNT(*) as total
      FROM registros_estado_animo
      WHERE id_usuario = $1
      AND creado_en >= NOW() - INTERVAL '1 day'
      GROUP BY etiqueta
    `, [userId]);

    console.log("RESULTADO FILTRADO:", result.rows);

    let total = 0;
    result.rows.forEach(r => total += parseInt(r.total));

    if (total === 0) {
      console.log("⚠️ NO HAY DATOS PARA ESTE USUARIO");
      return res.json({
        energia: 0,
        ansiedad: 0,
        triste: 0
      });
    }

    const data = {
      energia: 0,
      ansiedad: 0,
      triste: 0
    };

    result.rows.forEach(r => {
      const porcentaje = (parseInt(r.total) / total) * 100;

      if (["feliz", "relajado", "conectado", "neutral"].includes(r.etiqueta)) {
        data.energia += porcentaje;
      }

      if (["ansioso", "estresado", "neutral"].includes(r.etiqueta)) {
        data.ansiedad += porcentaje;
      }

      if (["triste", "enojado", "cansado", "aburrido", "solo"].includes(r.etiqueta)) {
        data.triste += porcentaje;
      }
    });

    console.log("✅ DATA FINAL:", data);

    res.json(data);

  } catch (error) {
    console.error("💥 ERROR:", error);
    res.status(500).json({ error: "Error obteniendo datos" });
  }
});

// =========================
// 🚀 SERVIDOR
// =========================
app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});









app.get("/api/dashboard/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 🔥 TODOS LOS REGISTROS DEL USUARIO
    const registros = await pool.query(`
      SELECT *
      FROM registros_estado_animo
      WHERE id_usuario = $1
      ORDER BY creado_en DESC
    `, [id]);

    // 🔥 ÚLTIMO REGISTRO
    const ultimo = registros.rows[0] || null;

    // 🔥 TOTAL
    const total = registros.rows.length;

    res.json({
      registros: registros.rows,
      ultimo,
      total
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en dashboard" });
  }
});

// =========================
// 👑 OBTENER ADMINISTRADORES
// =========================
app.get("/admins", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT 
        u.id_usuario,
        u.nombre,
        u.correo,
        u.foto_perfil,
        u.creado_en
      FROM usuarios u
      JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
      JOIN roles r ON ur.id_rol = r.id_rol
      WHERE r.nombre = 'admin'
      ORDER BY u.creado_en DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener administradores" });
  }
});


// =========================
// 🗑️ ELIMINAR ADMIN
// =========================
app.delete("/admins/:id", async (req, res) => {
  const { id } = req.params;

  try {

    await pool.query(`
      DELETE FROM usuarios_roles
      WHERE id_usuario = $1
      AND id_rol = '4eceb8c8-bcac-4cc0-b324-b0db81876287'
    `, [id]);

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar admin" });
  }
});

app.get("/historial/:userId", async (req, res) => {
  const { userId } = req.params;

  try {

    const result = await pool.query(`
      SELECT 
        m.id_mensaje,
        m.contenido,
        m.creado_en,
        c.id_conversacion,
        COALESCE(c.titulo, 'Conversación') AS titulo,

        -- 🔥 emoción MÁS CERCANA a ese mensaje
        (
          SELECT r.etiqueta
          FROM registros_estado_animo r
          WHERE r.id_usuario = $1
          AND r.nota = m.contenido -- 🔥 relacionamos por el mensaje
          ORDER BY r.creado_en DESC
          LIMIT 1
        ) AS emocion

      FROM mensajes m

      JOIN conversaciones c 
        ON m.id_conversacion = c.id_conversacion

      JOIN cat_emisores_mensaje e 
        ON m.id_emisor = e.id_emisor

      WHERE c.id_usuario = $1
      AND e.codigo = 'usuario'

      ORDER BY m.creado_en DESC
    `, [userId]);

    res.json(result.rows);

  } catch (error) {
    console.error("💥 ERROR HISTORIAL:", error);
    res.status(500).json({ error: "Error en historial" });
  }
});

app.post("/register-admin", upload.single("foto"), async (req, res) => {
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

    // 🔥 ROL FIJO
    const idRolAdmin = "4eceb8c8-bcac-4cc0-b324-b0db81876287";

    // 2️⃣ Asignar rol admin directamente
    await client.query(
      `INSERT INTO usuarios_roles (id_usuario, id_rol)
       VALUES ($1, $2)`,
      [userId, idRolAdmin]
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