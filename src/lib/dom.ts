import { isFriendsPage, isGroupMembersPage } from './pages';
import { pageState } from './state';

export type Targets = {
  numeric: Map<string, Element[]>;
  vanity: Map<string, Element[]>;
};

const addTo = (map: Map<string, Element[]>, key: string, el: Element): void => {
  if (!key) return;
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  if (!arr.includes(el)) arr.push(el);
};

const ignored = (el: Element): boolean =>
  !!el.closest?.('.grouppage_friendsingroup');

export const collectTargets = (): Targets => {
  const numeric = new Map<string, Element[]>();
  const vanity = new Map<string, Element[]>();

  if (isFriendsPage()) {
    document
      .querySelectorAll<HTMLElement>('.friends_content .persona[data-steamid]')
      .forEach((el) => {
        if (ignored(el)) return;
        const id = el.dataset.steamid;
        if (id) addTo(numeric, id, el);
      });
    return { numeric, vanity };
  }

  if (isGroupMembersPage()) {
    const root = document.getElementById('memberList');
    if (!root) return { numeric, vanity };

    const container = (a: Element): Element =>
      a.closest('.member_block, .member_block_ctn, .member_row') ??
      a.parentElement ??
      a;

    root.querySelectorAll<HTMLAnchorElement>('a[href*="/profiles/"]').forEach(
      (a) => {
        const m = a.getAttribute('href')?.match(/\/profiles\/(\d+)/);
        if (m) addTo(numeric, m[1]!, container(a));
      },
    );
    root.querySelectorAll<HTMLAnchorElement>('a[href*="/id/"]').forEach((a) => {
      const m = a.getAttribute('href')?.match(/\/id\/([^/?#]+)/);
      if (m) addTo(vanity, decodeURIComponent(m[1]!), container(a));
    });
  }

  return { numeric, vanity };
};

export const getFriendsSections = (): Array<{
  container: Element;
  end: Element | null;
  items: Element[];
}> => {
  const any = document.querySelector(
    '.friends_content .persona[data-steamid]',
  );
  const container = any?.parentElement;
  if (!container) return [];
  const headers = Array.from(
    container.querySelectorAll('.state_block[data-group]'),
  );
  if (!headers.length) {
    const items = Array.from(
      container.querySelectorAll('.persona[data-steamid]'),
    );
    return [{ container, end: null, items }];
  }
  const out: Array<{
    container: Element;
    end: Element | null;
    items: Element[];
  }> = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i]!;
    const end = headers[i + 1] ?? null;
    const items: Element[] = [];
    let node: Element | null = start.nextElementSibling;
    while (node && node !== end) {
      if (node.matches('.persona[data-steamid]')) items.push(node);
      node = node.nextElementSibling;
    }
    out.push({ container, end, items });
  }
  return out;
};

export const ensureBannedHeader = (container: Element): Element => {
  let header = container.querySelector('.state_block[data-group="banned"]');
  if (header) return header;
  header = document.createElement('div');
  header.className = 'state_block';
  header.id = 'state_banned';
  (header as HTMLElement).dataset.group = 'banned';
  header.textContent = 'Banned';
  const first = container.querySelector('.state_block[data-group]');
  if (first) container.insertBefore(header, first);
  else container.insertBefore(header, container.firstChild);
  return header;
};

export const attachCheckbox = (el: HTMLElement): void => {
  if (el.querySelector('.friendbanmanager-remove-chk')) return;
  if (getComputedStyle(el).position === 'static') {
    el.style.position = 'relative';
  }
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.className = 'friendbanmanager-remove-chk';
  const sid = el.dataset.steamid ?? el.dataset.bannedSteamId ?? '';
  if (sid) {
    chk.name = `friendbanmanager-remove-${sid}`;
    chk.id = `friendbanmanager-remove-${sid}`;
    chk.value = sid;
    chk.setAttribute('aria-label', `Remove friend ${sid}`);
  } else {
    chk.name = 'friendbanmanager-remove';
    chk.setAttribute('aria-label', 'Remove selected friend');
  }
  chk.addEventListener('change', () => updateRemoveButtonState());
  el.appendChild(chk);
};

export const updateRemoveButtonState = (): void => {
  const removeBtn = document.getElementById(
    'friendbanmanager-remove-btn',
  ) as HTMLButtonElement | null;
  if (!removeBtn) return;
  const checked = document.querySelectorAll(
    '.friendbanmanager-remove-chk:checked',
  );
  removeBtn.disabled = checked.length === 0;
  const count = document.getElementById('friendbanmanager-selected-count');
  if (count) count.textContent = `Selected: ${checked.length}`;
  pageState.selectionMode = checked.length > 0 || pageState.selectionMode;
};
