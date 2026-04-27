/* ========================= */
/* ✏️ AUTOCOMPLETAR OPCIONES */
/* ========================= */
function fill(text) {
  const input = document.getElementById("mensaje");
  if (input) input.value = text;
}

/* ========================= */
/* 🔐 SESIÓN (LOGIN) */
/* ========================= */
function verificarSesion() {
  const user = JSON.parse(localStorage.getItem("user"));
  const path = window.location.pathname;

  const esLogin = path.includes("login.html") || path.includes("register.html");

  // 🔒 Sin sesión → login
  if (!user && !esLogin) {
    window.location.replace("login.html");
    return;
  }

  if (!user) return;

  const esAdmin = user.rol === "admin";
  const paginaActual = path.split("/").pop();

  // =========================
  // 🚀 REDIRECCIÓN INICIAL (SOLO INDEX)
  // =========================
  if (paginaActual === "" || paginaActual === "index.html") {
    if (esAdmin) {
      window.location.replace("inicio_admin.html");
    } else {
      window.location.replace("inicio.html");
    }
    return;
  }

  // =========================
  // 🧭 PÁGINAS
  // =========================
  const paginasAdmin = [
    "inicio_admin.html",
    "usuario.html",
    "registros_emocionales_admin.html",
    "estadisticas.html",
    "registrar_admins.html" // ✅ CORREGIDO
  ];

  const paginasUsuario = [
    "inicio.html",
    "registro.html",
    "historial.html"
  ];

  // =========================
  // 🔐 BLOQUEOS
  // =========================

  // ❌ Usuario intentando entrar a admin
  if (!esAdmin && paginasAdmin.includes(paginaActual)) {
    window.location.replace("inicio.html");
    return;
  }

  // ❌ Admin intentando entrar a usuario
  if (esAdmin && paginasUsuario.includes(paginaActual)) {
    window.location.replace("inicio_admin.html");
    return;
  }
}

function mostrarUsuario() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;

  // Nombre y correo
  const nombreHTML = document.getElementById("nombreUser");
  const correoHTML = document.getElementById("correoUser");
  const fotoHTML = document.getElementById("fotoPerfil");

  if (nombreHTML) nombreHTML.innerText = user.nombre || "Usuario";
  if (correoHTML) correoHTML.innerText = user.correo || "";

  // 🖼️ FOTO DE PERFIL (CLAVE)
  if (fotoHTML && user.foto) {
    fotoHTML.src = "uploads/" + user.foto;
  }
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

/* ========================= */
/* 🔊 CONTROL DE VOZ */
/* ========================= */
let vozActiva = true;

function hablar(texto) {

  if (!("speechSynthesis" in window)) {
    console.log("Tu navegador no soporta voz");
    return;
  }

  // 🔥 limpiar cola (opcional pero controlado)
  window.speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(texto);

  speech.lang = "es-ES";
  speech.rate = 1;
  speech.pitch = 1;

  // 🔥 esperar voces correctamente
  let voces = speechSynthesis.getVoices();

  if (voces.length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      voces = speechSynthesis.getVoices();
      speech.voice = voces.find(v => v.lang.includes("es")) || voces[0];
      speechSynthesis.speak(speech);
    };
  } else {
    speech.voice = voces.find(v => v.lang.includes("es")) || voces[0];
    speechSynthesis.speak(speech);
  }
}

function toggleVoz() {
  vozActiva = !vozActiva;

  const btn = document.getElementById("btnVoz");
  if (btn) btn.innerText = vozActiva ? "🔊" : "🔇";

  // 🔥 solo detener si se apaga
  if (!vozActiva) {
    window.speechSynthesis.cancel();
  }
}

/* ========================= */
/* ✍️ EFECTO ESCRIBIENDO */
/* ========================= */
function escribirTexto(elemento, texto) {
  let i = 0;
  const intervalo = setInterval(() => {
    elemento.innerHTML += texto.charAt(i);
    i++;
    if (i >= texto.length) clearInterval(intervalo);
  }, 20);
}

/* ========================= */
/* 💬 ENVIAR MENSAJE */
/* ========================= */
async function enviarMensaje() {
  const input = document.getElementById("mensaje");
  const chat = document.getElementById("chat");
  const chatContainer = document.getElementById("chatContainer");
  const main = document.getElementById("mainChat");

  const mensaje = input.value.trim();
  if (!mensaje) return;

  const user = JSON.parse(localStorage.getItem("user"));

  if (!user || !user.id) {
    alert("Sesión inválida");
    window.location.href = "login.html";
    return;
  }

  // 🧠 obtener id de conversación actual
  let idConversacion = localStorage.getItem("chatId");

  main.classList.add("chat-activo");
  chatContainer.classList.add("active");

  chat.innerHTML += `<div class="msg-user">${mensaje}</div>`;
  input.value = "";

  const typingId = "typing-" + Date.now();

  chat.innerHTML += `
    <div class="msg-bot" id="${typingId}">
      MoodCare está escribiendo...
    </div>
  `;

  chat.scrollTop = chat.scrollHeight;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mensaje,
        userId: user.id,
        idConversacion
      })
    });

    const data = await res.json();

    // 🔥 guardar conversación actual
    localStorage.setItem("chatId", data.idConversacion);

    const typingDiv = document.getElementById(typingId);
    typingDiv.innerHTML = "";

    escribirTexto(typingDiv, data.respuesta);

    if (vozActiva) {
      setTimeout(() => {
        hablar(data.respuesta);
      }, data.respuesta.length * 20);
    }

  } catch (error) {
    chat.innerHTML += `<div class="msg-bot">Error 😢</div>`;
  }

  chat.scrollTop = chat.scrollHeight;
}

