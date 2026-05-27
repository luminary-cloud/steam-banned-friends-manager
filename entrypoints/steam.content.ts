import '@/src/style.css';
import { isOwnFriendsPageVerified } from '@/src/lib/identity';
import { classifyRoute } from '@/src/lib/pages';
import { checkBans } from '@/src/lib/scanner';
import { pageState, resetPageState } from '@/src/lib/state';
import { createToolbar, removeToolbar } from '@/src/lib/toolbar';

const debounce = <F extends () => void>(fn: F, ms: number): F => {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (() => {
    if (t) clearTimeout(t);
    t = setTimeout(fn, ms);
  }) as F;
};

export default defineContentScript({
  matches: [
    '*://steamcommunity.com/id/*',
    '*://steamcommunity.com/profiles/*',
    '*://steamcommunity.com/groups/*',
  ],
  runAt: 'document_end',
  cssInjectionMode: 'manifest',

  main(ctx) {
    const run = (): void => {
      removeToolbar();
      resetPageState();

      const route = classifyRoute();
      if (route === 'other') return;

      if (route === 'friends') {
        if (!createToolbar()) {
          isOwnFriendsPageVerified().then((own) => {
            if (ctx.isInvalid) return;
            if (own) createToolbar(true);
          });
        }
      }

      const target =
        document.querySelector('.friends_content') ??
        document.getElementById('memberList') ??
        document.body;

      const tick = debounce(() => {
        if (ctx.isInvalid) return;
        checkBans();
      }, 300);

      const observer = new MutationObserver(tick);
      observer.observe(target, { childList: true, subtree: true });
      pageState.observer = observer;

      checkBans();
    };

    ctx.addEventListener(window, 'wxt:locationchange', () => run());
    ctx.onInvalidated(() => {
      if (pageState.observer) pageState.observer.disconnect();
      removeToolbar();
    });

    run();
  },
});
