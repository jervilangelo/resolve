/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { Logo } from '@/components/logo';

const pillars = [
  {
    title: 'On-device AI media blurring',
    body: 'Supported images are classified inside your browser and blurred locally. Media is not uploaded for classification.',
  },
  {
    title: 'Group website restrictions',
    body: 'Accountability groups maintain confidential blocklists, while essential services stay protected from blocking.',
  },
  {
    title: 'Consent-based accountability',
    body: 'You choose who may be notified, recipients must agree, and notifications never include URLs, screenshots or history.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <Logo variant="stacked" height={160} priority className="mb-10" />
        <h1 className="font-display max-w-2xl text-3xl leading-tight sm:text-5xl">
          Take every thought captive.
        </h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-lg">
          Resolve is a privacy-first, Christian-inspired browser protection and voluntary
          accountability platform for believers seeking faithfulness in digital spaces. It is a
          supporting tool, never a replacement for the local church.
        </p>
        <p className="bg-secondary text-secondary-foreground mt-8 inline-block rounded-md px-3 py-1.5 text-sm font-medium">
          In development. The features below are planned and not yet available.
        </p>
      </section>
      <section aria-labelledby="planned" className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 id="planned" className="font-display text-2xl">
            What Resolve is being built to do
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {pillars.map((pillar) => (
              <li key={pillar.title} className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold">{pillar.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{pillar.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