/* ========================= */
/* ⌨️ ENTER PARA ENVIAR */
/* ========================= */
function activarEnter() {
  const input = document.getElementById("mensaje");
  if (!input) return;

  input.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      enviarMensaje();
    }
  });
}

/* ========================= */
/* RECONOCIMIENTO DE VOZ */
/* ========================= */
let reconocimiento;
let escuchando = false;

function iniciarReconocimiento() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Tu navegador no soporta reconocimiento de voz 😢");
    return;
  }

  reconocimiento = new SpeechRecognition();
  reconocimiento.lang = "es-ES";
  reconocimiento.continuous = false;
  reconocimiento.interimResults = false;

  reconocimiento.onresult = function(event) {
    const texto = event.results[0][0].transcript;
    const input = document.getElementById("mensaje");
    if (input) input.value = texto;
  };

  reconocimiento.onend = function() {
    escuchando = false;
    const btn = document.getElementById("btnMic");
    if (btn) btn.classList.remove("active");
  };
}

function toggleMic() {
  if (!reconocimiento) iniciarReconocimiento();

  const btn = document.getElementById("btnMic");
  if (!btn) return;

  if (!escuchando) {
    reconocimiento.start();
    escuchando = true;
    btn.classList.add("active");
  } else {
    reconocimiento.stop();
    escuchando = false;
    btn.classList.remove("active");
  }
}

/* ========================= */
/* INICIALIZACIÓN */
/* ========================= */
document.addEventListener("DOMContentLoaded", () => {
  renderMenu(); // 🔥 ESTA ES LA CLAVE
  activarMenu();
  mostrarUsuario();
  mostrarSaludo(); 
  activarEnter();
  renderCalendario();
  cargarRecomendaciones();
  cargarEstadoEmocional();
  cargarAdmins(); // 👈 ESTA LÍNEA NUEVA
  cargarHistorialUsuario();
  cargarUsuarios();
});

/* ========================= */
/* SALUDO DINÁMICO */
/* ========================= */
function mostrarSaludo() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;

  const saludo = document.getElementById("saludo");

  if (saludo) {
    saludo.innerText = `Hola, ${user.nombre} 👋`;
  }
}

/* ========================= */
/* 📅 CALENDARIO FUNCIONAL */
/* ========================= */
let fechaActual = new Date();

function renderCalendario() {
  const calendario = document.getElementById("calendario");
  const mesLabel = document.getElementById("mesActual");

  if (!calendario || !mesLabel) return;

  calendario.innerHTML = "";

  const año = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();

  const nombresMes = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  mesLabel.innerText = `${nombresMes[mes]} ${año}`;

  const primerDia = new Date(año, mes, 1).getDay();
  const diasMes = new Date(año, mes + 1, 0).getDate();

  // espacios vacíos
  for (let i = 0; i < primerDia; i++) {
    calendario.innerHTML += `<div></div>`;
  }

  const hoy = new Date();

  for (let dia = 1; dia <= diasMes; dia++) {
    const esHoy =
      dia === hoy.getDate() &&
      mes === hoy.getMonth() &&
      año === hoy.getFullYear();

    calendario.innerHTML += `
      <div class="${esHoy ? "hoy" : ""}" onclick="seleccionarDia(${dia})">
        ${dia}
      </div>
    `;
  }
}

function cambiarMes(valor) {
  fechaActual.setMonth(fechaActual.getMonth() + valor);
  renderCalendario();
}

function seleccionarDia(dia) {
  console.log("Seleccionaste:", dia);

  // 💡 luego aquí conectamos con DB
  alert("Seleccionaste el día " + dia);
}

/* ========================= */
/* 🌿 RECOMENDACIONES RANDOM */
/* ========================= */
function cargarRecomendaciones() {

  const lista = [
    {
      icon: "🧘",
      titulo: "Respiración guiada",
      desc: "Ejercicio corto para relajarte",
      tiempo: "5 minutos"
    },
    {
      icon: "📓",
      titulo: "Diario emocional",
      desc: "Escribe cómo te sientes hoy",
      tiempo: "30 minutos"
    },
    {
      icon: "🚶",
      titulo: "Caminata relajante",
      desc: "Un paso clave para mejorar el ánimo",
      tiempo: "1 hora"
    },
    {
      icon: "🎧",
      titulo: "Música tranquila",
      desc: "Escucha sonidos relajantes",
      tiempo: "10 minutos"
    },
    {
      icon: "🌿",
      titulo: "Momento de calma",
      desc: "Respira profundo y desconéctate",
      tiempo: "5 minutos"
    },
    {
      icon: "☕",
      titulo: "Pausa consciente",
      desc: "Tómate un descanso sin distracciones",
      tiempo: "15 minutos"
    }
  ];

  // 🔀 mezclar aleatoriamente
  const random = lista.sort(() => 0.5 - Math.random()).slice(0, 3);

  const contenedor = document.getElementById("recomendaciones");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  random.forEach(item => {
    contenedor.innerHTML += `
      <div class="reco-item">
        <div class="reco-icon">${item.icon}</div>

        <div class="reco-text">
          <strong>${item.titulo}</strong>
          <small>${item.desc}</small>
        </div>

        <div class="reco-time">${item.tiempo}</div>
      </div>
    `;
  });
}

