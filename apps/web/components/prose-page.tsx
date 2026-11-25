/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ReactNode } from 'react';
import { publicEnv } from '@/lib/env';

/** Layout for public text pages (privacy, terms, support, getting started). */
export function ProsePage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">{title}</h1>
      {updated && <p className="text-muted-foreground mt-2 text-sm">Last updated {updated}</p>}
      {intro && <div className="text-muted-foreground mt-6 text-lg leading-relaxed">{intro}</div>}
      <div className="mt-8 space-y-8 leading-relaxed [&_h2]:font-semibold [&_h2]:text-xl [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:underline">
        {children}
      </div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** The configured contact address, or a neutral fallback where none is configured. */
export function Contact() {
  const email = publicEnv.NEXT_PUBLIC_CONTACT_EMAIL;
  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <span>the contact address published with the release</span>
  );
}
