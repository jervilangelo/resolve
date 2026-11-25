/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { AlertPreview } from '@/components/landing/alert-preview';
import { ExtensionPanel } from '@/components/landing/extension-panel';
import { Reveal } from '@/components/landing/reveal';
import { isSignedIn } from '@/lib/auth';

/** Page frame: one pair of margins everywhere. */
const FRAME = 'w-full px-5 sm:px-8 lg:px-10';

const delay = (ms: number) => ({ ['--rs-delay' as string]: `${String(ms)}ms` }) as CSSProperties;

function Stage({
  lead,
  text,
  children,
  index,
}: {
  lead: string;
  text: string;
  children: ReactNode;
  index: number;
}) {
  return (
    <li className="space-y-5" data-reveal style={delay(index * 80)}>
      <p className="text-muted-foreground text-[17px] leading-relaxed">
        <strong className="text-foreground font-semibold">{lead}</strong> {text}
      </p>
      {children}
    </li>
  );
}

/** A real screenshot of the product, at the column's width. */
function Shot({
  src,
  width,
  height,
  alt,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
}) {
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt}
      sizes="(min-width: 640px) 600px, 100vw"
      style={{ maxWidth: `${String(width)}px` }}
      className="bg-muted h-auto w-full rounded-lg"
    />
  );
}

const FACTS = [
  { value: '0', label: 'images uploaded to check them' },
  { value: '0', label: 'websites named in an alert' },
  { value: '2', label: 'kinds of alert, and no others' },
  { value: '10 min', label: 'at least between blocked-visit alerts in a group' },
  { value: 'Free', label: 'to use, with no ads' },
] as const;

