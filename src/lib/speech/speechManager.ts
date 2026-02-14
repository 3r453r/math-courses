type ListeningCallback = (listening: boolean) => void;
type ResultCallback = (text: string) => void;
type ErrorCallback = (message: string) => void;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access denied. Please allow microphone permissions.",
  "no-speech": "No speech detected. Please try again.",
  "audio-capture": "No microphone found. Please connect a microphone.",
  "network": "Network error occurred during speech recognition.",
  "aborted": "Speech recognition was aborted.",
};

export class SpeechManager {
  private recognition: SpeechRecognition | null = null;
  private intentionallyStopped = false;
  private _isListening = false;

  onResult: ResultCallback = () => {};
  onInterim: ResultCallback = () => {};
  onError: ErrorCallback = () => {};
  onListeningChange: ListeningCallback = () => {};

  get isListening(): boolean {
    return this._isListening;
  }

  static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  constructor(lang: string) {
    if (!SpeechManager.isSupported()) return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = lang;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (interimTranscript) {
        this.onInterim(interimTranscript);
      }
      if (finalTranscript) {
        this.onResult(finalTranscript);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" fires when we call stop() — not a real error
      if (event.error === "aborted") return;

      const message = ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}`;
      this.onError(message);

      // Permission denied or no mic — stop completely
      if (event.error === "not-allowed" || event.error === "audio-capture") {
        this.setListening(false);
        this.intentionallyStopped = true;
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if user hasn't explicitly stopped (Safari drops continuous mode)
      if (!this.intentionallyStopped && this._isListening) {
        try {
          this.recognition?.start();
        } catch {
          this.setListening(false);
        }
        return;
      }
      this.setListening(false);
    };
  }

  private setListening(value: boolean) {
    if (this._isListening !== value) {
      this._isListening = value;
      this.onListeningChange(value);
    }
  }

  start() {
    if (!this.recognition || this._isListening) return;
    this.intentionallyStopped = false;
    try {
      this.recognition.start();
      this.setListening(true);
    } catch {
      this.setListening(false);
    }
  }

  stop() {
    if (!this.recognition || !this._isListening) return;
    this.intentionallyStopped = true;
    this.recognition.stop();
  }

  toggle() {
    if (this._isListening) {
      this.stop();
    } else {
      this.start();
    }
  }

  setLang(lang: string) {
    if (!this.recognition) return;
    const wasListening = this._isListening;
    if (wasListening) {
      this.intentionallyStopped = true;
      this.recognition.stop();
      this.setListening(false);
    }
    this.recognition.lang = lang;
    if (wasListening) {
      // Small delay to let the previous session close
      setTimeout(() => this.start(), 100);
    }
  }

  destroy() {
    if (!this.recognition) return;
    this.intentionallyStopped = true;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
    this.setListening(false);
  }
}
