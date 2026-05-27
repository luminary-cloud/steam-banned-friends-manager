import { ensureBannedHeader, getFriendsSections } from './dom';
import { isFriendsPage } from './pages';
import { pageState } from './state';

const isBanned = (el: Element): boolean => {
  const d = (el as HTMLElement).dataset;
  return (
    d.vacban === '1' ||
    d.gameban === '1' ||
    d.communityban === '1' ||
    d.tradeban === '1'
  );
};

export const snapshotOriginalOrder = (): void => {
  const sections = getFriendsSections();
  pageState.originalOrder = sections.map((s) => ({
    container: s.container,
    end: s.end,
    items: s.items.slice(),
  }));
};

export const applyMoveBansToTopSection = (): void => {
  const sections = getFriendsSections();
  if (!sections.length) return;
  const container = sections[0]!.container;
  const header = ensureBannedHeader(container);
  const ordered: Element[] = [];
  const source = pageState.originalOrder ?? sections;
  for (const s of source) {
    for (const el of s.items) ordered.push(el);
  }
  const banned = ordered.filter((el) => isBanned(el));
  for (const el of banned) container.insertBefore(el, header.nextSibling);
};

export const restoreOriginalOrder = (): void => {
  const order = pageState.originalOrder;
  if (!order || !order.length) return;
  for (const { container, end, items } of order) {
    if (!container) continue;
    for (const el of items) {
      if (end) container.insertBefore(el, end);
      else container.appendChild(el);
    }
  }
  const any = document.querySelector('.friends_content .persona[data-steamid]');
  const container = any?.parentElement;
  const header = container?.querySelector(
    '.state_block[data-group="banned"]',
  );
  header?.remove();
};

export const insertHeaderSortButton = (
  onToggle: () => void,
): HTMLButtonElement | null => {
  if (!isFriendsPage()) return null;
  const headerBar = document.querySelector('.profile_friends.title_bar');
  if (!headerBar) return null;
  const existing = document.getElementById(
    'friendbanmanager-sort-header-btn',
  ) as HTMLButtonElement | null;
  if (existing) return existing;

  const btn = document.createElement('button');
  btn.id = 'friendbanmanager-sort-header-btn';
  btn.className = 'profile_friends manage_link btnv6_blue_hoverfade btn_medium';
  btn.style.marginLeft = '8px';
  const span = document.createElement('span');
  span.textContent = 'Show banned section';
  btn.appendChild(span);
  btn.disabled = true;
  btn.addEventListener('click', onToggle);

  const addBtn = document.getElementById('add_friends_button');
  if (addBtn && addBtn.parentElement === headerBar) {
    headerBar.insertBefore(btn, addBtn.nextSibling);
  } else {
    headerBar.appendChild(btn);
  }
  return btn;
};
