/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { browser } from 'wxt/browser';
import { mount } from '@/lib/mount';

const primary =
  'rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[background-color,transform] hover:bg-primary-pressed active:scale-[0.98]';
const secondary =
  'rounded-full border px-5 py-2.5 text-sm font-medium transition-[background-color,transform] hover:bg-muted active:scale-[0.98]';

async function closeTab() {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
  else window.close();
}

/** Shown instead of a website blocked by Focus Mode. It never names the site. */
function FocusPage() {
  const fromOpenTab = new URLSearchParams(window.location.search).get('from') === 'open';
  const canGoBack = window.history.length > 1 && !fromOpenTab;
  return (
    <main className="bg-background grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <img
          src="/brand/horizontal-compact-light.svg"
          alt="Resolve"
          width={140}
          height={34}
          className="rs-only-light mx-auto h-8 w-auto"
        />
        <img
          src="/brand/horizontal-compact-dark.svg"
          alt=""
          aria-hidden
          width={140}
          height={34}
          className="rs-only-dark mx-auto h-8 w-auto"
        />
        <h1 className="font-display mt-12 text-4xl leading-tight">Focus Mode is On</h1>
        <p className="text-muted-foreground mt-4 text-lg">
          You’ve chosen to limit distractions. Stay focused on what matters.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button type="button" className={primary} onClick={() => void closeTab()}>
            Close this tab
          </button>
          {canGoBack && (
            <button
              type="button"
              className={secondary}
              onClick={() => {
                window.history.back();
              }}
            >
              Go back
            </button>
          )}
        </div>
        <p className="text-muted-foreground mt-10 text-sm">
          You can turn Focus Mode off from the Resolve extension.
        </p>
      </div>
    </main>
  );
}

mount(<FocusPage />);
