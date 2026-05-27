import { updateRemoveButtonState } from './dom';
import { getLoggedInId } from './identity';
import { isFriendsPage } from './pages';

const readSessionId = (): string | null => {
  for (const s of document.querySelectorAll('script')) {
    const m = s.textContent?.match(/g_sessionID\s*=\s*"([^"]+)"/);
    if (m) return m[1] ?? null;
  }
  try {
    const cookie = document.cookie ?? '';
    const m = cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
    if (m) return decodeURIComponent(m[1] as string);
  } catch {
    /* ignore */
  }
  return null;
};

const findSteamId = (chk: HTMLInputElement): string | null => {
  const persona = chk.closest<HTMLElement>('.persona');
  const id = persona?.dataset.steamid ?? persona?.dataset.bannedSteamId ?? null;
  if (id) return id;
  const link = persona?.querySelector<HTMLAnchorElement>(
    'a[href*="/profiles/"]',
  );
  const m = link?.getAttribute('href')?.match(/\/profiles\/(\d+)/);
  return m ? (m[1] ?? null) : null;
};

const setStatus = (text: string): void => {
  const el = document.getElementById('friendbanmanager-remove-status');
  if (el) el.textContent = text;
};

export const removeSelectedFriends = async (
  removeBtn: HTMLButtonElement,
): Promise<void> => {
  const checked = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      '.friendbanmanager-remove-chk:checked',
    ),
  );
  if (!checked.length) return;

  if (!isFriendsPage()) {
    setStatus('Navigate to your Friends page to remove.');
    return;
  }

  const confirmMsg = `Are you sure you want to remove ${checked.length} friend${
    checked.length > 1 ? 's' : ''
  } from your friends list?`;
  if (!window.confirm(confirmMsg)) return;

  removeBtn.disabled = true;
  setStatus('Removing...');

  const sid = readSessionId();
  if (!sid) {
    setStatus('Could not find session id; removal aborted.');
    return;
  }
  const me = getLoggedInId();
  if (!me) {
    setStatus('Could not detect your account; removal aborted.');
    return;
  }

  const basePath = location.pathname.replace(/\/friends.*$/, '');
  const actionUrl = `${location.origin}${basePath}/friends/action`;

  let success = 0;
  let fail = 0;

  for (const chk of checked) {
    const steamid = findSteamId(chk);
    if (!steamid) {
      fail++;
      continue;
    }
    const params = new URLSearchParams({
      sessionid: sid,
      steamid: me,
      ajax: '1',
      action: 'remove',
    });
    params.append('steamids[]', steamid);

    try {
      const resp = await fetch(actionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          Referer: location.href,
          Origin: 'https://steamcommunity.com',
        },
        body: params.toString(),
        credentials: 'include',
      });
      if (resp.ok) {
        success++;
        const persona = chk.closest<HTMLElement>('.persona');
        if (persona) {
          persona.style.opacity = '0.4';
          persona.style.pointerEvents = 'none';
        }
        chk.disabled = true;
      } else {
        fail++;
        const body = await resp.text().catch(() => '');
        if (body.trim() === 'false') {
          setStatus(
            'Steam refused removal. Try reloading your friends page.',
          );
        }
      }
    } catch {
      fail++;
    }
  }

  setStatus(`Done. Removed ${success}. Failed ${fail}.`);
  updateRemoveButtonState();
  if (success > 0) {
    setTimeout(() => location.reload(), 1500);
  }
};
