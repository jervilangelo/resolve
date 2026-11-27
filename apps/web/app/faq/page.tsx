/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import { FaqList } from '@/components/faq-list';
import { MailIcon } from '@/components/icons';
import { PageHero } from '@/components/prose-page';
import { FAQ } from '@/lib/faq';
import { CONTACT_EMAIL } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  path: '/faq',
  title: 'FAQ',
  description:
    'Answers about Resolve: supported browsers, installing, Focus Mode, website blocking, accountability alerts, privacy and your account.',
});

export default function FaqPage() {
  return (
    <>
      <PageHero
        wide
        title="Frequently asked questions"
        intro={<p>How Resolve works, what it shares, and what it cannot do.</p>}
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Topics" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {FAQ.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted block rounded-lg px-3 py-2 transition-colors"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-12">
          {FAQ.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-24"
            >
              <h2 id={`${section.id}-title`} className="mb-4 text-xl font-semibold">
                {section.title}
              </h2>
              <FaqList items={section.items} name={section.id} />
            </section>
          ))}
          <section
            aria-labelledby="more"
            className="bg-muted/50 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6"
          >
            <div>
              <h2 id="more" className="font-semibold">
                Something else?
              </h2>
              <p className="text-muted-foreground text-sm">
                Resolve is maintained by one person, so replies may take time. Please don’t include
                websites you visited or screenshots of pages.
              </p>
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
            >
              <MailIcon width={18} height={18} />
              {CONTACT_EMAIL}
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
