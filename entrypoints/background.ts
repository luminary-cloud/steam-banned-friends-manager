import type {
  BgRequest,
  BgResponse,
  BansResponse,
  SummariesResponse,
  VanityResponse,
} from '@/src/lib/messaging';

// put your steam web api keys here. get one at https://steamcommunity.com/dev/apikey
const API_KEYS: string[] = [];

const REQUEST_TIMEOUT_MS = 10_000;

const pickKey = (): string => {
  const i = Math.floor(Math.random() * API_KEYS.length);
  return API_KEYS[i] as string;
};

const isSteamId64 = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{17}$/.test(s);

const fetchJson = async (url: string): Promise<unknown> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

const handleBans = async (batch: string[]): Promise<BansResponse> => {
  if (!Array.isArray(batch) || !batch.every(isSteamId64)) {
    return { error: 'invalid batch' };
  }
  const key = pickKey();
  const url =
    `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/` +
    `?key=${key}&steamids=${batch.join(',')}`;
  try {
    const json = (await fetchJson(url)) as BansResponse['json'];
    return { json };
  } catch (e) {
    return { error: String(e) };
  }
};

const handleSummaries = async (
  batch: string[],
): Promise<SummariesResponse> => {
  if (!Array.isArray(batch) || !batch.every(isSteamId64)) {
    return { error: 'invalid batch' };
  }
  const key = pickKey();
  const url =
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
    `?key=${key}&steamids=${batch.join(',')}`;
  try {
    const json = (await fetchJson(url)) as SummariesResponse['json'];
    return { json };
  } catch (e) {
    return { error: String(e) };
  }
};

const handleVanity = async (vanity: string): Promise<VanityResponse> => {
  if (typeof vanity !== 'string' || !vanity) {
    return { error: 'invalid vanity' };
  }
  const key = pickKey();
  const url =
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/` +
    `?key=${key}&vanityurl=${encodeURIComponent(vanity)}`;
  try {
    const json = (await fetchJson(url)) as {
      response?: { success?: number; steamid?: string; message?: string };
    };
    const r = json.response;
    if (r?.success === 1 && r.steamid) return { steamid: r.steamid };
    return { error: r?.message ?? 'resolve failed' };
  } catch (e) {
    return { error: String(e) };
  }
};

const route = async (req: BgRequest): Promise<BgResponse> => {
  switch (req.action) {
    case 'fetchBans':
      return handleBans(req.batch);
    case 'fetchSummaries':
      return handleSummaries(req.batch);
    case 'resolveVanity':
      return handleVanity(req.vanity);
    default:
      return { error: 'unknown action' };
  }
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    route(message as BgRequest)
      .then((resp) => sendResponse(resp))
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  });
});
