const IN_APP_PATTERNS: [RegExp, string][] = [
  [/Messenger|FB_IAB\/Messenger|FBAN\/Messenger/i, "Messenger"],
  [/FBAN|FBAV/i, "Facebook"],
  [/Instagram/i, "Instagram"],
  [/Twitter|(?:^|[\s;])X\/\d/i, "Twitter/X"],
  [/LinkedIn/i, "LinkedIn"],
  [/Line\//i, "LINE"],
  [/GSA\//i, "Google Search"],
  [/Gmail|GoogleMail/i, "Gmail"],
  [/KAKAOTALK/i, "KakaoTalk"],
];

const ANDROID_WEBVIEW_RE = /; wv\)/i;

function getUA(userAgent?: string): string {
  if (userAgent) return userAgent;
  if (typeof navigator !== "undefined") return navigator.userAgent;
  return "";
}

export function isInAppBrowser(userAgent?: string): boolean {
  const ua = getUA(userAgent);
  if (!ua) return false;
  if (IN_APP_PATTERNS.some(([re]) => re.test(ua))) return true;
  if (ANDROID_WEBVIEW_RE.test(ua)) return true;
  return false;
}

export function getInAppBrowserName(userAgent?: string): string | null {
  const ua = getUA(userAgent);
  if (!ua) return null;
  for (const [re, name] of IN_APP_PATTERNS) {
    if (re.test(ua)) return name;
  }
  if (ANDROID_WEBVIEW_RE.test(ua)) return "WebView";
  return null;
}

export function getPlatform(userAgent?: string): "android" | "ios" | "unknown" {
  const ua = getUA(userAgent);
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "unknown";
}

export function getOpenInBrowserUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search + parsed.hash;
    return `intent://${parsed.host}${path}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
  } catch {
    return null;
  }
}
