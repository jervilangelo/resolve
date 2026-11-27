/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EyeOffIcon, LockIcon, ShieldIcon, TimerIcon, UsersIcon } from '@/components/icons';
import { PageHero } from '@/components/prose-page';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  path: '/about',
  title: 'About Resolve',
  description:
    'Why Resolve exists: a free tool for Christians who want to use the internet faithfully, what it does, its limits, and who built it.',
});

function Prose({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-6 border-t py-14 first:border-t-0 first:pt-0 lg:grid-cols-[1fr_2fr] lg:gap-16"
    >
      <h2 id={id} className="font-display text-2xl leading-tight sm:text-3xl">
        {title}
      </h2>
      <div className="max-w-[65ch] space-y-5 text-lg leading-relaxed">{children}</div>
    </section>
  );
}

/** A Scripture reference, kept together and set apart in the text. */
function Ref({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">({children})</span>;
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card rounded-2xl border p-6 sm:p-8">
      <div className="bg-muted mb-5 grid size-11 place-items-center rounded-xl">{icon}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <ul className="text-muted-foreground mt-4 space-y-2.5 leading-relaxed">{children}</ul>
    </section>
  );
}

export default function AboutPage() {
  return (
    <>
      <PageHero
        wide
        title="About Resolve"
        intro={
          <p>
            Resolve is for Christians who want to be diligent and careful about how they use the
            internet as part of their walk with Christ. It helps you set boundaries online and
            invite trusted people to encourage you. All of life is for God’s glory, including how we
            spend our time online.
          </p>
        }
      />
      <div className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
        <Prose id="purpose" title="Why Resolve exists">
          <p>
            Resolve is being designed for believers who desire to take their thoughts captive and
            walk in greater faithfulness to Christ, especially in the digital spaces where
            temptation can be private, persistent, and difficult to resist. Its central purpose is
            mutual accountability among fellow brethren: to make it easier for trusted brothers and
            sisters in Christ to encourage, exhort, pray for, and support one another.
          </p>
          <p>
            God has given the local church and the fellowship of believers as means of encouragement
            and care <Ref>Hebrews 3:12–13; Galatians 6:1–2; James 5:16</Ref>.
          </p>
          <p>
            We encourage every believer to join, participate faithfully in, and be accountable
            within a sound local church, where pastors, elders, and fellow members can know and care
            for them personally.
          </p>
          <p className="bg-muted/50 rounded-2xl p-5 font-medium">
            Resolve is only a supporting tool, never a replacement for membership, discipleship,
            pastoral oversight, fellowship, or accountability in the local church.
          </p>
          <p>
            Its optional accountability groups, consent-based notifications, and browser safeguards
            are intended to make honest conversations and intentional habits easier.
          </p>
          <p>
            Accountability should be voluntary, gracious, respectful, and never used to shame or
            control someone.
          </p>
        </Prose>
      </div>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-14 sm:px-8">
        <h2 className="font-display text-2xl leading-tight sm:text-3xl">What Resolve does</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Feature icon={<ShieldIcon width={22} height={22} />} title="Website protection">
            <li>Your accountability group sets the websites its members’ browsers block.</li>
            <li>Admins manage the group’s restrictions.</li>
            <li>Members can add more websites to block, but cannot see or change the list.</li>
          </Feature>
          <Feature icon={<EyeOffIcon width={22} height={22} />} title="On-device AI protection">
            <li>Images and supported video frames are analysed on your own device.</li>
            <li>Potentially explicit content can be blurred automatically.</li>
            <li>Your browsing media is never uploaded for analysis.</li>
          </Feature>
          <Feature icon={<UsersIcon width={22} height={22} />} title="Voluntary accountability">
            <li>Accountability alerts are off by default; only you can turn them on.</li>
            <li>You choose your accountability partners, and each of them must agree.</li>
            <li>
              Once on, a deliberate attempt to visit a website your group’s admins marked
              non-negotiable may alert those partners. Websites members add never do.
            </li>
            <li>
              Leaving or being removed from a group may also alert them, under the same consent.
            </li>
          </Feature>
          <Feature icon={<TimerIcon width={22} height={22} />} title="Focus Mode">
            <li>Blocks distracting websites for 5 to 240 minutes while you study, work or read.</li>
            <li>Ends by itself; ending early takes two deliberate steps.</li>
            <li>Personal: no account needed, nothing is sent, and no one is alerted.</li>
          </Feature>
        </div>

        <section className="bg-muted/50 grid gap-6 rounded-2xl p-6 sm:p-8 md:grid-cols-[auto_1fr]">
          <div className="bg-card grid size-11 place-items-center rounded-xl">
            <LockIcon width={22} height={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Privacy, briefly</h2>
            <ul className="text-muted-foreground mt-4 grid gap-2.5 leading-relaxed md:grid-cols-2">
              <li>Accounts and groups run on AWS-managed services with security controls.</li>
              <li>Image and video analysis is designed to run on your device.</li>
              <li>Alerts never include your browsing history or the addresses you visit.</li>
              <li>
                Read the{' '}
                <Link href="/privacy" className="underline underline-offset-4">
                  privacy policy
                </Link>{' '}
                for exactly what is stored.
              </li>
            </ul>
          </div>
        </section>
      </div>
      <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <Prose id="mortify" title="A tool, not the mortifier of sin">
          <p>
            Like any tool, Resolve can be bypassed. Our hearts can be quick to find excuses when we
            want to do something we know we should avoid. Resolve can help by interrupting a habit,
            making temptation harder to act on, and encouraging accountability.
          </p>
          <p className="font-medium">Resolve is not the ultimate mortifier of sin.</p>
          <p>
            No browser extension, blocked website, or automated notification can put sin to death on
            a person’s behalf. Mortification is the believer’s responsibility by the Spirit and
            through God’s grace <Ref>Romans 8:13</Ref>.
          </p>
          <p>
            Resolve is only a practical aid: it can help remove opportunities for temptation,
            encourage vigilance, and invite the support of fellow believers.
          </p>
          <p>
            It must never become a substitute for repentance, prayer, Scripture, personal
            responsibility, pastoral care, or dependence on Christ.
          </p>
        </Prose>
        <Prose id="builder" title="Who built Resolve">
          <p>
            I’m Jervil Angelo De Leon. I built Resolve to grow my skills as a developer and to help
            fellow believers pursue holiness and godliness in everyday life.
          </p>
          <p>
            <a
              href="https://jervilangelo.online"
              className="font-medium underline underline-offset-4"
              rel="noopener"
            >
              View my portfolio
            </a>
          </p>
        </Prose>
      </div>
    </>
  );
}
