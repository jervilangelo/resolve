/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EyeOffIcon, LockIcon, ShieldIcon, UsersIcon } from '@/components/icons';
import { PageHero } from '@/components/prose-page';

export const metadata: Metadata = {
  title: 'About',
  description: 'What Resolve is for and how its three features work.',
};

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
      <h2 className="text-xl font-semibold">{title}</h2>
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
            Resolve helps Christians guard what they see online and invite trusted friends into the
            fight, in the spirit of 2 Corinthians 10:5: “take every thought captive to obey Christ.”
            It is a supporting tool, never a replacement for the local church.
          </p>
        }
      />
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-14 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
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
    </>
  );
}