function nuevoChat() {
  localStorage.removeItem("chatId"); // 🔥 borra conversación actual
  document.getElementById("chat").innerHTML = ""; // limpia UI
}

/* ========================= */
/* 📊 CARGAR ESTADO EMOCIONAL */
/* ========================= */
async function cargarEstadoEmocional() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;

  try {
    const res = await fetch(`/estado-hoy/${user.id}`);
    const data = await res.json();

    const energia = document.getElementById("energia");
    const ansiedad = document.getElementById("ansiedad");
    const triste = document.getElementById("triste");

    // 🌿 Energía
    if (energia) {
      const val = Math.round(data.energia);
      energia.innerHTML = `${val}%<br><small>Energía</small>`;
      energia.style.width = (100 + val) + "px";
      energia.style.height = (100 + val) + "px";
    }

    // ⚡ Ansiedad
    if (ansiedad) {
      const val = Math.round(data.ansiedad);
      ansiedad.innerHTML = `${val}%<br><small>Ansiedad</small>`;
      ansiedad.style.width = (70 + val) + "px";
      ansiedad.style.height = (70 + val) + "px";
    }

    // 🌧️ Bajo ánimo
    if (triste) {
      const val = Math.round(data.triste);
      triste.innerHTML = `${val}%<br><small>Bajo ánimo</small>`;
      triste.style.width = (60 + val) + "px";
      triste.style.height = (60 + val) + "px";
    }

  } catch (error) {
    console.error("Error cargando estado emocional", error);
  }
}








const API = "http://localhost:3000/api/dashboard";

const user = JSON.parse(localStorage.getItem("user"));
const ID_USUARIO = user?.id;

// 🔥 PRUEBA RÁPIDA (si falla login)
if (!ID_USUARIO) {
  console.warn("No hay usuario, usando ID fijo");
}

window.onload = async () => {
  try {

    const res = await fetch(`${API}/${ID_USUARIO}`);
    const data = await res.json();

    console.log("DATA:", data);

    renderDashboard(data);

  } catch (error) {
    console.error("ERROR:", error);
    mostrarVacio();
    pintarCalendario([]);
  }
};

/* =========================
   RENDER
========================= */
function renderDashboard(data) {

  if (!data || !data.registros || data.registros.length === 0) {
    mostrarVacio();
    pintarCalendario([]);
    return;
  }

  const { registros, ultimo, total } = data;

  actualizarCards(ultimo, total);
  pintarTabla(registros);
  pintarCalendario(registros);
  pintarGrafica(registros);
}

/* =========================
   CARDS
========================= */
function actualizarCards(ultimo, total) {

  document.getElementById("estadoHoy").innerText =
    `${emoji(ultimo.etiqueta)} ${ultimo.etiqueta}`;

  document.getElementById("puntuacionHoy").innerText =
    `${ultimo.puntuacion}/10`;

  document.getElementById("totalRegistros").innerText =
    `${total} registros`;

  document.getElementById("ultimoRegistro").innerText =
    tiempoRelativo(ultimo.creado_en);
}

/* =========================
   TABLA
========================= */
function pintarTabla(data) {

  let html = `
    <tr>
      <th>Fecha</th>
      <th>Emoción</th>
      <th>Puntuación</th>
      <th>Nota</th>
    </tr>
  `;

  data.forEach(r => {

    const clase = (r.etiqueta || "neutral").toLowerCase();

    html += `
      <tr>
        <td>${formatoFecha(r.creado_en)}</td>
        <td>${emoji(r.etiqueta)} ${r.etiqueta}</td>
        <td>
          <div class="puntuacion ${clase}">
            ${r.puntuacion}
          </div>
        </td>
        <td>${r.nota || "-"}</td>
      </tr>
    `;
  });

  document.getElementById("tablaRegistros").innerHTML = html;
}

