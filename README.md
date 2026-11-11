# FCI Gesture Assistant

Aplicación web para reconocer siete gestos de mano con MediaPipe, reproducir mensajes en español mediante TTS y controlar un LED conectado a Arduino Leonardo.

## Características

- Reconocimiento de `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `ILoveYou` y `Victory`.
- Procesamiento de cámara en el navegador.
- Síntesis de voz en español mexicano (`es-MX`) mediante Web Speech API.
- Comunicación serial con Arduino Leonardo mediante Web Serial API.
- Filtro de confianza y estabilización de cinco fotogramas para reducir activaciones accidentales.
- Botones para probar el encendido y apagado del LED.

## Requisitos

- Google Chrome o Microsoft Edge actualizado.
- Cámara web.
- Conexión a Internet para cargar MediaPipe y el modelo en la primera ejecución.
- Arduino Leonardo y cable USB para la función del LED.
- Para cámara y puerto serie: HTTPS o `localhost`.

## Ejecutar localmente

1. Instala Python 3.
2. Abre una terminal dentro de esta carpeta.
3. Ejecuta:

   ```bash
   python server.py
   ```

4. Abre `http://localhost:8000` en Chrome o Edge.
5. Presiona **Iniciar cámara** y concede permiso.
6. Para controlar el LED, carga `arduino/FCI_Gesture_LED.ino` en el Arduino Leonardo desde Arduino IDE.
7. Cierra el Monitor Serie del IDE si está abierto.
8. En la aplicación, presiona **Conectar Arduino** y selecciona el puerto correspondiente.

No abras `index.html` directamente con `file://`: utiliza el servidor local.

## Conexión del LED

El sketch utiliza el LED integrado del pin 13 del Leonardo. Para un LED externo:

- Pin 13 -> resistencia de 220 a 330 ohms -> ánodo (pata larga) del LED.
- Cátodo (pata corta) -> GND.

El comando `A` enciende y `B` apaga.

## Publicar en GitHub y Render

1. Crea un repositorio en GitHub y sube todos los archivos.
2. En Render selecciona **New > Static Site**.
3. Conecta el repositorio.
4. Usa la rama principal, deja vacío el comando de compilación y establece `.` como directorio de publicación.
5. Despliega el sitio.

Render publica el frontend mediante HTTPS. El navegador del visitante debe tener conectados su propia cámara y Arduino. El Arduino no se conecta al servidor Render.

## Notas y solución de problemas

- Si la cámara no abre, verifica permisos del sitio y que otra aplicación no la esté utilizando.
- Si el modelo no carga, comprueba la conexión a Internet y recarga.
- Si no se escucha voz, revisa el volumen y que el navegador permita audio.
- La voz disponible depende de las voces instaladas en el sistema operativo. `es-MX` solicita español de México, pero no garantiza una voz específica.
- Web Serial no está disponible en todos los navegadores. Usa Chrome o Edge de escritorio.
- El usuario debe autorizar la selección del puerto desde el botón de conexión.
- Si Arduino no responde, verifica que el Monitor Serie esté cerrado y que la velocidad sea 9600 baudios.
- El LED solo cambia cuando el puerto serie está conectado. La voz se reproduce aunque Arduino no esté conectado.

## Privacidad

El video se procesa en el navegador. Esta aplicación no transmite ni almacena imágenes de la cámara. MediaPipe y el modelo se descargan desde sus CDN oficiales.
