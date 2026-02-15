import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpeechManager } from "./speechManager";

// Mock SpeechRecognition — must be a real class so `new` works
let mockInstance: MockSpeechRecognition;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn();

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    mockInstance = this;
  }
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    SpeechRecognition: MockSpeechRecognition,
  };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

describe("SpeechManager", () => {
  describe("isSupported", () => {
    it("returns true when SpeechRecognition is available", () => {
      expect(SpeechManager.isSupported()).toBe(true);
    });

    it("returns true when webkitSpeechRecognition is available", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = {
        webkitSpeechRecognition: MockSpeechRecognition,
      };
      expect(SpeechManager.isSupported()).toBe(true);
    });

    it("returns false when no SpeechRecognition is available", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = {};
      expect(SpeechManager.isSupported()).toBe(false);
    });
  });

  describe("constructor", () => {
    it("configures recognition with continuous and interim results", () => {
      new SpeechManager("en-US");
      expect(mockInstance.continuous).toBe(true);
      expect(mockInstance.interimResults).toBe(true);
      expect(mockInstance.lang).toBe("en-US");
    });
  });

  describe("start", () => {
    it("starts recognition and sets isListening to true", () => {
      const manager = new SpeechManager("en-US");
      const listeningChanges: boolean[] = [];
      manager.onListeningChange = (v) => listeningChanges.push(v);

      manager.start();

      expect(mockInstance.start).toHaveBeenCalled();
      expect(manager.isListening).toBe(true);
      expect(listeningChanges).toEqual([true]);
    });

    it("does not start if already listening", () => {
      const manager = new SpeechManager("en-US");
      manager.start();
      mockInstance.start.mockClear();

      manager.start();

      expect(mockInstance.start).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("stops recognition", () => {
      const manager = new SpeechManager("en-US");
      manager.start();

      manager.stop();

      expect(mockInstance.stop).toHaveBeenCalled();
    });

    it("does not stop if not listening", () => {
      const manager = new SpeechManager("en-US");

      manager.stop();

      expect(mockInstance.stop).not.toHaveBeenCalled();
    });
  });

  describe("toggle", () => {
    it("starts when not listening", () => {
      const manager = new SpeechManager("en-US");

      manager.toggle();

      expect(mockInstance.start).toHaveBeenCalled();
      expect(manager.isListening).toBe(true);
    });

    it("stops when listening", () => {
      const manager = new SpeechManager("en-US");
      manager.start();

      manager.toggle();

      expect(mockInstance.stop).toHaveBeenCalled();
    });
  });

  describe("event handling", () => {
    it("calls onResult with final transcript", () => {
      const manager = new SpeechManager("en-US");
      const results: string[] = [];
      manager.onResult = (text) => results.push(text);
      manager.start();

      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: true, 0: { transcript: "hello world" }, length: 1 },
        },
      });

      expect(results).toEqual(["hello world"]);
    });

    it("calls onInterim with interim transcript", () => {
      const manager = new SpeechManager("en-US");
      const interims: string[] = [];
      manager.onInterim = (text) => interims.push(text);
      manager.start();

      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: false, 0: { transcript: "hel" }, length: 1 },
        },
      });

      expect(interims).toEqual(["hel"]);
    });

    it("calls onError with mapped error message for not-allowed", () => {
      const manager = new SpeechManager("en-US");
      const errors: string[] = [];
      manager.onError = (msg) => errors.push(msg);
      manager.start();

      mockInstance.onerror?.({ error: "not-allowed", message: "" });

      expect(errors[0]).toContain("Microphone access denied");
    });

    it("calls onError with mapped message for no-speech", () => {
      const manager = new SpeechManager("en-US");
      const errors: string[] = [];
      manager.onError = (msg) => errors.push(msg);
      manager.start();

      mockInstance.onerror?.({ error: "no-speech", message: "" });

      expect(errors[0]).toContain("No speech detected");
    });

    it("ignores aborted errors", () => {
      const manager = new SpeechManager("en-US");
      const errors: string[] = [];
      manager.onError = (msg) => errors.push(msg);
      manager.start();

      mockInstance.onerror?.({ error: "aborted", message: "" });

      expect(errors).toEqual([]);
    });

    it("stops listening on permission denied", () => {
      const manager = new SpeechManager("en-US");
      manager.start();

      mockInstance.onerror?.({ error: "not-allowed", message: "" });

      expect(manager.isListening).toBe(false);
    });
  });

  describe("auto-restart on end", () => {
    it("restarts when ended without intentional stop", () => {
      const manager = new SpeechManager("en-US");
      manager.start();
      mockInstance.start.mockClear();

      // Simulate recognition ending on its own (e.g., Safari quirk)
      mockInstance.onend?.();

      expect(mockInstance.start).toHaveBeenCalled();
      expect(manager.isListening).toBe(true);
    });

    it("does not restart after intentional stop", () => {
      const manager = new SpeechManager("en-US");
      manager.start();
      manager.stop();
      mockInstance.start.mockClear();

      mockInstance.onend?.();

      expect(mockInstance.start).not.toHaveBeenCalled();
    });
  });

  describe("setLang", () => {
    it("changes the recognition language", () => {
      const manager = new SpeechManager("en-US");

      manager.setLang("pl-PL");

      expect(mockInstance.lang).toBe("pl-PL");
    });

    it("restarts recognition if was listening", () => {
      vi.useFakeTimers();
      const manager = new SpeechManager("en-US");
      manager.start();
      mockInstance.start.mockClear();

      manager.setLang("pl-PL");

      expect(mockInstance.stop).toHaveBeenCalled();
      expect(mockInstance.lang).toBe("pl-PL");

      vi.advanceTimersByTime(150);
      expect(mockInstance.start).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("destroy", () => {
    it("stops and nullifies the recognition instance", () => {
      const manager = new SpeechManager("en-US");
      manager.start();

      manager.destroy();

      expect(mockInstance.stop).toHaveBeenCalled();
      expect(manager.isListening).toBe(false);
    });

    it("is safe to call multiple times", () => {
      const manager = new SpeechManager("en-US");
      manager.destroy();
      manager.destroy(); // should not throw
    });
  });
});
