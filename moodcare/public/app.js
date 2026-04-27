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
  const user = localStorage.getItem("user");

  const path = window.location.pathname;
  const esAuthPage = path.includes("login.html") || path.includes("register.html");

  if (!user && !esAuthPage) {
    window.location.href = "login.html";
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
  verificarSesion();
  mostrarUsuario();
  mostrarSaludo(); 
  activarEnter();
  renderCalendario();
  cargarRecomendaciones();
  cargarEstadoEmocional();
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

  const emocion = ultimo.etiqueta;

  document.getElementById("estadoHoy").innerText = emocion;

  document.getElementById("emojiEstado").innerText =
    emoji(emocion);

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
  pintarRecomendaciones(data);

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