/* =========================
   CALENDARIO
========================= */
function pintarCalendario(data) {
  pintarRecomendaciones(data);
  const cont = document.getElementById("calendar");
  cont.innerHTML = "";

  const hoy = new Date();
  const mes = hoy.getMonth();
  const anio = hoy.getFullYear();

  const diasMes = new Date(anio, mes + 1, 0).getDate();

  for (let i = 1; i <= diasMes; i++) {
    const div = document.createElement("div");
    div.className = "dia";
    div.innerText = i;

    // 🔥 buscar emoción de ese día
    const registro = data.find(e => {
      const fecha = new Date(e.creado_en);
      return (
        fecha.getDate() === i &&
        fecha.getMonth() === mes &&
        fecha.getFullYear() === anio
      );
    });

    // 🎨 pintar color según emoción
    if (registro) {
      div.classList.add(registro.etiqueta.toLowerCase());
    }

    cont.appendChild(div);
  }
}
/* =========================
   GRAFICA
========================= */
function pintarGrafica(data) {

  const ultimos = data.slice(0,7).reverse();

  const diasSemana = ["Do", "Lu", "Ma", "Mi", "Jue", "Vi", "Sa"];

  const labels = ultimos.map(r => {
    const fecha = new Date(r.creado_en);
    return diasSemana[fecha.getDay()];
  });

  const ctx = document.getElementById("grafica");

  if (window.miGrafica) {
    window.miGrafica.destroy();
  }

  window.miGrafica = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels, // 🔥 ahora sí salen los días
      datasets: [{
        data: ultimos.map(r => r.puntuacion),
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // 🔥 para que ocupe toda la tarjeta
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 1,
          max: 10,
        }
      }
    },
    plugins: [{
      id: "emojiPlugin",
      afterDatasetsDraw(chart) {

        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);

        meta.data.forEach((point, i) => {

          const emo = ultimos[i]?.etiqueta;

          ctx.font = "30px Arial"; // 🔥 emoji más grande
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.fillText(
            emoji(emo),
            point.x,
            point.y - 8
          );
        });
      }
    }]
  });
}

