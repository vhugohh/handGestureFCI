import {
  GestureRecognizer, FilesetResolver, DrawingUtils, HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const ACTIONS = {
  Closed_Fist:{label:"Closed fist",es:"Puño cerrado",emoji:"✊",message:"Hasta pronto, fue un gusto saludarte y te esperamos coordialmente en la FCI"},
  Open_Palm:{label:"Open palm",es:"Mano abierta",emoji:"✋",message:"Buenos días, recibe saludos de los miembros de la Facultad de Ciencias de la Información"},
  Pointing_Up:{label:"Index finger pointing up",es:"Índice hacia arriba",emoji:"☝️",message:"En la FCI tenemos las carreras de Ingeniería en Tecnologías de Cómputo y Comunicaciones, la Ingeniería en Sistemas Computacionales y la Ingeniería en Diseño Multimedia"},
  Thumb_Up:{label:"Thumb pointing up",es:"Pulgar arriba",emoji:"👍",serial:"A",message:"Esto es una muestra de lo que hacemos los ingenieros en Tecnologías de Cómputo y Comunicaciones. ¡Encendiendo el foco!"},
  Thumb_Down:{label:"Thumb pointing down",es:"Pulgar abajo",emoji:"👎",serial:"B",message:"Esto es una muestra de lo que hacemos los ingenieros en Tecnologías de Cómputo y Comunicaciones. ¡Apagando el foco!"},
  ILoveYou:{label:"ILoveYou",es:"Te quiero (ASL)",emoji:"🤟",message:"Ese es el signo I Love You en lenguaje de señas americano. En la FCI también te queremos mucho"},
  Victory:{label:"Victory",es:"Victoria / Paz",emoji:"✌️",message:"Ese es el signo Peace / Victory en lenguaje de señas americano. En la FCI también deseamos que reine la paz mundial"}
};
const $=id=>document.getElementById(id);
const video=$("webcam"),canvas=$("overlay"),ctx=canvas.getContext("2d");
let recognizer=null,drawingUtils=null,stream=null,running=false,rafId=0,lastVideoTime=-1;
let candidate=null,candidateFrames=0,activeGesture=null,noGestureFrames=0;
let serialPort=null,serialWriter=null,lastMessage="";
const REQUIRED_FRAMES=5,MIN_SCORE=.65;

function setStatus(textId,ledId,text,ok=false){$(textId).textContent=text;$(ledId).classList.toggle("ok",ok);}
function renderCards(){
  $("gestureGrid").innerHTML=Object.entries(ACTIONS).map(([key,a])=>`
    <article class="gesture-card" id="card-${key}">
      <span class="emoji">${a.emoji}</span><h3>${a.label}</h3><p>${a.es}</p>
      <small>${a.serial?`ARDUINO · ${a.serial}`:"MENSAJE DE VOZ"}</small>
    </article>`).join("");
}
renderCards();

async function loadRecognizer(){
  if(recognizer)return true;
  $("modelStatus").textContent="Cargando modelo…";
  try{
    const vision=await FilesetResolver.forVisionTasks(WASM_URL);
    recognizer=await GestureRecognizer.createFromOptions(vision,{
      baseOptions:{modelAssetPath:MODEL_URL,delegate:"GPU"},
      runningMode:"VIDEO",numHands:2,
      minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55,
      cannedGesturesClassifierOptions:{scoreThreshold:.55}
    });
    drawingUtils=new DrawingUtils(ctx);
    setStatus("modelStatus","modelLed","Modelo listo",true);
    return true;
  }catch(e){
    console.error(e);setStatus("modelStatus","modelLed","Error al cargar");
    $("appMessage").textContent="No se pudo cargar MediaPipe. Comprueba tu conexión a Internet y vuelve a intentarlo.";
    return false;
  }
}
async function startCamera(){
  if(running)return;
  if(!navigator.mediaDevices?.getUserMedia){$("appMessage").textContent="La cámara requiere HTTPS o localhost y un navegador compatible.";return;}
  if(!await loadRecognizer())return;
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:360}},audio:false});
    video.srcObject=stream;await video.play();running=true;
    $("cameraPlaceholder").hidden=true;
    setStatus("cameraStatus","cameraLed","Activa",true);
    $("trackingText").textContent="BUSCANDO MANO";$("trackingLed").classList.add("ok");
    $("startBtn").disabled=true;$("stopBtn").disabled=false;
    $("appMessage").textContent="Cámara activa. Muestra una o ambas manos frente a ella.";
    resetState();predict();
  }catch(e){console.error(e);$("appMessage").textContent="No fue posible acceder a la cámara. Verifica los permisos del navegador.";}
}
function stopCamera(){
  running=false;if(rafId)cancelAnimationFrame(rafId);
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
  ctx.clearRect(0,0,canvas.width,canvas.height);$("cameraPlaceholder").hidden=false;
  setStatus("cameraStatus","cameraLed","Desconectada");
  $("trackingText").textContent="ESPERANDO CÁMARA";$("trackingLed").classList.remove("ok");
  $("startBtn").disabled=false;$("stopBtn").disabled=true;
  $("gesturePill").textContent="SIN GESTO";$("confidence").textContent="—%";$("confidenceBar").style.width="0";
  $("currentGesture").textContent="Esperando gesto";$("currentDescription").textContent="Coloca tu mano frente a la cámara.";
  $("gestureEmoji").textContent="✋";$("className").textContent="—";$("scoreValue").textContent="—";$("handsValue").textContent="0";
  resetState();$("appMessage").textContent="Cámara detenida.";
}
function resetState(){candidate=null;candidateFrames=0;activeGesture=null;noGestureFrames=0;}
function predict(){
  if(!running)return;
  if(video.readyState>=2&&video.currentTime!==lastVideoTime){
    lastVideoTime=video.currentTime;
    const result=recognizer.recognizeForVideo(video,performance.now());
    drawHands(result);processResult(result);
  }
  rafId=requestAnimationFrame(predict);
}
function drawHands(result){
  const w=video.videoWidth,h=video.videoHeight;if(!w||!h)return;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;drawingUtils=new DrawingUtils(ctx);}
  ctx.clearRect(0,0,w,h);
  for(const landmarks of (result.landmarks||[])){
    drawingUtils.drawConnectors(landmarks,HandLandmarker.HAND_CONNECTIONS,{color:"#68dce1",lineWidth:4});
    drawingUtils.drawLandmarks(landmarks,{color:"#d8ef7a",lineWidth:1,radius:4});
    [4,8,12,16,20].forEach(i=>{
      const p=landmarks[i];ctx.beginPath();ctx.arc(p.x*w,p.y*h,7,0,Math.PI*2);
      ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#68dce1";ctx.lineWidth=3;ctx.stroke();
    });
  }
  $("handsValue").textContent=String(result.landmarks?.length||0);
}
function processResult(result){
  const category=result.gestures?.[0]?.[0],name=category?.categoryName,score=category?.score||0;
  if(!ACTIONS[name]||score<MIN_SCORE){
    candidate=null;candidateFrames=0;noGestureFrames++;
    if(noGestureFrames>=REQUIRED_FRAMES){
      activeGesture=null;$("gesturePill").textContent="SIN GESTO";
      $("trackingText").textContent=result.landmarks?.length?"MANO DETECTADA · SIN CLASE":"BUSCANDO MANO";
    }return;
  }
  noGestureFrames=0;
  if(candidate===name)candidateFrames++;else{candidate=name;candidateFrames=1;}
  const pct=Math.round(score*100);
  $("confidence").textContent=`${pct}%`;$("confidenceBar").style.width=`${pct}%`;
  $("gesturePill").textContent=`${ACTIONS[name].emoji} ${ACTIONS[name].label.toUpperCase()}`;
  $("trackingText").textContent="SEGUIMIENTO ACTIVO";
  $("className").textContent=name;$("scoreValue").textContent=`${pct}%`;
  if(candidateFrames>=REQUIRED_FRAMES&&activeGesture!==name){activeGesture=name;executeAction(name);}
}
function executeAction(name){
  const a=ACTIONS[name];
  $("currentGesture").textContent=a.label;$("currentDescription").textContent=a.es;$("gestureEmoji").textContent=a.emoji;
  const display=$("gestureDisplay");display.classList.remove("active");void display.offsetWidth;display.classList.add("active");
  document.querySelectorAll(".gesture-card").forEach(c=>c.classList.remove("active"));
  const card=$(`card-${name}`);if(card){card.classList.add("active");const icon=card.querySelector(".emoji");icon.style.animation="none";void icon.offsetWidth;icon.style.animation="";}
  $("speechText").textContent=a.message;lastMessage=a.message;$("replayBtn").disabled=false;speak(a.message);
  if(a.serial)sendSerial(a.serial).catch(e=>{console.error(e);$("serialMessage").textContent="No se pudo enviar el comando.";});
}
function speak(message){
  if(!("speechSynthesis"in window)){$("speechStatus").textContent="TTS no disponible";return;}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);
  u.lang="es-MX";u.rate=.95;u.pitch=1;
  u.onstart=()=>{$("speechStatus").textContent="Reproduciendo…";};
  u.onend=()=>{$("speechStatus").textContent="Mensaje terminado";};
  u.onerror=()=>{$("speechStatus").textContent="Voz no disponible";};
  speechSynthesis.speak(u);
}
async function connectArduino(){
  if(!("serial"in navigator)){$("appMessage").textContent="Web Serial requiere Chrome o Edge de escritorio mediante HTTPS o localhost.";return;}
  try{
    serialPort=await navigator.serial.requestPort();await serialPort.open({baudRate:9600});
    serialWriter=serialPort.writable.getWriter();
    setStatus("serialStatus","serialLed","Conectado",true);
    $("serialMessage").textContent="Puerto abierto · 9600 baudios";
    $("connectBtn").textContent="Arduino conectado";$("connectBtn").disabled=true;
    $("testOnBtn").disabled=false;$("testOffBtn").disabled=false;
    $("appMessage").textContent="Arduino Leonardo conectado correctamente.";
  }catch(e){console.error(e);$("appMessage").textContent=`No se pudo conectar Arduino: ${e.message}`;}
}
async function sendSerial(command){
  if(!serialWriter){$("serialMessage").textContent=`Arduino desconectado; no se envió ${command}.`;return;}
  await serialWriter.write(new TextEncoder().encode(command));
  const on=command==="A";$("ledVisual").classList.toggle("on",on);
  $("ledLabel").textContent=on?"LED encendido":"LED apagado";
  $("serialMessage").textContent=`Comando ${command} enviado correctamente.`;
}
$("startBtn").addEventListener("click",startCamera);
$("stopBtn").addEventListener("click",stopCamera);
$("connectBtn").addEventListener("click",connectArduino);
$("testOnBtn").addEventListener("click",()=>sendSerial("A"));
$("testOffBtn").addEventListener("click",()=>sendSerial("B"));
$("replayBtn").addEventListener("click",()=>{if(lastMessage)speak(lastMessage);});
