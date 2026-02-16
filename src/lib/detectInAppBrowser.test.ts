import { describe, it, expect } from "vitest";
import {
  isInAppBrowser,
  getInAppBrowserName,
  getPlatform,
  getOpenInBrowserUrl,
} from "./detectInAppBrowser";

describe("isInAppBrowser", () => {
  const inAppUAs = [
    ["Facebook Android", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.71 Mobile Safari/537.36 [FBAN/FB4A;FBAV/375.0.0.23.107]"],
    ["Messenger iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20A362 [FBAN/MessengerForiOS;FBAV/400.0]"],
    ["Messenger Android", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0 Mobile Safari/537.36 [FB_IAB/Messenger;FBAV/400.0]"],
    ["Instagram", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20A362 Instagram 250.0"],
    ["Twitter", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0 Mobile Safari/537.36 Twitter for Android"],
    ["X app", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 X/8.0"],
    ["LinkedIn", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0 Mobile Safari/537.36 LinkedIn/1.0"],
    ["LINE", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Line/12.0"],
    ["Gmail", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0 Mobile Safari/537.36 Gmail/2023.01"],
    ["Google Search App", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/220.0"],
    ["KakaoTalk", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/103.0 Mobile Safari/537.36 KAKAOTALK 10.0"],
    ["Android WebView", "Mozilla/5.0 (Linux; Android 12; SM-G991B Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0 Mobile Safari/537.36"],
  ];

  it.each(inAppUAs)("detects %s as in-app browser", (_name, ua) => {
    expect(isInAppBrowser(ua)).toBe(true);
  });

  const normalUAs = [
    ["Chrome Android", "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.71 Mobile Safari/537.36"],
    ["Safari iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"],
    ["Firefox", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:103.0) Gecko/20100101 Firefox/103.0"],
    ["Edge", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.134 Safari/537.36 Edg/103.0.1264.71"],
    ["Chrome Desktop", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.134 Safari/537.36"],
  ];

  it.each(normalUAs)("does NOT detect %s as in-app browser", (_name, ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isInAppBrowser("")).toBe(false);
  });
});

describe("getInAppBrowserName", () => {
  it("returns 'Messenger' for Messenger iOS UA", () => {
    expect(getInAppBrowserName("Mozilla/5.0 [FBAN/MessengerForiOS;FBAV/400.0]")).toBe("Messenger");
  });

  it("returns 'Messenger' for Messenger Android UA", () => {
    expect(getInAppBrowserName("Mozilla/5.0 [FB_IAB/Messenger;FBAV/400.0]")).toBe("Messenger");
  });

  it("returns 'Facebook' for FB app UA (not Messenger)", () => {
    expect(getInAppBrowserName("Mozilla/5.0 [FBAN/FB4A;FBAV/375.0]")).toBe("Facebook");
  });

  it("returns 'Instagram' for Instagram UA", () => {
    expect(getInAppBrowserName("Mozilla/5.0 Instagram 250.0")).toBe("Instagram");
  });

  it("returns 'Gmail' for Gmail UA", () => {
    expect(getInAppBrowserName("Mozilla/5.0 Gmail/2023.01")).toBe("Gmail");
  });

  it("returns 'WebView' for generic Android WebView", () => {
    expect(getInAppBrowserName("Mozilla/5.0 (Linux; Android 12; wv) Chrome/103.0")).toBe("WebView");
  });

  it("returns null for normal Chrome UA", () => {
    expect(getInAppBrowserName("Mozilla/5.0 Chrome/103.0 Safari/537.36")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getInAppBrowserName("")).toBeNull();
  });
});

describe("getPlatform", () => {
  it("detects Android", () => {
    expect(getPlatform("Mozilla/5.0 (Linux; Android 12) Chrome/103.0")).toBe("android");
  });

  it("detects iOS (iPhone)", () => {
    expect(getPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)")).toBe("ios");
  });

  it("detects iOS (iPad)", () => {
    expect(getPlatform("Mozilla/5.0 (iPad; CPU OS 16_0)")).toBe("ios");
  });

  it("returns unknown for desktop", () => {
    expect(getPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("unknown");
  });
});

describe("getOpenInBrowserUrl", () => {
  it("generates correct intent:// URL", () => {
    const result = getOpenInBrowserUrl("https://example.com/login?callback=/");
    expect(result).toBe(
      "intent://example.com/login?callback=/#Intent;scheme=https;action=android.intent.action.VIEW;end"
    );
  });

  it("handles URL with path and hash", () => {
    const result = getOpenInBrowserUrl("https://app.example.com/page#section");
    expect(result).toBe(
      "intent://app.example.com/page#section#Intent;scheme=https;action=android.intent.action.VIEW;end"
    );
  });

  it("returns null for invalid URL", () => {
    expect(getOpenInBrowserUrl("not-a-url")).toBeNull();
  });
});
