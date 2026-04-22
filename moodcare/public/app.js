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

  main.classList.add("chat-activo");
  chatContainer.classList.add("active");

  // Usuario
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje })
    });

    const data = await res.json();

    const typingDiv = document.getElementById(typingId);
    typingDiv.innerHTML = "";

    escribirTexto(typingDiv, data.respuesta);

    // 🔊 AQUÍ ESTÁ LA MAGIA
    if (vozActiva) {
      hablar(data.respuesta);
    }

  } catch (error) {
    chat.innerHTML += `<div class="msg-bot">Error al conectar</div>`;
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