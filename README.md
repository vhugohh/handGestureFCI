# FCI Gesture Assistant 2.0 — UNACAR

Aplicación web que reconoce siete gestos con MediaPipe, reproduce mensajes mediante síntesis de voz y controla un LED conectado a Arduino Leonardo.

## Mejoras 2.0
- Interfaz institucional tipográfica UNACAR × FCI.
- Animación de entrada y animación al identificar cada gesto.
- Dibujo de los 21 hand landmarks y conexiones de la mano.
- Puntas de los dedos resaltadas.
- Seguimiento de hasta dos manos y contador de manos.
- Porcentaje de confianza y barra visual.
- Panel de voz con botón para repetir.
- Panel de estado y pruebas manuales de Arduino.

## Nota sobre logotipos
No se proporcionó un archivo oficial de los logotipos. Por ello el encabezado utiliza una **identificación tipográfica temporal** (UNACAR y FCI), no una reproducción del escudo oficial. El sitio de UNACAR publica sus símbolos e identidad visual:
- https://www.unacar.mx/historia/
- Guía/identidad institucional: https://www.unacar.mx/unacar/Documentos/logotipo22-26/EDUCANDO-VF-SLOGAN-%28IDENTIDAD%29.pdf

Cuando se disponga de los archivos gráficos autorizados, pueden guardarse en `assets/` y reemplazar los bloques `.brand-seal` y `.fci-mark` en `index.html` por elementos `<img>`.

## Requisitos
- Chrome o Microsoft Edge actualizado.
- Cámara web.
- Internet para descargar MediaPipe y el modelo.
- Arduino Leonardo para el LED.
- HTTPS o `localhost` para cámara y Web Serial.

## Ejecutar localmente
1. Instala Python 3.
2. En la carpeta del proyecto ejecuta `python server.py`.
3. Abre `http://localhost:8000` en Chrome o Edge.
4. Pulsa **Iniciar cámara** y concede permiso.
5. Abre `arduino/FCI_Gesture_LED.ino` en Arduino IDE, selecciona Arduino Leonardo y carga el programa.
6. Cierra el Monitor Serie del IDE.
7. Pulsa **Conectar Arduino** y selecciona el puerto COM.

No abras `index.html` directamente con `file://`.

## Gestos
| MediaPipe | Respuesta |
|---|---|
| Closed_Fist | Despedida |
| Open_Palm | Bienvenida |
| Pointing_Up | Presentación de carreras |
| Thumb_Up | Voz + comando `A` para encender LED |
| Thumb_Down | Voz + comando `B` para apagar LED |
| ILoveYou | Mensaje I Love You |
| Victory | Mensaje Peace / Victory |

El gesto se activa después de cinco fotogramas consecutivos y una confianza mínima del 65 %.

## Arduino
El sketch utiliza el LED integrado del pin 13. Para un LED externo: pin 13 → resistencia 220–330 Ω → ánodo del LED; cátodo → GND.
- `A`: encender.
- `B`: apagar.
- 9600 baudios.

## GitHub y Render
1. Sube el contenido de esta carpeta a GitHub.
2. En Render crea un **Static Site** conectado al repositorio.
3. Build Command: vacío.
4. Publish Directory: `.`.
5. Despliega.

Render sirve los archivos web. La cámara y Arduino son los dispositivos locales de cada visitante; no se conectan al servidor.

## Privacidad y compatibilidad
El video se procesa en el navegador y no se transmite al servidor. El modelo se descarga desde CDN. Web Serial funciona en Chrome/Edge de escritorio y requiere autorización del usuario. La voz `es-MX` depende de las voces disponibles en el sistema operativo.
