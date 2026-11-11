import { GestureRecognizer, FilesetResolver } from
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const ACTIONS = {
  Closed_Fist: {
    label: "Closed fist", es: "Puño cerrado", emoji: "✊",
    message: "Hasta pronto, fue un gusto saludarte y te esperamos coordialmente en la FCI"
  },
  Open_Palm: {
    label: "Open palm", es: "Mano abierta", emoji: "✋",
    message: "Buenos días, recibe saludos de los miembros de la Facultad de Ciencias de la Información"
  },
  Pointing_Up: {
    label: "Index finger pointing up", es: "Índice hacia arriba", emoji: "☝️",
    message: "En la FCI tenemos las carreras de Ingeniería en Tecnologías de Cómputo y Comunicaciones, la Ingeniería en Sistemas Computacionales y la Ingeniería en Diseño Multimedia"
  },
  Thumb_Up: {
    label: "Thumb pointing up", es: "Pulgar arriba", emoji: "👍", serial: "A",
    message: "Esto es una muestra de lo que hacemos los ingenieros en Tecnologías de Cómputo y Comunicaciones. ¡Encendiendo el foco!"
  },
  Thumb_Down: {
    label: "Thumb pointing down", es: "Pulgar abajo", emoji: "👎", serial: "B",
    message: "Esto es una muestra de lo que hacemos los ingenieros en Tecnologías de Cómputo y Comunicaciones. ¡Apagando el foco!"
  },
  ILoveYou: {
    label: "ILoveYou", es: "Te quiero (ASL)", emoji: "🤟",
    message: "Ese es el signo I Love You en lenguaje de señas americano. En la FCI también te queremos mucho"
  },
  Victory: {
    label: "Victory", es: "Victoria / Paz", emoji: "✌️",
    message: "Ese es el signo Peace / Victory en lenguaje de señas americano. En la FCI también deseamos que reine la paz mundial"
  }
};

const $ = (id) => document.getElementById(id);
const video = $("webcam");
const canvas = $("overlay");
const ctx = canvas.getContext("2d");
let recognizer = null;
let stream = null;
let running = false;
let rafId = null;
let lastVideoTime = -1;
let candidate = null;
let candidateFrames = 0;
let activeGesture = null;
let noGestureFrames = 0;
const REQUIRED_FRAMES = 5;
const MIN_SCORE = 0.65;

let serialPort = null;
let serialWriter = null;
let ledIsOn = false;

function setMessage(message) { $("appMessage").textContent = message; }

function renderGestureCards() {
  $("gestureGrid").innerHTML = Object.entries(ACTIONS).map(([key, item]) => `
    <article class="gesture-card" id="card-${key}">
      <div class="emoji">${item.emoji}</div>
      <h4>${item.label}</h4>
      <p>${item.es}${item.serial ? ` · Arduino ${item.serial}` : ""}</p>
    </article>`).join("");
}
renderGestureCards();

async function loadRecognizer() {
  if (recognizer) return;
  $("modelStatus").textContent = "● Cargando modelo...";
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      cannedGesturesClassifierOptions: { scoreThreshold: 0.55 }
    };
    try {
      recognizer = await GestureRecognizer.createFromOptions(vision, options);
    } catch (gpuError) {
      console.warn("No fue posible iniciar MediaPipe con GPU; se intentará CPU.", gpuError);
      options.baseOptions.delegate = "CPU";
      recognizer = await GestureRecognizer.createFromOptions(vision, options);
    }
    $("modelStatus").textContent = "● Modelo listo";
    return true;
  } catch (error) {
    console.error(error);
    $("modelStatus").textContent = "● Error al cargar modelo";
    setMessage("No se pudo cargar MediaPipe. Revisa tu conexión a Internet y vuelve a intentarlo.");
    return false;
  }
}

async function startCamera() {
  if (running) return;
  const loaded = await loadRecognizer();
  if (!loaded) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    running = true;
    $("cameraPlaceholder").hidden = true;
    $("cameraStatus").textContent = "● Cámara activa";
    $("startBtn").disabled = true;
    $("stopBtn").disabled = false;
    setMessage("Cámara activa. Muestra una mano frente a ella.");
    resetGestureState();
    predict();
  } catch (error) {
    console.error(error);
    setMessage("No fue posible acceder a la cámara. Verifica los permisos del navegador.");
  }
}

function stopCamera() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("cameraPlaceholder").hidden = false;
  $("cameraStatus").textContent = "● Cámara desconectada";
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
  $("gesturePill").textContent = "Esperando gesto";
  $("confidence").textContent = "-- %";
  $("currentGesture").textContent = "—";
  $("currentDescription").textContent = "Coloca tu mano frente a la cámara.";
  resetGestureState();
  setMessage("Cámara detenida.");
}

