const maxRetries = 3;
let selectionMode = false;
let sessionID = null;
let ownSteamID = null;
const runtime =
  typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;

const extractSessionID = () => {
  if (sessionID) return sessionID;
  // Try to read from inline scripts first
  const scripts = document.querySelectorAll('script');
  for (const s of scripts) {
    const match = s.text.match(/g_sessionID\s*=\s*"([^"]+)"/);
    if (match) {
      sessionID = match[1];
      break;
    }
  }

  // Fallback: read sessionid from cookies (Steam sets `sessionid` cookie)
  if (!sessionID) {
    try {
      const cookieStr = document.cookie || '';
      const m = cookieStr.match(/(?:^|;\s*)sessionid=([^;]+)/);
      if (m) {
        // Cookie value may be URL-encoded
        sessionID = decodeURIComponent(m[1]);
      }
    } catch {}
  }

  return sessionID;
};

const extractOwnSteamID = () => {
  if (ownSteamID) return ownSteamID;
  try {
    // Try global variable if present
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const m = s.text.match(/g_steamID\s*=\s*"(\d+)"/);
      if (m) {
        ownSteamID = m[1];
        break;
      }
    }
    // Fallback: parse from header/profile link
    if (!ownSteamID) {
      const headerLink = document.querySelector(
        '#global_actions a[href*="/profiles/"]'
      );
      const m1 = headerLink?.getAttribute('href')?.match(/\/profiles\/(\d+)/);
      if (m1) ownSteamID = m1[1];
    }
    // If on vanity URL, ownSteamID may not be derivable without API; skip in that case
  } catch {}
  return ownSteamID;
};

const shouldShowToolbar = () => {
  const loggedIn = !!document.querySelector('#global_actions .user_avatar');
  const manageFriendsBtn = document.getElementById('manage_friends_control');
  return loggedIn && !!manageFriendsBtn;
};

const isFriendsPage = () =>
  /\/(profiles|id)\/[^\/]+\/friends/.test(location.pathname);
const isGroupMembersPage = () =>
  /^\/groups\/[^\/]+\/members/.test(location.pathname) ||
  !!document.getElementById('memberList');