/* =========================
   VACÍO
========================= */
function mostrarVacio() {

  document.getElementById("estadoHoy").innerText = "--";
  document.getElementById("puntuacionHoy").innerText = "--";
  document.getElementById("totalRegistros").innerText = "--";
  document.getElementById("ultimoRegistro").innerText = "--";

  document.getElementById("tablaRegistros").innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;">
        No hay registros 💭
      </td>
    </tr>
  `;
}

/* =========================
   HELPERS
========================= */
function emoji(e) {
  if (!e) return "😐";

  e = e.toLowerCase();

  if (e.includes("feliz")) return "😄";
  if (e.includes("triste")) return "😢";
  if (e.includes("ansioso") || e.includes("ansiedad")) return "😟";
  if (e.includes("neutral")) return "😐";
  if (e.includes("enojado") || e.includes("enojo")) return "😠";

  return "🙂";
}

function formatoFecha(f) {
  return new Date(f).toLocaleDateString();
}

function tiempoRelativo(f) {
  const diff = (new Date() - new Date(f)) / 1000;
  if (diff < 3600) return "Hace minutos";
  if (diff < 86400) return "Hace horas";
  return formatoFecha(f);
}

function getColor(e) {

  e = e.toLowerCase();

  if (e.includes("feliz")) return "#E6A38B";
  if (e.includes("ansiedad")) return "#D8CDB5";
  if (e.includes("triste")) return "#8E8773";
  if (e.includes("neutral")) return "#ccc";
  if (e.includes("enojado")) return "#3D372A";
  
  return "#ddd";
}


function pintarRecomendaciones(data) {

  const cont = document.getElementById("recomendaciones");
  cont.innerHTML = "";

  if (!data.length) return;

  const ultima = data[0].etiqueta.toLowerCase();

  let lista = [];

  if (ultima.includes("feliz")) {
    lista = [
      {
        icon: "🌞",
        titulo: "Comparte tu alegría",
        desc: "Habla con alguien y comparte tu buen momento"
      },
      {
        icon: "🎵",
        titulo: "Escucha música",
        desc: "Refuerza tu estado positivo con tu playlist"
      },
      {
        icon: "📸",
        titulo: "Guarda el momento",
        desc: "Toma una foto o escribe cómo te sientes"
      }
    ];
  }

  else if (ultima.includes("triste")) {
    lista = [
      {
        icon: "🧘",
        titulo: "Respirar profundo",
        desc: "Te ayudará a relajar el estrés"
      },
      {
        icon: "📓",
        titulo: "Escribe lo que sientes",
        desc: "Expresar emociones ayuda a liberarlas"
      },
      {
        icon: "📞",
        titulo: "Habla con alguien",
        desc: "No tienes que sentirte sola"
      }
    ];
  }

  else if (ultima.includes("ansiedad") || ultima.includes("ansioso")) {
    lista = [
      {
        icon: "🌬️",
        titulo: "Respiración guiada",
        desc: "Controla tu ritmo y calma tu mente"
      },
      {
        icon: "🚶",
        titulo: "Camina 10 minutos",
        desc: "Mejora tu estado de ánimo"
      },
      {
        icon: "📵",
        titulo: "Desconéctate",
        desc: "Reduce estímulos por un rato"
      }
    ];
  }

  else {
    lista = [
      {
        icon: "🌿",
        titulo: "Relájate",
        desc: "Tómate un momento para ti"
      },
      {
        icon: "💧",
        titulo: "Hidrátate",
        desc: "Tu cuerpo también necesita cuidado"
      },
      {
        icon: "😌",
        titulo: "Descansa",
        desc: "Un pequeño descanso ayuda mucho"
      }
    ];
  }

  lista.forEach(r => {

    const div = document.createElement("div");
    div.className = "registro-reco-item";

    div.innerHTML = `
      <div class="reco-icon">${r.icon}</div>
      <div class="reco-texto">
        <span class="reco-titulo">${r.titulo}</span>
        <span class="reco-desc">${r.desc}</span>
      </div>
    `;

    cont.appendChild(div);
  });
}

function obtenerIconoEstado(emocion) {

  if (!emocion) return "./image/neutral.png";

  emocion = emocion.toLowerCase();

  if (emocion.includes("feliz")) return "./image/feliz.png";
  if (emocion.includes("triste")) return "./image/triste.png";
  if (emocion.includes("ansiedad") || emocion.includes("ansioso")) return "./image/ansiedad.png";
  if (emocion.includes("neutral")) return "./image/neutral.png";

  return "./image/neutral.png";
}

async function login() {
  const correo = document.getElementById("correo").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, password })
    });

    const data = await res.json();

    if (!data.ok) {
      alert("Correo o contraseña incorrectos");
      return;
    }

    localStorage.setItem("user", JSON.stringify(data.user));

    // 👉 Mejor usa rol si ya lo traes del backend
    if (data.user.rol === "admin") {
      window.location.replace("inicio_admin.html");
    } else {
      window.location.replace("inicio.html");
    }

  } catch (error) {
    console.error(error);
    alert("Error de conexión");
  }
}

function renderMenu() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;

  const menu = document.getElementById("menu");
  if (!menu) return;

  if (user.rol === "admin") {
    menu.innerHTML = `
      <div class="menu-item" onclick="window.location.href='inicio_admin.html'">
        <img src="image/casa.png">
        <span>Inicio</span>
      </div>

      <div class="menu-item" onclick="window.location.href='usuario.html'">
        <img src="image/user.png">
        <span>Usuarios</span>
      </div>

      <div class="menu-item" onclick="window.location.href='registros_emocionales_admin.html'">
        <img src="image/registroemocional.png">
        <span>Registros</span>
      </div>

      <div class="menu-item" onclick="window.location.href='estadisticas.html'">
        <img src="image/grafica.png">
        <span>Estadísticas</span>
      </div>

      <div class="menu-item" onclick="window.location.href='adminis.html'">
        <img src="image/admin.png">
        <span>Registrar Administradores</span>
      </div>
    `;
  } else {
    menu.innerHTML = `
      <div class="menu-item" onclick="window.location.href='inicio.html'">
        <img src="image/casa.png">
        <span>Inicio</span>
      </div>

      <div class="menu-item" onclick="window.location.href='index.html'">
        <img src="image/chat.png">
        <span>Chat</span>
      </div>

      <div class="menu-item" onclick="window.location.href='registro.html'">
        <img src="image/registroemocional.png">
        <span>Registro emocional</span>
      </div>

      <div class="menu-item" onclick="window.location.href='historial.html'">
        <img src="image/historial.png">
        <span>Historial</span>
      </div>
    `;
  }
}

function activarMenu() {
  const pagina = window.location.pathname.split("/").pop();

  document.querySelectorAll(".menu-item").forEach(item => {
    if (item.onclick?.toString().includes(pagina)) {
      item.classList.add("active");
    }
  });
}

/* ========================= */
/* 👑 CARGAR ADMINISTRADORES */
/* ========================= */
async function cargarAdmins() {

  const tabla = document.getElementById("tablaAdmins");
  const contador = document.getElementById("contadorAdmins");

  // 🔒 evitar errores en otras páginas
  if (!tabla) return;

  try {

    const res = await fetch("http://localhost:3000/admins");
    const admins = await res.json();

    tabla.innerHTML = "";

    admins.forEach(admin => {

      const foto = admin.foto_perfil
        ? "uploads/" + admin.foto_perfil
        : "image/user.jpg";

      const fecha = new Date(admin.creado_en)
        .toLocaleDateString("es-MX");

      tabla.innerHTML += `
        <tr>

          <!-- 👤 NOMBRE -->
          <td class="admin-col-nombre">
            <div class="admin-user-cell">
              <img src="${foto}">
              <span>${admin.nombre}</span>
            </div>
          </td>

          <!-- 📧 CORREO -->
          <td class="admin-col-correo">
            ${admin.correo}
          </td>

          <!-- 📅 FECHA -->
          <td class="admin-col-fecha">
            ${fecha}
          </td>

          <!-- ⚙️ ACCIONES -->
        <td class="admin-acciones">
          <button onclick="editarAdmin('${admin.id_usuario}')">
            <img src="image/editar_admin.png">
          </button>

          <button onclick="eliminarAdmin('${admin.id_usuario}')">
            <img src="image/eliminar_admin.png">
          </button>
        </td>

        </tr>
      `;
    });

    if (contador) {
      contador.innerText = `Mostrando ${admins.length} administradores`;
    }

  } catch (error) {
    console.error("Error cargando admins:", error);
  }
}


/* ========================= */
/* 🗑️ ELIMINAR ADMIN */
/* ========================= */
async function eliminarAdmin(id) {

  const confirmar = confirm("¿Eliminar administrador?");
  if (!confirmar) return;

  try {

    await fetch(`http://localhost:3000/admins/${id}`, {
      method: "DELETE"
    });

    cargarAdmins();

  } catch (error) {
    console.error(error);
  }
}


/* ========================= */
/* ✏️ EDITAR ADMIN (placeholder) */
/* ========================= */
function editarAdmin(id) {
  console.log("Editar admin:", id);
}

let historialData = [];
let paginaActual = 1;
const porPagina = 5;

