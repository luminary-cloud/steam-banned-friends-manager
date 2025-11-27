const runtime =
  typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;

runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchBans') {
    fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${
        request.apikey
      }&steamids=${request.batch.join(',')}`
    )
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw Error(`Code ${res.status}. ${res.statusText}`);
        }
      })
      .then((json) => sendResponse({ json }))
      .catch((error) => sendResponse({ json: undefined, error }));
  }
  if (request.action === 'resolveVanity' && request.vanity && request.apikey) {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${
      request.apikey
    }&vanityurl=${encodeURIComponent(request.vanity)}`;
    fetch(url)
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error(`${res.status} ${res.statusText}`))
      )
      .then((json) => {
        const steamid = json?.response?.steamid;
        const success = json?.response?.success === 1;
        if (success && steamid) {
          sendResponse({ steamid });
        } else {
          sendResponse({
            steamid: undefined,
            error: json?.response?.message || 'Resolve failed',
          });
        }
      })
      .catch((error) =>
        sendResponse({ steamid: undefined, error: String(error) })
      );
  }
  return true;
});
