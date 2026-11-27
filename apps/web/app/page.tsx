/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { FaqList } from '@/components/faq-list';
import {
  ArrowRightIcon,
  BrowserMark,
  CheckIcon,
  DownloadIcon,
  EyeOffIcon,
  HeartIcon,
  ShieldIcon,
  TimerIcon,
  UsersIcon,
} from '@/components/icons';
import { Reveal } from '@/components/landing/reveal';
import { Button } from '@/components/ui/button';
import { isSignedIn } from '@/lib/auth';
import { FAQ } from '@/lib/faq';
import { PRODUCT_NAME, SITE_DESCRIPTION, SITE_NAME, absoluteUrl, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/',
  title: 'Resolve — Free Christian Accountability Browser Extension',
  description: SITE_DESCRIPTION,
  absoluteTitle: true,
});

/** Structured data that restates what the page shows: the site's name and the free extension. */
function structuredData(): string {
  const url = absoluteUrl('/');
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: PRODUCT_NAME,
      url,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      alternateName: PRODUCT_NAME,
      description: SITE_DESCRIPTION,
      url,
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Windows, macOS, Linux, ChromeOS',
      browserRequirements: 'Google Chrome, Microsoft Edge or Brave on a computer',
      downloadUrl: absoluteUrl('/downloads'),
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: {
        '@type': 'Person',
        name: 'Jervil Angelo De Leon',
        url: 'https://jervilangelo.online',
      },
    },
  ]).replace(/</g, '\\u003c');
}

const WRAP = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const delay = (ms: number) => ({ ['--rs-delay' as string]: `${String(ms)}ms` }) as CSSProperties;

const FEATURES: {
  icon: ReactNode;
  title: string;
  text: string;
  points: string[];
  link?: { href: string; label: string };
}[] = [
  {
    icon: <ShieldIcon width={22} height={22} />,
    title: 'Website protection',
    text: 'Your group decides which websites its members’ browsers block.',
    points: ['Admins manage the list', 'Members can add more', 'Essential services stay reachable'],
  },
  {
    icon: <EyeOffIcon width={22} height={22} />,
    title: 'On-device AI blurring',
    text: 'Explicit images and video frames are blurred by a model that runs in your browser.',
    points: ['Nothing is uploaded', 'Three sensitivity levels', 'Off until you turn it on'],
  },
  {
    icon: <UsersIcon width={22} height={22} />,
    title: 'Voluntary accountability',
    text: 'Choose partners who may hear about a blocked visit, only if they agree.',
    points: ['Off by default', 'Never names the website', 'You can stop at any time'],
  },
  {
    icon: <TimerIcon width={22} height={22} />,
    title: 'Focus Mode',
    text: 'Temporarily block distracting websites while you study, work, or read. The sites become available again when your Focus session ends.',
    points: ['5 to 240 minutes', 'Works without an account', 'Never alerts anyone'],
    link: { href: '/tutorial#focus', label: 'How Focus Mode works' },
  },
];

const STEPS = [
  {
    title: 'Install the extension',
    text: 'Download it free for Chrome, Edge or Brave on a computer. Focus Mode and image blurring work right away.',
  },
  {
    title: 'Create your free account',
    text: 'Sign in from the extension and choose a display name in the dashboard.',
  },
  {
    title: 'Start or join a group',
    text: 'Create a group and invite people with a link, or join one you were invited to. Its blocked websites apply at once.',
  },
];

const BROWSERS = [
  { id: 'chrome', name: 'Chrome' },
  { id: 'edge', name: 'Edge' },
  { id: 'brave', name: 'Brave' },
  { id: 'firefox', name: 'Firefox (planned)' },
] as const;

