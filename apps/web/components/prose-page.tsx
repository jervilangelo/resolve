/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ReactNode } from 'react';
import { CONTACT_EMAIL } from '@/lib/site';

/** The title band every public page opens with. */
export function PageHero({
  title,
  intro,
  meta,
  wide = false,
}: {
  title: string;
  intro?: ReactNode;
  meta?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="bg-muted/40 border-b">
      <div className={`mx-auto px-5 py-14 sm:px-8 sm:py-20 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
        {intro && (
          <div className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
            {intro}
          </div>
        )}
        {meta && <div className="text-muted-foreground mt-4 text-sm">{meta}</div>}
      </div>
    </div>
  );
}

/** Layout for public text pages (privacy, terms, getting started). */
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
    <article>
      <PageHero title={title} intro={intro} meta={updated && `Last updated ${updated}`} />
      <div className="mx-auto max-w-3xl space-y-10 px-5 py-14 leading-relaxed sm:px-8 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
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

/** The public contact address. */
export function Contact() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}
