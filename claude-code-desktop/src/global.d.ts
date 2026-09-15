import type { DesktopApi } from "../electron/types";

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
