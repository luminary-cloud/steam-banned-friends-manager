import { attachCheckbox } from './dom';
import type { PlayerBan, PlayerSummary } from './messaging';
import { pageState } from './state';

const buildBanText = (p: PlayerBan): string => {
  const parts: string[] = [];
  if (p.NumberOfGameBans) {
    parts.push(
      `${p.NumberOfGameBans} Game ban${p.NumberOfGameBans > 1 ? 's' : ''}`,
    );
  }
  if (p.NumberOfVACBans) {
    parts.push(
      `${p.NumberOfVACBans} VAC ban${p.NumberOfVACBans > 1 ? 's' : ''}`,
    );
  }
  if (p.CommunityBanned) parts.push('Community ban');
  if (p.EconomyBan && p.EconomyBan !== 'none') parts.push('Trade ban');
  const days = p.DaysSinceLastBan;
  const ago = days > 0 ? ` ${days} day${days > 1 ? 's' : ''} ago.` : '';
  return `${parts.join(', ')}${ago}`;
};

export const renderBan = (
  el: HTMLElement,
  p: PlayerBan,
  onGroupPage: boolean,
): void => {
  const vacBan = p.NumberOfVACBans > 0;
  const gameBan = p.NumberOfGameBans > 0;
  const commBan = p.CommunityBanned;
  const tradeBan = p.EconomyBan && p.EconomyBan !== 'none';
  if (!(vacBan || gameBan || commBan || tradeBan)) return;

  const nameBlock =
    el.querySelector<HTMLElement>('.friend_block_content') ?? el;
  nameBlock.querySelector('.friend_last_online_text')?.remove();
  nameBlock.querySelector('.friend_small_text')?.remove();

  const text = buildBanText(p);

  if (onGroupPage) {
    const small = el.querySelector<HTMLElement>(
      '.member_block_content .friendSmallText',
    );
    if (small) {
      const extra = el.querySelector('.friendbanmanager-bantext');
      if (extra && extra !== small) extra.remove();
      small.textContent = text;
      small.classList.add('friendbanmanager-bantext');
    } else {
      let span = nameBlock.querySelector<HTMLElement>(
        '.friendbanmanager-bantext',
      );
      if (!span) {
        span = document.createElement('span');
        span.className = 'friendbanmanager-bantext';
        nameBlock.appendChild(span);
      }
      span.textContent = text;
    }
  } else {
    let span = nameBlock.querySelector<HTMLElement>(
      '.friendbanmanager-bantext',
    );
    if (!span) {
      span = document.createElement('span');
      span.className = 'friendbanmanager-bantext';
      nameBlock.appendChild(span);
    }
    span.textContent = text;
  }

  el.classList.add('friendbanmanager-banned', 'friendbanmanager-target');
  el.dataset.bannedSteamId = p.SteamId;
  el.dataset.vacban = vacBan ? '1' : '0';
  el.dataset.gameban = gameBan ? '1' : '0';
  el.dataset.communityban = commBan ? '1' : '0';
  el.dataset.tradeban = tradeBan ? '1' : '0';

  if (pageState.selectionMode) attachCheckbox(el);
};

export const renderVisibility = (el: HTMLElement, p: PlayerSummary): void => {
  const state = Number(p.communityvisibilitystate);
  const isPrivate = state === 1;
  const isFriendsOnly = state === 2;
  el.dataset.privateprofile = isPrivate ? '1' : '0';
  el.dataset.friendsonly = isFriendsOnly ? '1' : '0';
  if (isPrivate) el.classList.add('friendbanmanager-target');
};
