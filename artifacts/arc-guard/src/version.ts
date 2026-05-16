// __APP_VERSION__ and __APP_BUILD_TYPE__ are injected at build time via vite.config.ts define block.
// In local dev they default to "1.0" and "dev" respectively.
declare const __APP_VERSION__: string;
declare const __APP_BUILD_TYPE__: string;

export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_TYPE: string  = __APP_BUILD_TYPE__;

export const isStable = BUILD_TYPE === "stable";
export const isTest   = BUILD_TYPE === "test";
export const isDev    = BUILD_TYPE === "dev";

/** Full label e.g. "Stable v1.0", "Test v1.1", "Dev" */
export function buildLabel(): string {
  if (isStable) return `Stable v${APP_VERSION}`;
  if (isTest)   return `Test v${APP_VERSION}`;
  return "Dev";
}
