import { renderBan, renderVisibility } from './bans';
import { collectTargets } from './dom';
import { send } from './messaging';
import type {
  BansResponse,
  PlayerBan,
  PlayerSummary,
  SummariesResponse,
  VanityResponse,
} from './messaging';
import { isFriendsPage, isGroupMembersPage } from './pages';
import { applyMoveBansToTopSection } from './sort';
import { pageState } from './state';
import {
  setSortEnabled,
  setToolbarEnabled,
  updateProgress as toolbarUpdateProgress,
} from './toolbar';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const BATCH_SIZE = 100;
const CONCURRENCY = 3;

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const runWithConcurrency = async <T>(
  limit: number,
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  if (!items.length) return;
  let idx = 0;
  let active = 0;
  return new Promise<void>((resolve) => {
    const next = (): void => {
      while (active < limit && idx < items.length) {
        const cur = items[idx++]!;
        active++;
        worker(cur)
          .catch(() => {})
          .finally(() => {
            active--;
            if (idx >= items.length && active === 0) resolve();
            else next();
          });
      }
    };
    next();
  });
};

const wait = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export const checkBans = async (): Promise<void> => {
  const onFriends = isFriendsPage();
  const onMembers = isGroupMembersPage();
  if (!onFriends && !onMembers) return;
  if (pageState.scanInProgress || pageState.scanCompleted) return;

  pageState.scanInProgress = true;
  const { numeric, vanity } = collectTargets();

  if (vanity.size) {
    const names = Array.from(vanity.keys());
    await runWithConcurrency(5, names, async (name) => {
      const resp = await send<VanityResponse>({
        action: 'resolveVanity',
        vanity: name,
      });
      const id = resp.steamid;
      if (!id) return;
      const els = vanity.get(name) ?? [];
      let arr = numeric.get(id);
      if (!arr) {
        arr = [];
        numeric.set(id, arr);
      }
      for (const el of els) if (!arr.includes(el)) arr.push(el);
    });
  }

  const ids = Array.from(numeric.keys());
  const batches = chunk(ids, BATCH_SIZE);
  const total = ids.length;
  const loaded = new Set<string>();

  toolbarUpdateProgress(loaded.size, total);
  if (!batches.length) {
    pageState.scanInProgress = false;
    return;
  }

  let bansLeft = batches.length;
  let summariesLeft = batches.length;

  const finishIfDone = (): void => {
    if (bansLeft === 0 && summariesLeft === 0) {
      pageState.scanInProgress = false;
      pageState.scanCompleted = true;
      setToolbarEnabled(true);
      setSortEnabled(true);
      if (pageState.sortedMode) applyMoveBansToTopSection();
    }
  };

  const applyBans = (players: PlayerBan[]): void => {
    for (const p of players) {
      const els = numeric.get(p.SteamId) ?? [];
      for (const el of els) renderBan(el as HTMLElement, p, onMembers);
      if (!loaded.has(p.SteamId)) loaded.add(p.SteamId);
    }
    toolbarUpdateProgress(loaded.size, total);
  };

  const applySummaries = (players: PlayerSummary[]): void => {
    for (const p of players) {
      const els = numeric.get(p.steamid) ?? [];
      for (const el of els) renderVisibility(el as HTMLElement, p);
    }
  };

  const fetchBansBatch = async (batch: string[], retries: number): Promise<void> => {
    const resp = await send<BansResponse>({ action: 'fetchBans', batch });
    if (resp.error !== undefined && resp.error !== null) {
      if (retries > 0) {
        await wait(RETRY_DELAY_MS);
        return fetchBansBatch(batch, retries - 1);
      }
      bansLeft = Math.max(0, bansLeft - 1);
      finishIfDone();
      return;
    }
    const players = resp.json?.players;
    if (Array.isArray(players)) applyBans(players);
    bansLeft = Math.max(0, bansLeft - 1);
    finishIfDone();
  };

  const fetchSummariesBatch = async (
    batch: string[],
    retries: number,
  ): Promise<void> => {
    const resp = await send<SummariesResponse>({
      action: 'fetchSummaries',
      batch,
    });
    if (resp.error !== undefined && resp.error !== null) {
      if (retries > 0) {
        await wait(RETRY_DELAY_MS);
        return fetchSummariesBatch(batch, retries - 1);
      }
      summariesLeft = Math.max(0, summariesLeft - 1);
      finishIfDone();
      return;
    }
    const players = resp.json?.response?.players;
    if (Array.isArray(players)) applySummaries(players);
    summariesLeft = Math.max(0, summariesLeft - 1);
    finishIfDone();
  };

  runWithConcurrency(CONCURRENCY, batches, (b) =>
    fetchBansBatch(b, MAX_RETRIES),
  );
  runWithConcurrency(CONCURRENCY, batches, (b) =>
    fetchSummariesBatch(b, MAX_RETRIES),
  );
};
