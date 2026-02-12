import { createSignal } from "solid-js";
import { DEFAULT_API_URL } from "@/lib/constants";

const STORAGE_KEY = "duckling_api_url";

function loadApiUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

const [apiUrl, setApiUrlSignal] = createSignal(loadApiUrl());

export function setApiUrl(url: string) {
  const trimmed = url.replace(/\/+$/, "");
  setApiUrlSignal(trimmed);
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // localStorage unavailable
  }
}

export { apiUrl };
