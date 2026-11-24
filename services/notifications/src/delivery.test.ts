/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ConsentRecord, OutboxItem, SharingRecord } from '@resolve/contracts';
import { describe, expect, it } from 'vitest';
import {
  type DeliveryDeps,
  OutOfTimeError,
  PermanentSendError,
  deliverOutbox as deliver,
} from './delivery';

/** The outcome counts only (the result also names the item's kind). */
const deliverOutbox = async (id: string, deps: DeliveryDeps) => (await deliver(id, deps)).outcomes;
import { alertEmail } from './email';

const GROUP = 'grp_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const JOINED = '2026-01-01T00:00:00.000Z';
const LATER = '2026-06-01T00:00:00.000Z';
const NOW = new Date('2026-11-24T00:05:00.000Z');

function navigation(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    outboxId: 'out_1',
    kind: 'NON_NEGOTIABLE_NAVIGATION',
    groupId: GROUP,
    groupName: 'Brothers',
    senderId: 'bob',
    senderName: 'Bob',
    senderJoinedAt: JOINED,
    recipientIds: ['carol', 'dave'],
    createdAt: '2026-11-24T00:00:00.000Z',
    ...overrides,
  };
}

function setup(item: OutboxItem) {
  const members = new Map<string, string>([
    ['bob', JOINED],
    ['carol', JOINED],
    ['dave', JOINED],
  ]);
  const sharing = new Map<string, SharingRecord>([
    ['bob', { mode: 'EVERYONE', recipients: {}, updatedAt: LATER }],
  ]);
  const consents = new Map<string, ConsentRecord>([
    ['carol', { acceptAll: true, senders: {} }],
    ['dave', { acceptAll: false, senders: { bob: LATER } }],
  ]);
  const claims = new Map<string, string>();
  const sent: { to: string; subject: string; text: string }[] = [];
  let failNext: Error | null = null;
  let charged = 0;
  let remaining = Number.POSITIVE_INFINITY;
  const deps: DeliveryDeps = {
    getOutbox: (id) => Promise.resolve(id === item.outboxId ? item : null),
    getMembership: (_g, user) => {
      const joinedAt = members.get(user);
      return Promise.resolve(joinedAt ? { joinedAt } : null);
    },
    getSharing: (_g, user) => Promise.resolve(sharing.get(user) ?? null),
    getConsent: (_g, user) => Promise.resolve(consents.get(user) ?? null),
    claim: (id, user) => {
      if (claims.has(`${id}#${user}`)) return Promise.resolve(false);
      claims.set(`${id}#${user}`, 'claimed');
      return Promise.resolve(true);
    },
    markSending: (id, user) => {
      claims.set(`${id}#${user}`, 'sending');
      return Promise.resolve();
    },
    release: (id, user) => {
      claims.delete(`${id}#${user}`);
      return Promise.resolve();
    },
    finish: (id, user, outcome) => {
      claims.set(`${id}#${user}`, outcome);
      return Promise.resolve();
    },
    chargeRecipient: (_user, _bucket, max) => {
      if (charged >= max) return Promise.resolve(false);
      charged += 1;
      return Promise.resolve(true);
    },
    refundRecipient: () => {
      charged -= 1;
      return Promise.resolve();
    },
    remainingMs: () => remaining,
    emailOf: (user) => Promise.resolve(`${user}@example.test`),
    send: (to, message) => {
      if (failNext) {
        const error = failNext;
        failNext = null;
        return Promise.reject(error);
      }
      sent.push({ to, subject: message.subject, text: message.text });
      return Promise.resolve();
    },
    now: () => NOW,
    dashboardUrl: 'https://app.example.test',
  };
  return {
    deps,
    members,
    sharing,
    consents,
    claims,
    sent,
    failWith: (error: Error) => (failNext = error),
    setCharged: (n: number) => (charged = n),
    charged: () => charged,
    setRemaining: (ms: number) => (remaining = ms),
  };
}