const FAQ = [
  {
    q: 'Can my group see my browsing?',
    a: 'No. Resolve never collects your history, the addresses you visit or screenshots. An alert says only that a non-negotiable website was blocked, never which one, and only to people you chose who agreed to receive it.',
  },
  {
    q: 'Are my images uploaded to be checked?',
    a: 'No. The model that decides what to blur is packaged inside the extension and runs on your device. Images and video frames never leave your browser to be checked.',
  },
  {
    q: 'When is an alert sent?',
    a: 'Only two things send one: a deliberate visit to a website on your group’s non-negotiable list (which is blocked), and leaving or being removed from a group. Blurring, ordinary browsing and the additional list never do.',
  },
  {
    q: 'Can a group admin change my sharing?',
    a: 'No. Admins choose the group’s websites. Who may receive alerts about you is your choice alone, and each recipient decides for themselves whether to receive them.',
  },
  {
    q: 'Which browsers does it work in?',
    a: 'Google Chrome, Microsoft Edge and Brave on a computer. Firefox and phones are not supported yet.',
  },
  {
    q: 'Can Resolve be turned off?',
    a: 'Yes. Any extension can be disabled or removed, and Resolve does not cover other browsers or devices. It is a support for honest people, not a lock.',
  },
  {
    q: 'Does it replace accountability in a church?',
    a: 'No. Resolve is a supporting tool, never a replacement for membership, discipleship and pastoral care in a sound local church.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing. Resolve is free and has no advertising. A voluntary donation option may come later; it will never unlock features.',
  },
] as const;

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/getting-started', label: 'Getting started' },
  { href: '/support', label: 'Support' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export default async function HomePage() {
  const signedIn = await isSignedIn();
  return (
    <>
      <Reveal />

      {/* Hero: two tones of one dark ground; the working fragment on the lighter half. */}
      <section aria-labelledby="hero-title" className="bg-slate-950 text-slate-50">
        <div className="grid min-h-[100svh] lg:grid-cols-2">
          <div className="flex flex-col px-5 pt-6 pb-10 sm:px-8 lg:px-10 lg:pt-10 lg:pb-14">
            <nav aria-label="Primary" className="flex items-center justify-between">
              <Link href="/" className="rounded-sm" aria-label="Resolve home">
                <Image
                  src="/brand/horizontal-compact-dark.svg"
                  alt="Resolve"
                  width={125}
                  height={30}
                  priority
                />
              </Link>
              <Link
                href="/dashboard"
                prefetch={false}
                className="text-[15px] text-slate-50 underline underline-offset-4 lg:hidden"
              >
                {signedIn ? 'Dashboard' : 'Sign in'}
              </Link>
            </nav>
            <div className="mt-auto pt-16">
              <h1
                id="hero-title"
                className="font-display text-[clamp(2.5rem,4.6vw,4.5rem)] leading-[1.02] tracking-[-0.02em]"
              >
                <span className="rs-mask">
                  <span>{'Take every '}</span>
                </span>
                <span className="rs-mask">
                  <span style={delay(110)}>thought captive.</span>
                </span>
              </h1>
              <div className="rs-after-headline">
                <p className="mt-8 max-w-[44ch] text-[17px] leading-relaxed text-slate-300">
                  Resolve is a free browser extension for Christians. It blurs explicit media on
                  your device, blocks the websites your group chooses, and tells only the people you
                  pick, if they agree.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <Link
                    href="/dashboard"
                    prefetch={false}
                    className="inline-flex h-12 items-center rounded-full bg-slate-50 px-6 text-[15px] font-medium text-slate-950 transition-[background-color,transform] hover:bg-white active:scale-[0.98]"
                  >
                    {signedIn ? 'Open your dashboard' : 'Create your account'}
                  </Link>
                  <Link
                    href="/getting-started"
                    className="text-[15px] text-slate-50 underline underline-offset-4 hover:text-white"
                  >
                    How it works
                  </Link>
                </div>
                <p className="mt-8 text-[15px] text-slate-400">
                  Limited beta: not yet publicly available in the browser stores.
                </p>
              </div>
            </div>
          </div>
          <div className="relative flex flex-col items-center justify-center bg-slate-900 px-5 py-14 sm:px-8 lg:px-10">
            <Link
              href="/dashboard"
              prefetch={false}
              className="absolute top-10 right-10 hidden text-[15px] text-slate-50 underline underline-offset-4 lg:block"
            >
              {signedIn ? 'Dashboard' : 'Sign in'}
            </Link>
            <AlertPreview />
            <p className="mt-5 max-w-[440px] text-[13px] text-slate-400">
              Try it: this is how the alert your partners receive begins.
            </p>
          </div>
        </div>
      </section>

      {/* How it works: one reading column, evidence under each step. */}
      <section aria-labelledby="how" className={`${FRAME} py-28 lg:py-40`}>
        <div className="mx-auto max-w-[600px] lg:mr-auto lg:ml-[25%]">
          <h2
            id="how"
            data-reveal
            className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight"
          >
            Set up in an evening
          </h2>
          <ol className="mt-12 space-y-[72px]">
            <Stage
              index={0}
              lead="To begin,"
              text="create an account and add the extension to Chrome, Edge or Brave. Sign in once, and the browser follows your group."
            >
              <Shot
                src="/product/popup-group.png"
                width={400}
                height={230}
                alt="The Resolve extension popup: the active group, and domain protection on"
              />
            </Stage>
            <Stage
              index={1}
              lead="Then,"
              text="your group’s admin keeps the list of websites to block, one at a time or a whole list at once. Members can add to it but never see it, and essential services such as Gmail always stay reachable."
            >
              <Shot
                src="/product/blocked-websites.png"
                width={608}
                height={812}
                alt="The group page: adding websites one by one or as a pasted list, and the two websites on the list"
              />
            </Stage>
            <Stage
              index={2}
              lead="After that,"
              text="you decide who may hear about a blocked visit: nobody, a few chosen members, or everyone in the group; and each of them agrees first. Your home page shows how strong your setup is."
            >
              <Shot
                src="/product/checklist.png"
                width={762}
                height={384}
                alt="The Resolve checklist on the dashboard home: two of three steps done"
              />
            </Stage>
          </ol>
        </div>
      </section>

      {/* Inside the extension: one panel at true size, notes in both margins. */}
      <section aria-labelledby="inside" className={`${FRAME} pb-28 lg:pb-40`}>
        <h2
          id="inside"
          data-reveal
          className="font-display mb-12 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight lg:mb-0 lg:w-1/3 lg:pr-6 lg:text-right"
        >
          Inside the extension
        </h2>
        <div className="lg:-mt-12">
          <ExtensionPanel />
        </div>
      </section>

      {/* The name: a real portrait of the man the product is named after. */}
      <section aria-labelledby="name" className="bg-slate-950 text-slate-50">
        <div className={`${FRAME} grid items-center gap-12 py-24 lg:grid-cols-12 lg:py-32`}>
          <div className="overflow-hidden rounded-lg lg:col-span-5" data-reveal>
            <Image
              src="/history/jonathan-edwards.jpg"
              alt="Oil portrait of Jonathan Edwards in a dark preaching gown and white bands"
              width={1280}
              height={1534}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="h-auto w-full scale-[1.04] object-cover"
            />
          </div>
          <div className="space-y-8 lg:col-span-6 lg:col-start-7">
            <h2
              id="name"
              data-reveal
              className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight"
            >
              Named after seventy resolutions
            </h2>
            <blockquote data-reveal style={delay(80)} className="space-y-3">
              <p className="font-display text-2xl leading-snug sm:text-[1.75rem]">
                “Resolved, never to do anything, which I should be afraid to do, if it were the last
                hour of my life.”
              </p>
              <footer className="text-[15px] text-slate-300">
                Jonathan Edwards, Resolution 7, 1722
              </footer>
            </blockquote>
            <p
              data-reveal
              style={delay(160)}
              className="text-[17px] leading-relaxed text-slate-300"
            >
              Edwards wrote his Resolutions at nineteen and read them over every week. The tagline
              comes from 2 Corinthians 10:5. Resolve is a practical aid for that kind of
              watchfulness among friends, never the thing that puts sin to death: that is the work
              of the Spirit, by grace.
            </p>
            <Link
              data-reveal
              style={delay(240)}
              href="/about"
              className="inline-block text-[15px] text-slate-50 underline underline-offset-4"
            >
              Read about Resolve
            </Link>
          </div>
        </div>
      </section>

      {/* Facts: large marks on tiles; every figure is a product rule, not a boast. */}
      <section aria-labelledby="facts" className={`${FRAME} py-28 lg:py-40`}>
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <li
            data-reveal
            className="bg-primary text-primary-foreground col-span-2 flex min-h-32 items-start rounded-lg p-6 lg:min-h-40"
          >
            <h2 id="facts" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">
              The rules it keeps
            </h2>
          </li>
          {FACTS.map((fact, i) => (
            <li
              key={fact.label}
              data-reveal
              style={delay((i % 4) * 60)}
              className="bg-muted min-h-32 rounded-lg p-6 lg:min-h-40"
            >
              <p className="text-[15px]">
                <span className="block text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-semibold tabular-nums">
                  {fact.value}
                </span>
                <span className="text-muted-foreground mt-3 block">{fact.label}</span>
              </p>
            </li>
          ))}
          <li data-reveal className="bg-muted min-h-32 rounded-lg p-6 lg:min-h-40">
            <p className="text-[15px]">
              <span className="block text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-semibold">
                3
              </span>
              <span className="text-muted-foreground mt-3 block">
                browsers: Chrome, Edge and Brave
              </span>
            </p>
          </li>
        </ul>
      </section>

      {/* FAQ: sticky heading, one answer open at a time. */}
      <section aria-labelledby="faq" className={`${FRAME} pb-28 lg:pb-40`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <h2
            id="faq"
            className="font-display self-start text-[clamp(1.75rem,3vw,2.5rem)] leading-tight lg:col-span-4"
          >
            Plain answers
          </h2>
          <div className="space-y-2 lg:col-span-8">
            {FAQ.map((item, i) => (
              <details
                key={item.q}
                name="faq"
                open={i === 0}
                data-reveal
                className="group bg-muted open:bg-primary open:text-primary-foreground rounded-lg transition-colors"
              >
                <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="relative size-4 shrink-0">
                    <span className="absolute top-1/2 left-0 h-[3px] w-4 -translate-y-1/2 rounded-full bg-current" />
                    <span className="absolute top-1/2 left-0 h-[3px] w-4 -translate-y-1/2 rotate-90 rounded-full bg-current transition-transform group-open:rotate-0" />
                  </span>
                </summary>
                <p className="max-w-[52ch] px-6 pb-6 text-[17px] leading-relaxed opacity-90">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Close: a sentence with a blank; the blank becomes the group's name after sign-in. */}
      <section aria-labelledby="start" className={`${FRAME} pb-16`}>
        <form action="/dashboard/groups" method="get" data-reveal className="max-w-[60rem]">
          <h2 id="start" className="sr-only">
            Start a group
          </h2>
          <p className="font-display text-2xl leading-snug sm:text-[1.75rem] lg:text-[2.25rem]">
            <span>Start a group called </span>
            <label htmlFor="start-name" className="sr-only">
              Group name
            </label>
            <input
              id="start-name"
              name="name"
              required
              maxLength={60}
              autoComplete="off"
              placeholder="Tuesday men"
              className="bg-muted placeholder:text-muted-foreground mx-1 inline-block h-[1.3em] w-[7.5em] max-w-full rounded-md px-2 align-baseline text-[0.85em] focus:outline-2"
            />{' '}
            <span>and </span>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary-pressed inline-block h-[1.3em] rounded-md px-3 align-baseline text-[0.85em] transition-colors active:scale-[0.98]"
            >
              invite your friends.
            </button>
          </p>
          <p className="text-muted-foreground mt-6 text-[15px]">
            You sign in or create an account, then the group is ready to create with that name.
            Nothing is saved until you press Create.
          </p>
        </form>
      </section>

      {/* Footer: one quiet line. */}
      <footer className={`${FRAME} pt-[24svh] pb-8`}>
        <div className="grid gap-2 text-[15px] sm:grid-cols-[1fr_auto_1fr] sm:items-baseline">
          <p className="text-muted-foreground">Resolve · free browser protection</p>
          <nav aria-label="Site">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-muted-foreground sm:text-right">
            © 2026 Jervil Angelo De Leon ·{' '}
            <a
              href="https://commons.wikimedia.org/wiki/File:Jonathan_Edwards_(Princeton_Portrait).jpg"
              className="underline-offset-4 hover:underline"
            >
              Portrait: H. A. Loop after J. Badger, public domain
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