/* ========================= */
/* 📜 CARGAR HISTORIAL */
/* ========================= */
async function cargarHistorialUsuario() {

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;

  const total = document.getElementById("totalConversaciones");

  try {

    const res = await fetch(`http://localhost:3000/historial/${user.id}`);
    historialData = await res.json();

    total.innerText = historialData.length;

    renderTabla();
    renderResumen();
    renderPaginacion();

  } catch (error) {
    console.error(error);
  }
}

function renderTabla() {

  const tabla = document.getElementById("tablaHistorial");
  const contador = document.getElementById("contadorHistorial");

  tabla.innerHTML = "";

  const inicio = (paginaActual - 1) * porPagina;
  const fin = inicio + porPagina;

  const datosPagina = historialData.slice(inicio, fin);

  datosPagina.forEach(msg => {

    const emocion = msg.emocion || "neutral";

    tabla.innerHTML += `
      <tr>

        <td>${msg.titulo || "Conversación"}</td>

        <td>${msg.contenido || "-"}</td>

        <td>
          <div class="historial-emocion">
            ${emojiHistorial(emocion)} ${emocion}
          </div>
        </td>

        <td class="historial-acciones">
          <button>
            <img src="image/editar_admin.png">
          </button>
          <button>
            <img src="image/eliminar_admin.png">
          </button>
        </td>

      </tr>
    `;
  });

  contador.innerText = `Mostrando ${datosPagina.length} de ${historialData.length} mensajes`;
}

function renderResumen() {

  const resumen = document.getElementById("resumenEmociones");

  let emocionesCount = {};

  historialData.forEach(msg => {
    const emocion = msg.emocion || "neutral";
    emocionesCount[emocion] = (emocionesCount[emocion] || 0) + 1;
  });

  resumen.innerHTML = "";

  Object.keys(emocionesCount).forEach(e => {
    resumen.innerHTML += `
      <span class="badge-emocion ${e}">
        ${emojiHistorial(e)} ${e} ${emocionesCount[e]}
      </span>
    `;
  });
}

function renderPaginacion() {

  const contenedor = document.getElementById("paginacionHistorial");
  contenedor.innerHTML = "";

  const totalPaginas = Math.ceil(historialData.length / porPagina);

  for (let i = 1; i <= totalPaginas; i++) {

    contenedor.innerHTML += `
      <button 
        class="btn-pagina ${i === paginaActual ? "activa" : ""}"
        onclick="cambiarPagina(${i})"
      >
        ${i}
      </button>
    `;
  }
}

function cambiarPagina(pagina) {
  paginaActual = pagina;
  renderTabla();
  renderPaginacion();
}


/* ========================= */
/* 😀 EMOJIS HISTORIAL */
/* ========================= */
function emojiHistorial(e) {
  if (!e) return "😐";
  e = e.toLowerCase();

  if (e.includes("feliz")) return "😃";
  if (e.includes("triste")) return "😢";
  if (e.includes("ansioso")) return "😟";
  if (e.includes("enojado")) return "😡";

  return "😐";
}

function togglePassword() {
  const input = document.getElementById("passwordInput");

  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}







async function cargarUsuarios() {

  const tabla = document.getElementById("tablaUsuarios");

  const total = document.getElementById("totalUsuarios");
  const activos = document.getElementById("usuariosActivos");
  const inactivos = document.getElementById("usuariosInactivos");
  const bloqueados = document.getElementById("usuariosBloqueados");

  const contador = document.getElementById("contadorUsuarios");

  // 🔒 evita errores si no estás en esa página
  if (!tabla) return;

  try {

    const res = await fetch("http://localhost:3000/usuarios");
    const data = await res.json();

    tabla.innerHTML = "";

    let countActivos = 0;
    let countBloqueados = 0;
    let countInactivos = 0;

    data.forEach(user => {

    let estadoTexto = "Activo";
    let claseEstado = "activo";

    if (user.id_estado_usuario == 2) {
      estadoTexto = "Bloqueado";
      claseEstado = "bloqueado";
    }

    if (claseEstado === "activo") countActivos++;
    if (claseEstado === "bloqueado") countBloqueados++;

    // 🔥 PUNTUACIÓN (ejemplo)
    const puntuacion = Math.floor(Math.random() * 100);

    let claseScore = "bajo";

    if (puntuacion >= 80) claseScore = "alto";
    else if (puntuacion >= 60) claseScore = "medio";
    else if (puntuacion >= 40) claseScore = "riesgo";

    tabla.innerHTML += `
      <tr data-estado="${claseEstado}"
      data-score="${puntuacion}"
      data-fecha="${user.creado_en}">

        <td>
          <div class="user-info">
            <img src="uploads/${user.foto_perfil || 'user.jpg'}">
            <div>
              <b>${user.nombre}</b>
              <small>${user.correo}</small>
            </div>
          </div>
        </td>

        <td>
          <span class="badge ${claseEstado}">
            ${estadoTexto}
          </span>
        </td>

        <td>
          <span class="score ${claseScore}">
            ${puntuacion}
          </span>
        </td>

        <td>
          ${new Date(user.creado_en).toLocaleDateString()}
        </td>

        <td>
          <button class="btn-action">👁</button>
        </td>

      </tr>
    `;
  });

    // 📊 CARDS
    if (total) total.innerText = data.length;
    if (activos) activos.innerText = countActivos;
    if (bloqueados) bloqueados.innerText = countBloqueados;
    if (inactivos) inactivos.innerText = countInactivos;

    // 📌 CONTADOR
    if (contador) {
      contador.innerText = `Mostrando ${data.length} usuarios`;
    }

  } catch (error) {
    console.error("Error cargando usuarios:", error);
  }
}

