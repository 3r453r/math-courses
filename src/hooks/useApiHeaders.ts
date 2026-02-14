import { useAppStore } from "@/stores/appStore";

export function useApiHeaders(): Record<string, string> {
  const apiKeys = useAppStore((s) => s.apiKeys);
  return {
    "Content-Type": "application/json",
    "x-api-keys": JSON.stringify(apiKeys),
  };
}
