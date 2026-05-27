import { send, type VanityResponse } from './messaging';
import { profileSegment } from './pages';

const STEAMID_RE = /^\d{17}$/;

const readScriptVar = (name: string): string | null => {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]+)"`);
  for (const s of document.querySelectorAll('script')) {
    const m = s.textContent?.match(re);
    if (m) return m[1] ?? null;
  }
  return null;
};

export const getLoggedInId = (): string | null => {
  const fromVar = readScriptVar('g_steamID');
  if (fromVar && STEAMID_RE.test(fromVar) && fromVar !== '0') return fromVar;

  const candidates = [
    '#account_pulldown',
    '#global_actions a[href*="/profiles/"]',
    '.user_avatar a[href*="/profiles/"]',
    '.playerAvatar a[href*="/profiles/"]',
  ];
  for (const sel of candidates) {
    const a = document.querySelector<HTMLAnchorElement>(sel);
    const href = a?.getAttribute('href') ?? '';
    const m = href.match(/\/profiles\/(\d{17})/);
    if (m) return m[1] as string;
  }
  return null;
};

export const getLoggedInVanity = (): string | null => {
  const fromVar = readScriptVar('g_AccountVanityURL');
  if (fromVar) return fromVar;

  const candidates = [
    '#account_pulldown',
    '#global_actions a[href*="/id/"]',
    '.user_avatar a[href*="/id/"]',
    '.playerAvatar a[href*="/id/"]',
  ];
  for (const sel of candidates) {
    const a = document.querySelector<HTMLAnchorElement>(sel);
    const href = a?.getAttribute('href') ?? '';
    const m = href.match(/\/id\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1] as string);
  }
  return null;
};

export const isLoggedIn = (): boolean =>
  getLoggedInId() !== null || getLoggedInVanity() !== null;

export const isOwnFriendsPage = (): boolean => {
  const seg = profileSegment();
  if (!seg) return false;
  if (seg.kind === 'profiles') {
    const me = getLoggedInId();
    return me !== null && me === seg.value;
  }
  const vanity = getLoggedInVanity();
  if (vanity && vanity.toLowerCase() === seg.value.toLowerCase()) return true;
  return false;
};

const vanityResolveCache = new Map<string, string | null>();

export const isOwnFriendsPageVerified = async (): Promise<boolean> => {
  if (isOwnFriendsPage()) return true;

  const seg = profileSegment();
  if (!seg || seg.kind !== 'id') return false;
  const me = getLoggedInId();
  if (!me) return false;

  const key = seg.value.toLowerCase();
  if (vanityResolveCache.has(key)) {
    return vanityResolveCache.get(key) === me;
  }

  const resp = await send<VanityResponse>({
    action: 'resolveVanity',
    vanity: seg.value,
  });
  const resolved = resp.steamid ?? null;
  vanityResolveCache.set(key, resolved);
  return resolved === me;
};