// ABRIR / CERRAR DROPDOWN
document.addEventListener("click", (e) => {
  const filtro = document.querySelector(".filtro-estado");

  if (filtro && filtro.contains(e.target)) {
    filtro.classList.toggle("active");
  } else if (filtro) {
    filtro.classList.remove("active");
  }
});

// FILTRAR
function filtrarEstado(tipo) {
  const filas = document.querySelectorAll("#tablaUsuarios tr");
  const texto = document.getElementById("filtroTexto");

  texto.innerText = tipo === "todos"
    ? "Todos"
    : tipo.charAt(0).toUpperCase() + tipo.slice(1);

  filas.forEach(fila => {
    const estado = fila.getAttribute("data-estado");

    if (tipo === "todos" || estado === tipo) {
      fila.style.display = "";
    } else {
      fila.style.display = "none";
    }
  });
}

function abrirFiltros() {
  document.getElementById("modalFiltros").classList.add("active");
}

function cerrarFiltros() {
  document.getElementById("modalFiltros").classList.remove("active");
} 

function aplicarFiltros() {

  const estado = document.querySelector('input[name="estado"]:checked')?.value;
  const emocion = document.querySelector('input[name="emocion"]:checked')?.value;
  const fecha = document.querySelector('input[name="fecha"]:checked')?.value;

  const filas = document.querySelectorAll("#tablaUsuarios tr");

  filas.forEach(fila => {

    let mostrar = true;

    // 🔹 FILTRO ESTADO
    const estadoFila = fila.getAttribute("data-estado");

    if (estado !== "todos" && estado !== estadoFila) {
      mostrar = false;
    }

    // 🔹 FILTRO EMOCION
    const puntuacion = parseInt(fila.getAttribute("data-score"));

    if (emocion === "alto" && puntuacion < 80) mostrar = false;
    if (emocion === "medio" && (puntuacion < 60 || puntuacion >= 80)) mostrar = false;
    if (emocion === "riesgo" && (puntuacion < 40 || puntuacion >= 60)) mostrar = false;
    if (emocion === "bajo" && puntuacion >= 40) mostrar = false;

    // 🔹 FILTRO FECHA
    const fechaFila = new Date(fila.getAttribute("data-fecha"));
    const hoy = new Date();

    if (fecha === "hoy") {
      if (fechaFila.toDateString() !== hoy.toDateString()) {
        mostrar = false;
      }
    }

    if (fecha === "semana") {
      const semana = new Date();
      semana.setDate(hoy.getDate() - 7);

      if (fechaFila < semana) {
        mostrar = false;
      }
    }

    if (fecha === "mes") {
      const mes = new Date();
      mes.setMonth(hoy.getMonth() - 1);

      if (fechaFila < mes) {
        mostrar = false;
      }
    }

    fila.style.display = mostrar ? "" : "none";

  });

  cerrarFiltros();
}

function limpiarFiltros() {
  document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

  const filas = document.querySelectorAll("#tablaUsuarios tr");
  filas.forEach(fila => fila.style.display = "");

  cerrarFiltros();
}

window.onclick = function(e) {
  const modal = document.getElementById("modalFiltros");
  if (e.target === modal) {
    modal.classList.remove("activo");
  }
}

/*Calendario de inicio*/
/* ======================================
   PINTAR CALENDARIO INICIO COMO REGISTRO
====================================== */

document.addEventListener("DOMContentLoaded", () => {

  if (!window.location.pathname.includes("inicio.html")) return;

  setTimeout(async () => {

    const user = JSON.parse(localStorage.getItem("user"));
    const calendario = document.getElementById("calendario");

    if (!user || !calendario) return;

    try {

      const res = await fetch(`http://localhost:3000/api/dashboard/${user.id}`);
      const data = await res.json();

      const registros = data.registros || [];

      const celdas = calendario.querySelectorAll("div");

      celdas.forEach(celda => {

        const diaTexto = celda.innerText.trim();

        if (!diaTexto || isNaN(diaTexto)) return;

        const diaNumero = parseInt(diaTexto);

        const fechaVista = new Date(fechaActual);
        const mes = fechaVista.getMonth();
        const anio = fechaVista.getFullYear();

        const encontrado = registros.find(r => {

          const fecha = new Date(r.creado_en);

          return (
            fecha.getDate() === diaNumero &&
            fecha.getMonth() === mes &&
            fecha.getFullYear() === anio
          );
        });

        if (encontrado) {
          celda.classList.add(encontrado.etiqueta.toLowerCase());
        }

      });

    } catch (error) {
      console.log(error);
    }

  }, 300);

});


/* Emociones recientes semana */
document.addEventListener("DOMContentLoaded", () => {

  if (window.location.pathname.includes("inicio.html")) {
    cargarEmocionesSemana();
  }

});

