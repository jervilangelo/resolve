/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { BrowserMark, DownloadIcon } from '@/components/icons';
import { PageHero } from '@/components/prose-page';
import { Button } from '@/components/ui/button';
import { type LatestRelease, latestRelease } from '@/lib/releases';
import { RELEASES_URL } from '@/lib/site';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Download',
  description: 'Download the Resolve browser extension for Chrome, Edge and Brave.',
};

export const revalidate = 3600;

type BrowserId = 'chrome' | 'edge' | 'brave' | 'firefox';

const BROWSERS: { id: BrowserId; name: string; extensionsPage: string | null }[] = [
  { id: 'chrome', name: 'Google Chrome', extensionsPage: 'chrome://extensions' },
  { id: 'edge', name: 'Microsoft Edge', extensionsPage: 'edge://extensions' },
  { id: 'brave', name: 'Brave', extensionsPage: 'brave://extensions' },
  { id: 'firefox', name: 'Mozilla Firefox', extensionsPage: null },
];

function size(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function BrowserCard({
  browser,
  build,
}: {
  browser: (typeof BROWSERS)[number];
  build: LatestRelease['chromium'];
}) {
  const available = build !== null;
  return (
    <li className="bg-card flex flex-col rounded-2xl border p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="bg-muted grid size-11 place-items-center rounded-xl">
            <BrowserMark browser={browser.id} width={24} height={24} />
          </span>
          <span className="font-semibold">{browser.name}</span>
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            available
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {available ? 'Available' : 'Not available yet'}
        </span>
      </div>
      {available ? (
        <>
          <ol className="text-muted-foreground mt-5 list-decimal space-y-1.5 pl-5 text-sm">
            {browser.extensionsPage ? (
              <>
                <li>Download and unzip the file into a folder you will keep.</li>
                <li>
                  Open <code className="text-foreground">{browser.extensionsPage}</code> and turn on
                  Developer mode.
                </li>
                <li>Choose “Load unpacked” and select the unzipped folder.</li>
              </>
            ) : (
              <>
                <li>Download the file.</li>
                <li>
                  Open{' '}
                  <code className="text-foreground">about:debugging#/runtime/this-firefox</code>.
                </li>
                <li>Choose “Load Temporary Add-on” and select the file.</li>
              </>
            )}
          </ol>
          <Button asChild className="mt-6 self-start">
            <a href={build.url}>
              <DownloadIcon />
              Download ({size(build.size)})
            </a>
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground mt-5 text-sm">
          {browser.id === 'firefox'
            ? 'A Firefox version is planned. It is not ready to install yet.'
            : 'There is no published build to install yet.'}
        </p>
      )}
    </li>
  );
}

export default async function DownloadsPage() {
  const lookup = await latestRelease();
  const release = lookup.state === 'ok' ? lookup.release : null;

  return (
    <>
      <PageHero
        wide
        title="Download Resolve"
        intro={
          <p>
            The Resolve extension protects the browser you install it in. After installing, sign in
            from its popup with your Resolve account.
          </p>
        }
      />
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8">
        <section
          aria-labelledby="release"
          className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6"
        >
          {release ? (
            <div>
              <h2 id="release" className="text-lg font-semibold">
                Version {release.version}
              </h2>
              <p className="text-muted-foreground text-sm">
                {release.publishedAt
                  ? `Released ${new Date(release.publishedAt).toLocaleDateString('en', { dateStyle: 'long' })}`
                  : 'Latest stable release'}
              </p>
            </div>
          ) : (
            <div>
              <h2 id="release" className="text-lg font-semibold">
                {lookup.state === 'unavailable'
                  ? 'Release information is unavailable right now'
                  : 'No public release yet'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {lookup.state === 'unavailable'
                  ? 'Please try again later, or check the releases page.'
                  : 'Resolve is in a limited beta. Downloads appear here when the first stable release is published.'}
              </p>
            </div>
          )}
          <a
            href={release?.url ?? RELEASES_URL}
            className="text-sm font-medium underline underline-offset-4"
          >
            All releases on GitHub
          </a>
        </section>

        <section aria-labelledby="browsers">
          <h2 id="browsers" className="mb-5 text-xl font-semibold">
            Browsers
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {BROWSERS.map((browser) => (
              <BrowserCard
                key={browser.id}
                browser={browser}
                build={
                  browser.id === 'firefox'
                    ? (release?.firefox ?? null)
                    : (release?.chromium ?? null)
                }
              />
            ))}
          </ul>
          <p className="text-muted-foreground mt-5 text-sm">
            Resolve works on computers, not phones. Store listings will replace the manual install
            when they are approved. Next:{' '}
            <Link href="/getting-started" className="underline underline-offset-4">
              getting started
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
