/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage, Section } from '@/components/prose-page';

export const metadata: Metadata = {
  title: 'About',
  description: 'Why Resolve exists, what it does and does not do, and the commitments behind it.',
};

// From the project README ("Why Resolve?", "About Resolve", "Our commitments"), in the present
// tense where the beta now does what the README planned.
export default function AboutPage() {
  return (
    <ProsePage
      title="About Resolve"
      intro={
        <p>
          Resolve is a privacy-focused browser protection and accountability tool that helps
          believers set healthier digital boundaries: on-device media blurring, website blocking
          chosen by your group, and accountability that only reaches people you choose and who
          agree.
        </p>
      }
    >
      <Section title="Why “Resolve”?">
        <p>
          The name draws inspiration from Jonathan Edwards’s <em>Resolutions</em> (1722). The
          tagline, “Take every thought captive”, comes from 2 Corinthians 10:5: taking every thought
          captive to obey Christ. Resolve is a practical aid to accountability, not a substitute for
          spiritual formation, the work of the Holy Spirit, or trusted relationships.
        </p>
      </Section>

      <Section title="What it is for">
        <p>
          Resolve is for believers who want to take their thoughts captive and walk in greater
          faithfulness to Christ, especially online, where temptation can be private, persistent and
          hard to resist. Its central purpose is mutual accountability among fellow believers:
          making it easier for trusted brothers and sisters in Christ to encourage, exhort, pray for
          and support one another.
        </p>
        <p>
          God has given the local church and the fellowship of believers as means of encouragement
          and care (Hebrews 3:12–13; Galatians 6:1–2; James 5:16). We encourage every believer to
          join, take part faithfully in, and be accountable within a sound local church, where
          pastors, elders and fellow members know and care for them personally. Resolve is only a
          supporting tool, never a replacement for membership, discipleship, pastoral oversight,
          fellowship or accountability in the local church. Accountability should be voluntary,
          gracious and respectful, and never used to shame or control someone.
        </p>
      </Section>

      <Section title="A tool, not the mortifier of sin">
        <p>
          No browser extension, blocked website or automated email can put sin to death on anyone’s
          behalf. Mortification is the believer’s responsibility by the Spirit and through God’s
          grace (Romans 8:13). Resolve can help remove opportunities for temptation, encourage
          vigilance and invite the support of fellow believers. It must never become a substitute
          for repentance, prayer, Scripture, personal responsibility, pastoral care or dependence on
          Christ.
        </p>
      </Section>

      <Section title="What Resolve does">
        <ul>
          <li>
            <strong>Blurs images and videos on your device</strong>, if you turn it on. A model
            packaged with the extension checks media inside your browser; nothing is uploaded for
            checking, and media that cannot be checked stays blurred by default.
          </li>
          <li>
            <strong>Blocks the websites your group chooses.</strong> Admins keep a confidential list
            of non-negotiable and additional websites; members can add websites but cannot see the
            list. Essential services always stay reachable.
          </li>
          <li>
            <strong>Sends accountability alerts only with consent.</strong> You choose who may
            receive alerts about you (private by default), and each of them must agree to receive
            them. Admins cannot change either choice.
          </li>
        </ul>
      </Section>

      <Section title="When an alert is sent">
        <p>There are only two kinds of alert:</p>
        <ul>
          <li>
            A deliberate visit to a website on your group’s non-negotiable list, which the extension
            blocks. Media blurring, ordinary browsing, background page requests and the additional
            list never send an alert.
          </li>
          <li>Leaving, or being removed from, a group.</li>
        </ul>
        <p>
          Alerts never name the website and never include screenshots, recordings, addresses or
          browsing history. They say what kind of event happened, and that a browser-reported visit
          is not proof of intent. Private sharing sends no alerts at all.
        </p>
      </Section>

      <Section title="Free, without ads">
        <p>
          Resolve is free to use and free of advertising: protection and accountability without
          monetising attention or browsing habits. It is independently maintained and sustained as
          resources allow, so continued availability and future features cannot be guaranteed. A
          voluntary donation option may be added later; it would never unlock features or be
          required to use Resolve.
        </p>
      </Section>

      <Section title="Our commitments">
        <ul>
          <li>
            <strong>Consent before disclosure:</strong> you choose your sharing, and recipients must
            agree to receive alerts.
          </li>
          <li>
            <strong>Privacy by design:</strong> no screenshots or recordings, as little event data
            as possible, no selling of browsing data, and no uploading of web media for AI checks.
          </li>
          <li>
            <strong>Accessible by intention:</strong> no advertising and no paid tiers.
          </li>
          <li>
            <strong>Honest limitations:</strong> the extension can be turned off or removed, it does
            not cover other browsers or devices, and the AI makes mistakes in both directions.
            Resolve is support, not a guarantee.
          </li>
          <li>
            <strong>Faithful stewardship:</strong> security, transparency and reliability as
            resources allow.
          </li>
        </ul>
        <p>
          Read the <Link href="/privacy">privacy policy</Link> for exactly what is stored, or{' '}
          <Link href="/getting-started">get started</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
