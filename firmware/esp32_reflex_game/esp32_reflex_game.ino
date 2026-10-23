// IRIS Reflex Challenge - ESP32 firmware
// Each button connects its GPIO to GND (INPUT_PULLUP: released = HIGH, pressed = LOW).
// Serial protocol (115200 baud, one line per message): "READY" once at boot,
// then "1".."4" for each debounced press.

// Define button pins
const int button1Pin = 27;
const int button2Pin = 26;
const int button3Pin = 25;
const int button4Pin = 14;

// Debounce delay in milliseconds
const unsigned long debounceDelay = 50;

// Button 1 variables
int button1State = HIGH;
int lastButton1State = HIGH;
unsigned long lastDebounceTime1 = 0;

// Button 2 variables
int button2State = HIGH;
int lastButton2State = HIGH;
unsigned long lastDebounceTime2 = 0;

// Button 3 variables
int button3State = HIGH;
int lastButton3State = HIGH;
unsigned long lastDebounceTime3 = 0;

// Button 4 variables
int button4State = HIGH;
int lastButton4State = HIGH;
unsigned long lastDebounceTime4 = 0;

void setup() {
  Serial.begin(115200);

  // Configure pins as inputs with internal pull-up resistors
  pinMode(button1Pin, INPUT_PULLUP);
  pinMode(button2Pin, INPUT_PULLUP);
  pinMode(button3Pin, INPUT_PULLUP);
  pinMode(button4Pin, INPUT_PULLUP);

  Serial.println("READY");
}

void loop() {
  unsigned long currentTime = millis();

  // --- Button 1 Logic ---
  int reading1 = digitalRead(button1Pin);
  if (reading1 != lastButton1State) {
    lastDebounceTime1 = currentTime;
  }
  if ((currentTime - lastDebounceTime1) > debounceDelay) {
    if (reading1 != button1State) {
      button1State = reading1;
      if (button1State == LOW) {
        Serial.println("1");
      }
    }
  }
  lastButton1State = reading1;

  // --- Button 2 Logic ---
  int reading2 = digitalRead(button2Pin);
  if (reading2 != lastButton2State) {
    lastDebounceTime2 = currentTime;
  }
  if ((currentTime - lastDebounceTime2) > debounceDelay) {
    if (reading2 != button2State) {
      button2State = reading2;
      if (button2State == LOW) {
        Serial.println("2");
      }
    }
  }
  lastButton2State = reading2;

  // --- Button 3 Logic ---
  int reading3 = digitalRead(button3Pin);
  if (reading3 != lastButton3State) {
    lastDebounceTime3 = currentTime;
  }
  if ((currentTime - lastDebounceTime3) > debounceDelay) {
    if (reading3 != button3State) {
      button3State = reading3;
      if (button3State == LOW) {
        Serial.println("3");
      }
    }
  }
  lastButton3State = reading3;

  // --- Button 4 Logic ---
  int reading4 = digitalRead(button4Pin);
  if (reading4 != lastButton4State) {
    lastDebounceTime4 = currentTime;
  }
  if ((currentTime - lastDebounceTime4) > debounceDelay) {
    if (reading4 != button4State) {
      button4State = reading4;
      if (button4State == LOW) {
        Serial.println("4");
      }
    }
  }
  lastButton4State = reading4;
}
