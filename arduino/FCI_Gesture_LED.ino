/*
  FCI Gesture Assistant - Arduino Leonardo
  Recibe:
    A -> encender LED
    B -> apagar LED
  Conecta un LED externo (con resistencia de 220-330 ohms) al pin 13
  y GND, o utiliza el LED integrado de la placa.
*/

const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.begin(9600);
}

void loop() {
  while (Serial.available() > 0) {
    char command = Serial.read();

    if (command == 'A') {
      digitalWrite(LED_PIN, HIGH);
    } else if (command == 'B') {
      digitalWrite(LED_PIN, LOW);
    }
  }
}