export default async function HomePage() {
  const signedIn = await isSignedIn();
  const faq = FAQ.flatMap((s) => s.items).filter((i) =>
    [
      'Are accountability alerts on by default?',
      'Can my group see my browsing?',
      'Are my images uploaded to be checked?',
      'Which browsers are supported?',
    ].includes(i.q),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData() }} />
      <Reveal />

      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div className={`${WRAP} py-20 text-center sm:py-28`}>
          <div className="mx-auto max-w-3xl">
            <h1 id="hero-title" className="rs-mask">
              <span className="sr-only">Resolve: </span>
              <span aria-hidden="true">
                {(['light', 'dark'] as const).map((theme) => (
                  <Image
                    key={theme}
                    src={`/brand/horizontal-${theme}.svg`}
                    alt=""
                    width={741}
                    height={193}
                    priority
                    className={`mx-auto h-auto w-[min(78vw,34rem)] ${theme === 'light' ? 'rs-only-light' : 'rs-only-dark'}`}
                  />
                ))}
              </span>
              <span className="text-foreground mt-6 block text-xl font-medium sm:text-2xl">
                The free browser extension for Christians
              </span>
            </h1>
            <div className="rs-after-headline">
              <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg leading-relaxed sm:text-xl">
                Block the websites your group chooses, blur explicit images on your own device,
                focus with timed sessions, and invite people you trust to encourage you.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                {signedIn ? (
                  <Button asChild size="lg" className="h-12 px-6 text-[15px]">
                    <Link href="/dashboard" prefetch={false}>
                      Open your dashboard
                      <ArrowRightIcon />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="h-12 px-6 text-[15px]">
                    <Link href="/downloads">
                      <DownloadIcon />
                      Download free
                    </Link>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[15px]">
                  {signedIn ? (
                    <Link href="/downloads">
                      <DownloadIcon />
                      Download the extension
                    </Link>
                  ) : (
                    <Link href="/tutorial">
                      See how it works
                      <ArrowRightIcon />
                    </Link>
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground mt-6 text-sm">
                Free · No ads · Chrome, Edge and Brave on a computer
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        aria-labelledby="features-title"
        className="bg-muted/40 scroll-mt-20 border-y"
      >
        <div className={`${WRAP} py-20 sm:py-24`}>
          <div className="max-w-2xl" data-reveal>
            <h2 id="features-title" className="font-display text-3xl leading-tight sm:text-4xl">
              Four protections, one simple setup
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Use what helps you. Each part works on its own.
            </p>
          </div>
          <ul className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                data-reveal
                style={delay(i * 80)}
                className="bg-card hover:border-foreground/20 flex flex-col rounded-2xl border p-7 transition-[border-color,transform] hover:-translate-y-0.5"
              >
                <div className="bg-muted mb-6 grid size-11 place-items-center rounded-xl">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-muted-foreground mt-2 leading-relaxed">{f.text}</p>
                <ul className="mt-6 space-y-2 border-t pt-5 text-sm">
                  {f.points.map((point) => (
                    <li key={point} className="flex items-center gap-2.5">
                      <CheckIcon
                        width={16}
                        height={16}
                        className="text-emerald-700 dark:text-emerald-400"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
                {f.link && (
                  <Link
                    href={f.link.href}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {f.link.label}
                    <ArrowRightIcon width={14} height={14} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how-title" className={`${WRAP} py-20 sm:py-24`}>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div data-reveal>
            <h2 id="how-title" className="font-display text-3xl leading-tight sm:text-4xl">
              Set up in minutes
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Install first, then sign in. Your dashboard shows what is left to do, and the
              extension follows your group automatically.
            </p>
            <Button asChild className="mt-8">
              {signedIn ? (
                <Link href="/dashboard" prefetch={false}>
                  Open your dashboard
                </Link>
              ) : (
                <Link href="/tutorial#install">Follow the install guide</Link>
              )}
            </Button>
          </div>
          <ol className="space-y-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                data-reveal
                style={delay(i * 80)}
                className="bg-card flex gap-5 rounded-2xl border p-6"
              >
                <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="privacy-title" className="bg-slate-950 text-slate-50">
        <div className={`${WRAP} grid gap-10 py-20 sm:py-24 lg:grid-cols-2 lg:items-center`}>
          <div data-reveal>
            <h2 id="privacy-title" className="font-display text-3xl leading-tight sm:text-4xl">
              Accountability without surveillance
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Resolve is built around consent. Nothing about you is shared unless you choose it, and
              even then, never your browsing.
            </p>
            <Link
              href="/privacy"
              className="mt-6 inline-block text-sm font-medium underline underline-offset-4"
            >
              Read the privacy policy
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ['Alerts are off by default', 'You turn them on and choose who may receive them.'],
              ['Partners must agree', 'Nobody receives anything until they accept.'],
              ['No browsing history', 'Alerts never list the addresses you visit.'],
              ['AI on your device', 'Images are checked in your browser, not uploaded.'],
            ].map(([title, text], i) => (
              <li
                key={title}
                data-reveal
                style={delay(i * 60)}
                className="rounded-2xl bg-slate-900 p-5"
              >
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-slate-300">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="download-title" className={`${WRAP} py-20 sm:py-24`}>
        <div className="bg-muted/50 flex flex-col gap-8 rounded-3xl p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div data-reveal>
            <h2 id="download-title" className="font-display text-3xl leading-tight">
              Get the extension
            </h2>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
              {BROWSERS.map((b) => (
                <li key={b.id} className="text-muted-foreground flex items-center gap-2 text-sm">
                  <BrowserMark browser={b.id} />
                  {b.name}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild size="lg" className="h-12 self-start px-6 lg:self-auto">
            <Link href="/downloads">
              <DownloadIcon />
              Go to downloads
            </Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="faq-title" className={`${WRAP} pb-20 sm:pb-24`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div data-reveal>
            <h2 id="faq-title" className="font-display text-3xl leading-tight">
              Common questions
            </h2>
            <Link
              href="/faq"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
            >
              All questions
              <ArrowRightIcon width={16} height={16} />
            </Link>
          </div>
          <FaqList items={faq} name="home-faq" />
        </div>
      </section>

      <section aria-labelledby="support-title" className="border-t">
        <div
          className={`${WRAP} flex flex-col gap-6 py-16 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="flex gap-4">
            <span className="bg-muted grid size-11 shrink-0 place-items-center rounded-xl">
              <HeartIcon width={22} height={22} />
            </span>
            <div>
              <h2 id="support-title" className="text-lg font-semibold">
                Free, and kept running by one person
              </h2>
              <p className="text-muted-foreground mt-1">
                If Resolve helps you, a voluntary donation helps keep it available.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="self-start sm:self-auto">
            <Link href="/support">Support Resolve</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