async function cargarEmocionesSemana() {

  const user = JSON.parse(localStorage.getItem("user"));
  const cont = document.getElementById("emocionesSemana");

  if (!user || !cont) return;

  try {

    const res = await fetch(`http://localhost:3000/historial/${user.id}`);
    const data = await res.json();

    const dias = ["L","M","M","J","V","S","D"];

    let html = `<div class="linea-semana"></div>`;

    const hoy = new Date();

    let diaNumero = hoy.getDay();
    diaNumero = diaNumero === 0 ? 7 : diaNumero; // domingo = 7

    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (diaNumero - 1));

    for (let i = 0; i < 7; i++) {

      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i);

      const reg = data.find(r => {

        const f = new Date(r.creado_en);

        return (
          f.getDate() === fecha.getDate() &&
          f.getMonth() === fecha.getMonth() &&
          f.getFullYear() === fecha.getFullYear()
        );

      });

      const emo = reg ? emojiHistorial(reg.emocion) : "";

      html += `
        <div class="dia-box">
          <div class="emoji-box">${emo}</div>
          <span>${dias[i]}</span>
        </div>
      `;
    }

    cont.innerHTML = html;

  } catch (error) {
    console.log(error);
  }
}




/*CHATS RECIENTES INICIO*/
document.addEventListener("DOMContentLoaded", () => {

  if (window.location.pathname.includes("inicio.html")) {
    cargarChatsRecientes();
  }

});

function cargarChatsRecientes(){

  const cont = document.getElementById("chatsRecientes");
  if(!cont) return;

  cont.innerHTML = `
  
    <div class="chat-item">
      <div class="chat-left">
        <div class="chat-icon">💬</div>
        <div class="chat-text">¿Cómo te sientes hoy?</div>
      </div>
      <div class="chat-time">Hoy</div>
    </div>

    <div class="chat-item">
      <div class="chat-left">
        <div class="chat-icon">💬</div>
        <div class="chat-text">Detecto algo de estrés</div>
      </div>
      <div class="chat-time">Ayer</div>
    </div>

    <div class="chat-item">
      <div class="chat-left">
        <div class="chat-icon">💬</div>
        <div class="chat-text">¿Quieres respirar conmigo?</div>
      </div>
      <div class="chat-time">Lunes</div>
    </div>

  `;
}


/*INICION ADMON*/
// ======================================
// INICIO ADMIN - RESUMEN TARJETAS
// ======================================

async function cargarResumenAdmin() {
  try {
    const res = await fetch("/api/admin/resumen");
    const data = await res.json();

    // Tarjetas
    const nums = document.querySelectorAll(".card-info h2");

    if (nums.length >= 4) {
      nums[0].innerHTML = `${data.usuarios} <small>Usuarios</small>`;
      nums[1].innerHTML = `${data.activos} <small>Hoy</small>`;
      nums[2].innerHTML = `${data.registros} <small>Registros</small>`;
      nums[3].innerHTML = `${data.bajos} <small>Usuarios</small>`;
    }

  } catch (error) {
    console.error("Error cargando resumen admin:", error);
  }
}

// Ejecutar solo en inicio_admin
if (window.location.pathname.includes("inicio_admin.html")) {
  cargarResumenAdmin();
}

//ACTIVIDADES RECIENTES//
// ======================================
// ACTIVIDAD RECIENTE ADMIN
// ======================================

function tiempoTranscurrido(fecha) {
  const ahora = new Date();
  const f = new Date(fecha);

  const diff = Math.floor((ahora - f) / 1000 / 60);

  if (diff < 1) return "Hace unos segundos";
  if (diff < 60) return `Hace ${diff} minutos`;

  const horas = Math.floor(diff / 60);
  if (horas < 24) return `Hace ${horas} horas`;

  const dias = Math.floor(horas / 24);
  return `Hace ${dias} días`;
}

async function cargarActividadAdmin() {
  try {
    const res = await fetch("/api/admin/actividad");
    const data = await res.json();

    const contenedor = document.getElementById("actividadLista");

    if (!contenedor) return;

    contenedor.innerHTML = "";

    // Último usuario
    if (data.ultimoUsuario) {
      contenedor.innerHTML += `
        <div class="actividad-item">
          <div class="actividad-icono">
            <img src="image/user.png">
          </div>

          <div class="actividad-info">
            <strong>Nuevo usuario registrado</strong>
            <p>${data.ultimoUsuario.nombre} se registró en la plataforma</p>
          </div>

          <span>${tiempoTranscurrido(data.ultimoUsuario.creado_en)}</span>
        </div>
      `;
    }

    // Último registro emocional
    if (data.ultimoRegistro) {
      contenedor.innerHTML += `
        <div class="actividad-item">
          <div class="actividad-icono">
            <img src="image/registroemocional.png">
          </div>

          <div class="actividad-info">
            <strong>Registro emocional</strong>
            <p>${data.ultimoRegistro.nombre} registró su estado: ${data.ultimoRegistro.etiqueta} (${data.ultimoRegistro.puntuacion})</p>
          </div>

          <span>${tiempoTranscurrido(data.ultimoRegistro.creado_en)}</span>
        </div>
      `;
    }

  } catch (error) {
    console.error("Error actividad admin:", error);
  }
}

// ejecutar solo inicio admin
if (window.location.pathname.includes("inicio_admin.html")) {
  cargarActividadAdmin();
}