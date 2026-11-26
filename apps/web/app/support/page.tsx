/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CheckIcon, HeartIcon, MailIcon } from '@/components/icons';
import { PageHero } from '@/components/prose-page';
import { CONTACT_EMAIL, GCASH_QR } from '@/lib/site';

const PARTNER_EMAIL = 'deleonangelojervil@gmail.com';
const PARTNER_MAILTO = `mailto:${PARTNER_EMAIL}?subject=Resolve%20Partnership%20or%20Sponsorship`;

export const metadata: Metadata = {
  title: 'Support Resolve',
  description: 'Resolve is free. Voluntary donations help keep it available.',
};

export default function SupportPage() {
  return (
    <>
      <PageHero
        wide
        title="Help keep Resolve available"
        intro={
          <p>
            Resolve is an independently maintained project. It stays available as long as I can give
            it the time and resources it needs.
          </p>
        }
      />
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="space-y-4 text-lg leading-relaxed">
            <p>
              If Resolve has helped you and you would like to support its development and
              maintenance, you can give a voluntary donation through GCash.
            </p>
            <p className="text-muted-foreground">Every contribution is appreciated.</p>
          </div>
          <ul className="space-y-3">
            {[
              'Completely optional: Resolve stays free with or without a donation.',
              'Donations never unlock features; there are no paid tiers or subscriptions.',
              'Donations do not buy a support plan or guarantee future availability.',
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <CheckIcon className="text-muted-foreground mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            Questions about Resolve itself? Start with the{' '}
            <Link href="/faq" className="underline underline-offset-4">
              FAQ
            </Link>
            , or email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <section aria-labelledby="partner" className="bg-card rounded-2xl border p-6">
            <h2 id="partner" className="flex items-center gap-2 font-semibold">
              <MailIcon width={18} height={18} />
              Partner with Resolve
            </h2>
            <p className="mt-3 leading-relaxed">
              If you’d like to partner with me on Resolve or sponsor its development, I’d love to
              hear from you. Email me at{' '}
              <a
                href={PARTNER_MAILTO}
                className="font-medium break-words underline underline-offset-4"
              >
                {PARTNER_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>

        <section aria-labelledby="donate" className="bg-card rounded-2xl border p-6">
          <h2 id="donate" className="flex items-center gap-2 font-semibold">
            <HeartIcon width={18} height={18} />
            Donate with GCash
          </h2>
          {GCASH_QR ? (
            <>
              <Image
                src={GCASH_QR.src}
                width={GCASH_QR.width}
                height={GCASH_QR.height}
                alt="GCash InstaPay QR code for donations to Resolve"
                className="mx-auto mt-5 h-auto w-full max-w-[18rem] rounded-xl bg-white"
              />
              <p className="text-muted-foreground mt-4 text-sm">
                Scan with GCash, or any bank app that reads InstaPay QR Ph codes.
              </p>
            </>
          ) : (
            <div className="text-muted-foreground mt-5 grid aspect-square place-items-center rounded-xl border-2 border-dashed p-6 text-center text-sm">
              The GCash QR code will appear here soon.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