describe('delivery worker', () => {
  it('sends one generic email per consenting recipient', async () => {
    const t = setup(navigation());
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ sent: 2 });
    expect(t.sent.map((m) => m.to)).toEqual(['carol@example.test', 'dave@example.test']);
    expect(t.sent[0]?.text).toContain('Bob triggered a non-negotiable website restriction');
  });

  it('re-checks consent, sharing and membership at send time', async () => {
    const t = setup(navigation());
    t.consents.set('carol', { acceptAll: false, senders: {} }); // withdrew after the event
    t.members.delete('dave'); // left after the event
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ no_consent: 1, not_member: 1 });
    expect(t.sent).toEqual([]);

    const p = setup(navigation());
    p.sharing.set('bob', { mode: 'PRIVATE', recipients: {}, updatedAt: LATER }); // went private
    expect(await deliverOutbox('out_1', p.deps)).toEqual({ not_shared: 2 });

    const r = setup(navigation());
    r.members.set('bob', LATER); // the sender left and rejoined: the old event no longer counts
    expect(await deliverOutbox('out_1', r.deps)).toEqual({ not_shared: 2 });
  });

  it('never tells someone who joined after the event (no retroactive disclosure)', async () => {
    const t = setup(navigation());
    t.members.set('carol', '2026-11-24T00:01:00.000Z'); // rejoined after the event
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ not_member: 1, sent: 1 });
    expect(t.sent.map((m) => m.to)).toEqual(['dave@example.test']);
  });

  it('does not resend when recording the outcome fails after sending', async () => {
    const t = setup(navigation());
    t.deps.finish = () => Promise.reject(new Error('Throttled'));
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ sent: 2 });
    expect(t.sent).toHaveLength(2);
  });

  it('never sends twice for the same recipient, even when the message is redelivered', async () => {
    const t = setup(navigation());
    await deliverOutbox('out_1', t.deps);
    await deliverOutbox('out_1', t.deps);
    expect(t.sent).toHaveLength(2);
  });

  it('retries transient failures and records permanent rejections', async () => {
    const t = setup(navigation());
    t.failWith(new Error('Throttling'));
    await expect(deliverOutbox('out_1', t.deps)).rejects.toThrow('Throttling');
    expect(t.claims.has('out_1#carol')).toBe(false); // released for the retry
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ sent: 2 });

    const p = setup(navigation());
    p.failWith(new PermanentSendError('MessageRejected'));
    expect(await deliverOutbox('out_1', p.deps)).toEqual({ rejected: 1, sent: 1 });
  });

  it('only delivered alerts count against the cap, even across retries', async () => {
    const t = setup(navigation());
    t.failWith(new Error('Throttling'));
    await expect(deliverOutbox('out_1', t.deps)).rejects.toThrow('Throttling');
    expect(t.charged()).toBe(0);
    await deliverOutbox('out_1', t.deps);
    expect(t.charged()).toBe(2);

    const p = setup(navigation());
    p.failWith(new PermanentSendError('MessageRejected'));
    await deliverOutbox('out_1', p.deps);
    expect(p.charged()).toBe(1);
  });

  it('stops before running out of time, leaving the rest for a retry', async () => {
    const t = setup(navigation());
    t.setRemaining(5_000);
    await expect(deliver('out_1', t.deps)).rejects.toBeInstanceOf(OutOfTimeError);
    expect(t.sent).toEqual([]);
    expect(t.claims.size).toBe(0);
    t.setRemaining(Number.POSITIVE_INFINITY);
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ sent: 2 });
  });

  it('caps alerts per recipient per hour and drops stale items', async () => {
    const t = setup(navigation());
    t.setCharged(10);
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ rate_limited: 2 });
    const old = setup(navigation({ createdAt: '2026-11-22T00:00:00.000Z' }));
    expect(await deliverOutbox('out_1', old.deps)).toEqual({ expired: 2 });
  });

  it('departure alerts use the pre-departure sharing, as the sender is gone', async () => {
    const item = navigation({
      kind: 'GROUP_DEPARTURE',
      departureSharing: { mode: 'SELECTED', recipients: { carol: LATER } },
    });
    const t = setup(item);
    t.members.delete('bob');
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ sent: 1, not_shared: 1 });
    expect(t.sent[0]).toMatchObject({
      to: 'carol@example.test',
      subject: 'Group update from Resolve',
    });
    expect(t.sent[0]?.text).toContain('Bob is no longer a member of Brothers.');
  });
});

describe('alert emails', () => {
  it('never mention browsing details and escape names in HTML', () => {
    const email = alertEmail(
      navigation({ senderName: 'Bob <b>', groupName: 'A & B' }),
      'https://app.example.test',
    );
    expect(email.html).toContain('Bob &lt;b&gt;');
    expect(email.html).toContain('A &amp; B');
    expect(email.text).toContain('is not proof of intent');
    expect(email.text).toContain(`https://app.example.test/dashboard/groups/${GROUP}`);
    const linky = alertEmail(
      navigation({ senderName: 'Verify at evil.example', groupName: 'www.phish.test' }),
      'https://app.example.test',
    );
    expect(linky.text).not.toMatch(/evil\.example|phish\.test/);
    const anonymous = alertEmail(navigation({ senderName: null }), 'https://app.example.test');
    expect(anonymous.text).toContain('A member of your accountability group triggered');
  });
});
