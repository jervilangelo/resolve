/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { DashboardLoading } from '@/components/dashboard-loading';
import { DashboardNav } from '@/components/dashboard-nav';
import { getSession } from '@/lib/auth';
import { getProfile } from '@/lib/profile';
import { WelcomeForm } from './forms';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

/** The sidebar, once the profile (for the display name) has loaded. */
async function NavWithProfile({ email }: { email: string | null }) {
  const profile = await getProfile().catch((error: unknown) => {
    unstable_rethrow(error); // sign-in redirects go through
    return null; // otherwise the sidebar shows the email instead of the name
  });
  return <DashboardNav name={profile?.displayName ?? null} email={email} />;
}

/**
 * Everyone picks a display name first (members see it in their groups); until then the
 * dashboard shows only that one question.
 */
async function NameGate({ children }: { children: ReactNode }) {
  const profile = await getProfile().catch((error: unknown) => {
    unstable_rethrow(error);
    return null; // a profile outage must not take the rest of the dashboard down
  });
  if (!profile || profile.displayName) return children;
  return (
    <div className="grid gap-10 py-4 lg:grid-cols-12 lg:gap-4 lg:py-12">
      <div className="space-y-8 lg:col-span-7">
        <div className="space-y-3">
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">
            Welcome to Resolve. What should your group call you?
          </h1>
          <p className="text-base">
            Your display name is the only thing members of your groups see about you, next to your
            role. You can change it any time on your profile.
          </p>
        </div>
        <WelcomeForm />
      </div>
      <section
        aria-labelledby="welcome-next"
        className="bg-muted/60 self-start rounded-2xl p-5 lg:col-span-4 lg:col-start-9"
      >
        <h2 id="welcome-next" className="mb-4 text-sm font-semibold">
          Then, three steps to a strong setup
        </h2>
        <ul className="space-y-2">
          {[
            ['Media blurring', 'Turn it on in the Resolve extension. Checked on your device.'],
            ['Joining a group', 'Create one, or open an invitation from a group admin.'],
            ['Accountability sharing', 'Choose who may receive your alerts. Private by default.'],
          ].map(([title, text]) => (
            <li key={title} className="bg-card rounded-xl border px-4 py-3">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-muted-foreground text-sm">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  return (
    <div className="lg:flex">
      <Suspense fallback={<DashboardNav name={null} email={session.email} />}>
        <NavWithProfile email={session.email} />
      </Suspense>
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1100px] px-4 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-12">
          <Suspense fallback={<DashboardLoading />}>
            <NameGate>{children}</NameGate>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