function resetGestureState() {
  candidate = null; candidateFrames = 0; activeGesture = null; noGestureFrames = 0;
}

function predict() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = recognizer.recognizeForVideo(video, performance.now());
    drawLandmarks(result);
    processResult(result);
  }
  rafId = requestAnimationFrame(predict);
}

function drawLandmarks(result) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.clearRect(0, 0, w, h);
  for (const hand of (result.landmarks || [])) {
    for (const point of hand) {
      ctx.beginPath();
      ctx.arc(point.x * w, point.y * h, Math.max(3, w / 240), 0, Math.PI * 2);
      ctx.fillStyle = "#d5f36a";
      ctx.fill();
    }
  }
}

function processResult(result) {
  const category = result.gestures?.[0]?.[0];
  const name = category?.categoryName;
  const score = category?.score || 0;
  if (!ACTIONS[name] || score < MIN_SCORE) {
    candidate = null;
    candidateFrames = 0;
    noGestureFrames++;
    if (noGestureFrames >= REQUIRED_FRAMES) {
      activeGesture = null;
      $("gesturePill").textContent = "Esperando gesto";
    }
    return;
  }
  noGestureFrames = 0;
  if (candidate === name) candidateFrames++;
  else { candidate = name; candidateFrames = 1; }

  $("confidence").textContent = `${Math.round(score * 100)} %`;
  $("gesturePill").textContent = `${ACTIONS[name].emoji} ${ACTIONS[name].label}`;

  if (candidateFrames >= REQUIRED_FRAMES && activeGesture !== name) {
    activeGesture = name;
    executeAction(name);
  }
}

function executeAction(name) {
  const action = ACTIONS[name];
  $("currentGesture").textContent = `${action.emoji} ${action.label}`;
  $("currentDescription").textContent = action.es;
  $("speechText").textContent = action.message;
  document.querySelectorAll(".gesture-card").forEach(card => card.classList.remove("active"));
  $(`card-${name}`)?.classList.add("active");

  // Cancelar el mensaje anterior evita que se acumulen locuciones.
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(action.message);
    utterance.lang = "es-MX";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } else {
    setMessage("Este navegador no ofrece síntesis de voz.");
  }

  if (action.serial) {
    sendSerial(action.serial).catch(error => {
      console.error(error);
      $("serialMessage").textContent = "No se pudo enviar el comando";
    });
  }
}

async function connectArduino() {
  if (!("serial" in navigator)) {
    setMessage("Web Serial no está disponible. Utiliza Chrome o Edge actualizado mediante HTTPS o localhost.");
    return;
  }
  try {
    // requestPort debe ejecutarse directamente desde el clic del usuario.
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    serialWriter = serialPort.writable.getWriter();
    $("serialIndicator").textContent = "Conectado";
    $("serialIndicator").style.color = "#d5f36a";
    $("serialMessage").textContent = "Arduino Leonardo conectado · 9600 baudios";
    $("connectBtn").textContent = "Arduino conectado";
    $("connectBtn").disabled = true;
    $("testOnBtn").disabled = false;
    $("testOffBtn").disabled = false;
    setMessage("Arduino conectado correctamente.");
  } catch (error) {
    console.error(error);
    setMessage(error.name === "NotFoundError" ? "No se seleccionó ningún puerto." : `Error al conectar Arduino: ${error.message}`);
  }
}

async function sendSerial(command) {
  if (!serialWriter) {
    $("serialMessage").textContent = `Arduino desconectado: no se envió ${command}`;
    setMessage(`El gesto fue reconocido, pero Arduino no está conectado. No se envió ${command}.`);
    return;
  }
  await serialWriter.write(new TextEncoder().encode(command));
  ledIsOn = command === "A";
  $("ledBulb").classList.toggle("on", ledIsOn);
  $("ledLabel").textContent = ledIsOn ? "LED encendido" : "LED apagado";
  $("serialMessage").textContent = `Comando "${command}" enviado por puerto serie`;
}

$("startBtn").addEventListener("click", startCamera);
$("stopBtn").addEventListener("click", stopCamera);
$("connectBtn").addEventListener("click", connectArduino);
$("testOnBtn").addEventListener("click", () => sendSerial("A"));
$("testOffBtn").addEventListener("click", () => sendSerial("B"));

if (!navigator.mediaDevices?.getUserMedia) {
  setMessage("La cámara requiere HTTPS o localhost y un navegador compatible.");
}