const collectTargets = () => {
  const numericTargets = new Map();
  const vanityTargets = new Map();
  const shouldIgnore = (el) => !!el?.closest?.('.grouppage_friendsingroup');

  const addToMap = (map, key, el) => {
    if (!key || !el || shouldIgnore(el)) return;
    if (!map.has(key)) map.set(key, []);
    const arr = map.get(key);
    if (!arr.includes(el)) arr.push(el);
  };

  if (isFriendsPage()) {
    document
      .querySelectorAll('.friends_content .persona[data-steamid]')
      .forEach((el) => addToMap(numericTargets, el.dataset.steamid, el));
    return { numericTargets, vanityTargets };
  }

  if (isGroupMembersPage()) {
    const membersRoot = document.getElementById('memberList');
    if (!membersRoot) return { numericTargets, vanityTargets };

    const getContainer = (a) =>
      a.closest('.member_block, .member_block_ctn, .member_row') ||
      a.parentElement;

    membersRoot.querySelectorAll('a[href*="/profiles/"]').forEach((a) => {
      const m = a.getAttribute('href')?.match(/\/profiles\/(\d+)/);
      if (m) addToMap(numericTargets, m[1], getContainer(a) || a);
    });

    membersRoot.querySelectorAll('a[href*="/id/"]').forEach((a) => {
      const m = a.getAttribute('href')?.match(/\/id\/([^\/?#]+)/);
      if (m) addToMap(vanityTargets, m[1], getContainer(a) || a);
    });
  }

  return { numericTargets, vanityTargets };
};

const createToolbar = () => {
  if (
    !shouldShowToolbar() ||
    document.getElementById('friendbanmanager-toolbar')
  )
    return;

  const friendsHeader = document.querySelector(
    '.friends_header, .friends_header_pending, .manage_friends_header, .friends_header_label'
  );
  const toolbar = document.createElement('div');
  toolbar.id = 'friendbanmanager-toolbar';
  toolbar.className = 'friendbanmanager-toolbar';

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Select banned friends';
  toggleBtn.className = 'friendbanmanager-btn friendbanmanager-btn--toggle';
  toggleBtn.onclick = () => {
    selectionMode = !selectionMode;
    toggleBtn.textContent = selectionMode
      ? 'Cancel selection'
      : 'Select banned friends';
    document.querySelectorAll('.friendbanmanager-banned').forEach((el) => {
      if (selectionMode) {
        attachCheckbox(el);
      } else {
        const chk = el.querySelector('.friendbanmanager-remove-chk');
        if (chk) chk.remove();
      }
    });
    if (!selectionMode) {
      const countSpan = document.getElementById(
        'friendbanmanager-selected-count'
      );
      if (countSpan) countSpan.textContent = 'Selected: 0';
    }
    updateRemoveButtonState();
  };
  toolbar.appendChild(toggleBtn);

  const ensureSelectionMode = () => {
    if (!selectionMode) {
      toggleBtn.click();
    }
  };

  const selectByTypes = (types) => {
    ensureSelectionMode();
    document.querySelectorAll('.friendbanmanager-banned').forEach((el) => {
      const matches = types.some((t) => el.dataset[t] === '1');
      if (matches) {
        attachCheckbox(el);
        const chk = el.querySelector('.friendbanmanager-remove-chk');
        if (chk) chk.checked = true;
      }
    });
    updateRemoveButtonState();
  };

  const btnGroup = document.createElement('div');
  btnGroup.className = 'friendbanmanager-btn-group';

  const makeSelectBtn = (label, types, variant) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = `friendbanmanager-btn friendbanmanager-btn--${variant}`;
    b.onclick = () => selectByTypes(types);
    return b;
  };

  [
    ['VAC', ['vacban'], 'vac'],
    ['Game', ['gameban'], 'game'],
    ['Comm', ['communityban'], 'comm'],
    ['Trade', ['tradeban'], 'trade'],
    ['All', ['vacban', 'gameban', 'communityban', 'tradeban'], 'all'],
  ].forEach(([label, types, variant]) =>
    btnGroup.appendChild(makeSelectBtn(label, types, variant))
  );

  toolbar.appendChild(btnGroup);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove selected';
  removeBtn.className = 'friendbanmanager-btn friendbanmanager-btn--danger';
  removeBtn.disabled = true;
  removeBtn.id = 'friendbanmanager-remove-btn';
  removeBtn.onclick = () => removeSelectedFriends(removeBtn);
  toolbar.appendChild(removeBtn);

  const selectedCountSpan = document.createElement('span');
  selectedCountSpan.id = 'friendbanmanager-selected-count';
  selectedCountSpan.className = 'friendbanmanager-selected-count';
  selectedCountSpan.textContent = 'Selected: 0';
  toolbar.appendChild(selectedCountSpan);

  const statusSpan = document.createElement('span');
  statusSpan.id = 'friendbanmanager-remove-status';
  statusSpan.className = 'friendbanmanager-status';
  toolbar.appendChild(statusSpan);

  const insertPoint =
    friendsHeader ||
    document.querySelector('.friends_content') ||
    document.body;
  const position = friendsHeader ? 'afterend' : 'afterbegin';
  insertPoint.insertAdjacentElement(position, toolbar);
};

const checkBans = () => {
  const onFriends = isFriendsPage();
  const onMembers = isGroupMembersPage();
  if (!onFriends && !onMembers) return;

  if (onFriends && shouldShowToolbar()) createToolbar();
  const { numericTargets, vanityTargets } = collectTargets();

  const vanityNames = [...vanityTargets.keys()];
  const resolveVanity = (name) =>
    new Promise((resolve) => {
      runtime.sendMessage(
        { action: 'resolveVanity', vanity: name, apikey },
        (resp) => resolve({ name, steamid: resp?.steamid })
      );
    });

  const mergeResolved = async () => {
    for (const name of vanityNames) {
      try {
        const { steamid } = await resolveVanity(name);
        if (steamid) {
          const els = vanityTargets.get(name) || [];
          if (!numericTargets.has(steamid)) numericTargets.set(steamid, []);
          const arr = numericTargets.get(steamid);
          for (const el of els) {
            if (!arr.includes(el)) arr.push(el);
          }
        }
      } catch {}
    }
  };

  const proceed = () => {
    const uniquePlayers = [...numericTargets.keys()];
    const batches = uniquePlayers.reduce((arr, player, i) => {
      const idx = Math.floor(i / 100);
      (arr[idx] ||= []).push(player);
      return arr;
    }, []);

    const doPlayer = (player) => {
      const playerEls = numericTargets.get(player.SteamId) || [];
      const vacBan = player.NumberOfVACBans > 0;
      const gameBan = player.NumberOfGameBans > 0;
      const communityBan = player.CommunityBanned;
      const tradeBan = player.EconomyBan && player.EconomyBan !== 'none';

      if (!(vacBan || gameBan || communityBan || tradeBan)) return;

      const buildBanText = () => {
        const parts = [];
        if (player.NumberOfGameBans) {
          parts.push(
            `${player.NumberOfGameBans} Game ban${
              player.NumberOfGameBans > 1 ? 's' : ''
            }`
          );
        }
        if (player.NumberOfVACBans) {
          parts.push(
            `${player.NumberOfVACBans} VAC ban${
              player.NumberOfVACBans > 1 ? 's' : ''
            }`
          );
        }
        if (player.CommunityBanned) {
          parts.push('Community ban');
        }
        return `${parts.join(', ')} ${player.DaysSinceLastBan} day${
          player.DaysSinceLastBan > 1 ? 's' : ''
        } ago.`;
      };

      playerEls.forEach((playerEl) => {
        const nameBlock =
          playerEl.querySelector?.('.friend_block_content') || playerEl;
        if (!nameBlock) return;

        nameBlock.querySelector('.friend_last_online_text')?.remove();
        nameBlock.querySelector('.friend_small_text')?.remove();

        const text = buildBanText();

        if (onMembers) {
          const small = playerEl.querySelector(
            '.member_block_content .friendSmallText'
          );
          if (small) {
            const extra = playerEl.querySelector('.friendbanmanager-bantext');
            if (extra && extra !== small) extra.remove();
            small.textContent = text;
            small.classList.add('friendbanmanager-bantext');
          } else {
            let banSpan = nameBlock.querySelector('.friendbanmanager-bantext');
            if (!banSpan) {
              banSpan = document.createElement('span');
              banSpan.className = 'friendbanmanager-bantext';
              nameBlock.appendChild(banSpan);
            }
            banSpan.textContent = text;
          }
        } else {
          let banSpan = nameBlock.querySelector('.friendbanmanager-bantext');
          if (!banSpan) {
            banSpan = document.createElement('span');
            banSpan.className = 'friendbanmanager-bantext';
            nameBlock.appendChild(banSpan);
          }
          banSpan.textContent = text;
        }

        playerEl.classList?.add('friendbanmanager-banned');
        if (playerEl.dataset) {
          playerEl.dataset.bannedSteamId = player.SteamId;
          playerEl.dataset.vacban = vacBan ? '1' : '0';
          playerEl.dataset.gameban = gameBan ? '1' : '0';
          playerEl.dataset.communityban = communityBan ? '1' : '0';
          playerEl.dataset.tradeban = tradeBan ? '1' : '0';
        }
        if (selectionMode) attachCheckbox(playerEl);
      });
    };

    const fetchBatch = (i, retryCount) => {
      runtime.sendMessage(
        {
          action: 'fetchBans',
          apikey,
          batch: batches[i],
        },
        (response) => {
          const { json, error } = response || {};
          if (error !== undefined) {
            if (retryCount > 0) {
              setTimeout(() => fetchBatch(i, retryCount - 1), 3000);
            }
            return;
          }
          const players = json?.players;
          if (Array.isArray(players)) {
            players.forEach((player) => doPlayer(player));
          }
          if (batches.length > i + 1) {
            setTimeout(() => fetchBatch(i + 1, maxRetries), 1000);
          }
        }
      );
    };
    if (batches.length) fetchBatch(0, maxRetries);
  };

  if (vanityNames.length) {
    mergeResolved().then(proceed);
  } else {
    proceed();
  }
};

const apikey = [
  'E2D53156DEEF9C2182F22544E6992B25',
  '7AC318B6920B08B3E5CE06CB84307DE1',
  '2777BEBF8A42039D95816FF69DE44C4D',
][Math.floor(Math.random() * 3)];

const debounce = (fn, ms) => {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
};

const trigger = debounce(checkBans, 300);
const observer = new MutationObserver(trigger);
const observeTarget =
  document.querySelector('.friends_content') || document.body;
observer.observe(observeTarget, { childList: true, subtree: true });
checkBans();

const attachCheckbox = (playerEl) => {
  if (playerEl.querySelector('.friendbanmanager-remove-chk')) return;
  if (getComputedStyle(playerEl).position === 'static') {
    playerEl.style.position = 'relative';
  }
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.className = 'friendbanmanager-remove-chk';
  // Improve accessibility and avoid form field warnings
  const sidForName =
    playerEl?.dataset?.steamid || playerEl?.dataset?.bannedSteamId || '';
  if (sidForName) {
    chk.name = `friendbanmanager-remove-${sidForName}`;
    chk.id = `friendbanmanager-remove-${sidForName}`;
    chk.value = sidForName;
    chk.setAttribute('aria-label', `Remove friend ${sidForName}`);
  } else {
    chk.name = 'friendbanmanager-remove';
    chk.setAttribute('aria-label', 'Remove selected friend');
  }
  chk.addEventListener('change', updateRemoveButtonState);
  playerEl.appendChild(chk);
};

const updateRemoveButtonState = () => {
  const removeBtn = document.getElementById('friendbanmanager-remove-btn');
  if (!removeBtn) return;
  const checkedBoxes = document.querySelectorAll(
    '.friendbanmanager-remove-chk:checked'
  );
  removeBtn.disabled = checkedBoxes.length === 0;
  const countSpan = document.getElementById('friendbanmanager-selected-count');
  if (countSpan) countSpan.textContent = `Selected: ${checkedBoxes.length}`;
};

const removeSelectedFriends = async (removeBtn) => {
  const checked = Array.from(
    document.querySelectorAll('.friendbanmanager-remove-chk:checked')
  );
  if (!checked.length) return;

  // Steam only allows removing from your own friends page reliably
  if (!isFriendsPage()) {
    const statusSpan = document.getElementById(
      'friendbanmanager-remove-status'
    );
    if (statusSpan)
      statusSpan.textContent = 'Navigate to your Friends page to remove.';
    return;
  }

  const confirmMsg = `Are you sure you want to remove ${checked.length} friend${
    checked.length > 1 ? 's' : ''
  } from your friends list?`;
  if (!window.confirm(confirmMsg)) return;
  removeBtn.disabled = true;
  const statusSpan = document.getElementById('friendbanmanager-remove-status');
  statusSpan.textContent = 'Removing...';

  const sid = extractSessionID();
  if (!sid) {
    statusSpan.textContent = 'Could not find sessionID; removal aborted.';
    console.error(
      'FriendBanManager: sessionID not found. Cookies:',
      document.cookie
    );
    return;
  }

  let success = 0,
    fail = 0;

  for (const chk of checked) {
    const persona = chk.closest('.persona');
    // Try multiple sources for steamid
    let steamid = persona?.dataset?.steamid || persona?.dataset?.bannedSteamId;
    if (!steamid) {
      const link = persona?.querySelector?.('a[href*="/profiles/"]');
      const m = link?.getAttribute('href')?.match(/\/profiles\/(\d+)/);
      if (m) steamid = m[1];
    }
    if (!steamid) {
      fail++;
      continue;
    }

    try {
      const me = extractOwnSteamID();
      const basePath = location.pathname.replace(/\/friends.*$/, '');
      const actionUrl = `${location.origin}${basePath}/friends/action`;
      const params = new URLSearchParams({
        sessionid: sid,
        steamid: me || '',
        ajax: '1',
        action: 'remove',
      });
      params.append('steamids[]', steamid);
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
        Object.assign(persona.style, { opacity: '0.4', pointerEvents: 'none' });
        chk.disabled = true;
      } else {
        fail++;
        const text = await resp.text().catch(() => '');
        if (text.trim() === 'false' && statusSpan) {
          statusSpan.textContent =
            'Steam refused removal (server returned false). Try reloading your friends page.';
        }
        console.error('FriendBanManager: RemoveFriendAjax failed', {
          status: resp.status,
          statusText: resp.statusText,
          body: text,
          steamid,
        });
      }
    } catch (e) {
      fail++;
      console.error('FriendBanManager: request error while removing friend', e);
    }
  }

  statusSpan.textContent = `Done. Removed ${success}. Failed ${fail}.`;
  updateRemoveButtonState();
  // If removals occurred, reload the page to reflect updated list
  if (success > 0) {
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
};
