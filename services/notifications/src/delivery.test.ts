/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { AlertTypePrefs, ConsentRecord, OutboxItem, SharingRecord } from '@resolve/contracts';
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
  const alertTypes = new Map<string, AlertTypePrefs>();
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
    getAlertTypes: (_g, user) => Promise.resolve(alertTypes.get(user) ?? null),
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
    alertTypes,
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

const ON = { removal: true, inactivity: true };
const OFF = { removal: false, inactivity: false };

describe('installation alerts (§7.4)', () => {
  const removal = (overrides: Partial<OutboxItem> = {}) =>
    navigation({
      kind: 'EXTENSION_REMOVED',
      occurredAt: '2026-11-24T00:00:00.000Z',
      recipientIds: ['carol', 'dave'],
      ...overrides,
    });

  it('need the sender to share the type and each recipient to have agreed to it', async () => {
    const t = setup(removal());
    t.alertTypes.set('bob', { share: ON, receive: OFF });
    t.alertTypes.set('carol', { share: OFF, receive: ON });
    t.alertTypes.set('dave', { share: OFF, receive: { removal: false, inactivity: true } });
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ sent: 1, no_consent: 1 });
    expect(t.sent.map((m) => m.to)).toEqual(['carol@example.test']);
  });

  it('re-check at send time: a sender who stopped sharing the type sends nothing', async () => {
    const t = setup(removal({ kind: 'EXTENSION_INACTIVE' }));
    t.alertTypes.set('bob', { share: { removal: true, inactivity: false }, receive: OFF });
    t.alertTypes.set('carol', { share: OFF, receive: ON });
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ not_shared: 2 });
    expect(t.sent).toEqual([]);
  });

  it('re-check the usual consent too: withdrawn after the event, nothing is sent', async () => {
    const t = setup(removal());
    t.alertTypes.set('bob', { share: ON, receive: OFF });
    t.alertTypes.set('carol', { share: OFF, receive: ON });
    t.consents.set('carol', { acceptAll: false, senders: {} });
    t.consents.delete('dave');
    expect(await deliverOutbox('out_1', t.deps)).toEqual({ no_consent: 2 });
  });

  it('emails give the name, what happened and when: no group, no website', () => {
    const url = 'https://app.example.test';
    const removed = alertEmail(removal(), url);
    expect(removed.subject).toBe('Resolve was removed from a browser');
    expect(removed.text).toContain(
      'Resolve was removed from one of Bob’s browsers on 24 November 2026, 00:00 UTC.',
    );
    const inactive = alertEmail(
      removal({ kind: 'EXTENSION_INACTIVE', occurredAt: '2026-11-21T09:30:00.000Z' }),
      url,
    );
    expect(inactive.text).toContain(
      'Resolve hasn’t checked in from one of Bob’s browsers since 21 November 2026, 09:30 UTC.',
    );
    expect(inactive.text).toContain('closed, or the computer is off or offline');
    for (const email of [removed, inactive]) {
      expect(email.text).not.toContain('Brothers');
      expect(email.text).not.toContain(GROUP);
      expect(email.text).toContain(`${url}/dashboard/groups`);
    }
    const anonymous = alertEmail(removal({ senderName: null }), url);
    expect(anonymous.text).toContain('one of a member of your accountability group’s browsers');
  });
});
