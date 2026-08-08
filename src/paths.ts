export const APP_BASE_PATH = '/mask-unmask';
export const APP_HOME_PATH = `${APP_BASE_PATH}/`;
export const PRIVACY_PATH = `${APP_BASE_PATH}/safety-and-privacy`;

export const APP_PUBLIC_ASSET_BASE = import.meta.env.BASE_URL;

export function normalizeAppPath(path: string): string {
  const normalized = path.trim().replace(/\/+$/, '');
  return normalized || '/';
}
