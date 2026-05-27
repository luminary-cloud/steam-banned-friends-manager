import { attachCheckbox, updateRemoveButtonState } from './dom';
import { isLoggedIn, isOwnFriendsPage } from './identity';
import { isFriendsPage } from './pages';
import { removeSelectedFriends } from './remove';
import {
  applyMoveBansToTopSection,
  insertHeaderSortButton,
  restoreOriginalOrder,
  snapshotOriginalOrder,
} from './sort';
import { pageState } from './state';

const TOOLBAR_ID = 'friendbanmanager-toolbar';
const SORT_BTN_ID = 'friendbanmanager-sort-header-btn';

export const shouldShowToolbar = (verifiedOwn?: boolean): boolean =>
  isLoggedIn() && isFriendsPage() && (verifiedOwn ?? isOwnFriendsPage());

export const removeToolbar = (): void => {
  document.getElementById(TOOLBAR_ID)?.remove();
  document.getElementById(SORT_BTN_ID)?.remove();
};

export const setToolbarEnabled = (enabled: boolean): void => {
  const toolbar = document.getElementById(TOOLBAR_ID);
  if (!toolbar) return;
  toolbar
    .querySelectorAll<HTMLButtonElement>('button.friendbanmanager-btn')
    .forEach((b) => {
      b.disabled = !enabled;
    });
  if (enabled) updateRemoveButtonState();
};

export const setSortEnabled = (enabled: boolean): void => {
  const btn = document.getElementById(
    SORT_BTN_ID,
  ) as HTMLButtonElement | null;
  if (btn) btn.disabled = !enabled;
};

export const updateProgress = (loaded: number, total: number): void => {
  const el = document.getElementById('friendbanmanager-load-progress');
  if (!el) return;
  el.textContent = total ? `Loaded ${loaded} / ${total}` : '';
};

const onToggleSelection = (toggleBtn: HTMLButtonElement): void => {
  pageState.selectionMode = !pageState.selectionMode;
  toggleBtn.textContent = pageState.selectionMode
    ? 'Cancel selection'
    : 'Select banned friends';
  if (pageState.selectionMode) {
    document
      .querySelectorAll<HTMLElement>('.friendbanmanager-banned')
      .forEach((el) => attachCheckbox(el));
  } else {
    document
      .querySelectorAll('.friendbanmanager-remove-chk')
      .forEach((c) => c.remove());
    const count = document.getElementById('friendbanmanager-selected-count');
    if (count) count.textContent = 'Selected: 0';
  }
  updateRemoveButtonState();
};

const selectByTypes = (types: string[]): void => {
  if (!pageState.selectionMode) {
    const toggle = document.querySelector<HTMLButtonElement>(
      '.friendbanmanager-btn--toggle',
    );
    toggle?.click();
  }
  document
    .querySelectorAll<HTMLElement>('.friendbanmanager-target')
    .forEach((el) => {
      const matches = types.some((t) => el.dataset[t] === '1');
      if (!matches) return;
      attachCheckbox(el);
      const chk = el.querySelector<HTMLInputElement>(
        '.friendbanmanager-remove-chk',
      );
      if (chk) chk.checked = true;
    });
  updateRemoveButtonState();
};

const makeSelectBtn = (
  label: string,
  types: string[],
  variant: string,
): HTMLButtonElement => {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = `friendbanmanager-btn friendbanmanager-btn--${variant}`;
  if (variant === 'private') b.id = 'friendbanmanager-btn-private';
  b.addEventListener('click', () => selectByTypes(types));
  return b;
};

const onSortToggle = (): void => {
  if (!pageState.sortedMode) {
    snapshotOriginalOrder();
    applyMoveBansToTopSection();
    pageState.sortedMode = true;
  } else {
    restoreOriginalOrder();
    pageState.sortedMode = false;
  }
};

export const createToolbar = (verifiedOwn?: boolean): HTMLElement | null => {
  if (!shouldShowToolbar(verifiedOwn)) return null;
  if (document.getElementById(TOOLBAR_ID)) return null;

  const friendsHeader = document.querySelector(
    '.friends_header, .friends_header_pending, .manage_friends_header, .friends_header_label',
  );

  const toolbar = document.createElement('div');
  toolbar.id = TOOLBAR_ID;
  toolbar.className = 'friendbanmanager-toolbar';

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Select banned friends';
  toggleBtn.className = 'friendbanmanager-btn friendbanmanager-btn--toggle';
  toggleBtn.addEventListener('click', () => onToggleSelection(toggleBtn));
  toolbar.appendChild(toggleBtn);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'friendbanmanager-btn-group';
  const filters: Array<[string, string[], string]> = [
    ['VAC', ['vacban'], 'vac'],
    ['Game', ['gameban'], 'game'],
    ['Comm', ['communityban'], 'comm'],
    ['Trade', ['tradeban'], 'trade'],
    ['Private', ['privateprofile'], 'private'],
    ['All', ['vacban', 'gameban', 'communityban', 'tradeban', 'privateprofile'], 'all'],
  ];
  for (const [label, types, variant] of filters) {
    btnGroup.appendChild(makeSelectBtn(label, types, variant));
  }
  toolbar.appendChild(btnGroup);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove selected';
  removeBtn.className = 'friendbanmanager-btn friendbanmanager-btn--danger';
  removeBtn.disabled = true;
  removeBtn.id = 'friendbanmanager-remove-btn';
  removeBtn.addEventListener('click', () => removeSelectedFriends(removeBtn));
  toolbar.appendChild(removeBtn);

  const count = document.createElement('span');
  count.id = 'friendbanmanager-selected-count';
  count.className = 'friendbanmanager-selected-count';
  count.textContent = 'Selected: 0';
  toolbar.appendChild(count);

  const right = document.createElement('div');
  right.className = 'friendbanmanager-right';

  const status = document.createElement('span');
  status.id = 'friendbanmanager-remove-status';
  status.className = 'friendbanmanager-status';
  right.appendChild(status);

  const progress = document.createElement('span');
  progress.id = 'friendbanmanager-load-progress';
  progress.className = 'friendbanmanager-progress';
  right.appendChild(progress);

  toolbar.appendChild(right);

  const insertPoint =
    friendsHeader ??
    document.querySelector('.friends_content') ??
    document.body;
  const position = friendsHeader ? 'afterend' : 'afterbegin';
  insertPoint.insertAdjacentElement(position, toolbar);

  setToolbarEnabled(false);
  insertHeaderSortButton(onSortToggle);

  requestAnimationFrame(() => {
    const locked = toolbar.querySelector<HTMLElement>(
      '.friendbanmanager-btn--toggle',
    );
    if (!locked) return;
    const w = Math.ceil(locked.getBoundingClientRect().width) + 2;
    if (w) locked.style.minWidth = `${w}px`;
  });

  return toolbar;
};
