/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/**
 * Encouragement for the accountability "Access Blocked" page. Bundled, so it works offline.
 *
 * Reflections are Resolve's own questions and are never attributed to anyone. Quotations are
 * either Scripture from the King James Version (public domain) or well-documented lines from
 * public-domain Puritan works, each with its author and work. Add a quotation only with a
 * verified source; never attribute an original line to a historical writer.
 */

export interface Quotation {
  text: string;
  /** e.g. "Psalm 101:3 (KJV)" or "John Owen". */
  source: string;
  /** The book a non-Scripture quotation comes from. */
  work?: string;
  theme: Theme;
}

export type Theme =
  | 'glory'
  | 'mortification'
  | 'temptation'
  | 'heart'
  | 'holiness'
  | 'christ'
  | 'grace'
  | 'accountability';

/** Resolve's own reflection questions (not quotations). The first is the default. */
export const REFLECTIONS: readonly string[] = [
  'Will this glorify God?',
  'Is this drawing you closer to Christ?',
  'What would faithfulness look like in this moment?',
  'Are you feeding your flesh or pursuing holiness?',
  'Who are you living for right now?',
  'Will you choose Christ over a passing pleasure?',
];

/** The quotation the page falls back to (and the first in the library). */
export const DEFAULT_QUOTE: Quotation = {
  text: 'Be killing sin or it will be killing you.',
  source: 'John Owen',
  work: 'Of the Mortification of Sin in Believers',
  theme: 'mortification',
};

export const QUOTATIONS: readonly Quotation[] = [
  DEFAULT_QUOTE,
  {
    text: 'Do you mortify; do you make it your daily work; be always at it whilst you live; cease not a day from this work.',
    source: 'John Owen',
    work: 'Of the Mortification of Sin in Believers',
    theme: 'mortification',
  },
  {
    text: 'Till sin be bitter, Christ will not be sweet.',
    source: 'Thomas Watson',
    work: 'The Doctrine of Repentance',
    theme: 'christ',
  },
  {
    text: 'Satan promises the best, but pays with the worst; he promises honour, and pays with disgrace; he promises pleasure, and pays with pain.',
    source: 'Thomas Brooks',
    work: 'Precious Remedies Against Satan’s Devices',
    theme: 'temptation',
  },
  {
    text: 'There is more mercy in Christ than sin in us.',
    source: 'Richard Sibbes',
    work: 'The Bruised Reed',
    theme: 'grace',
  },
  {
    text: 'The greatest difficulty in conversion is to win the heart to God; and the greatest difficulty after conversion is to keep the heart with God.',
    source: 'John Flavel',
    work: 'Keeping the Heart',
    theme: 'heart',
  },
  {
    text: 'I will set no wicked thing before mine eyes.',
    source: 'Psalm 101:3 (KJV)',
    theme: 'heart',
  },
  {
    text: 'Keep thy heart with all diligence; for out of it are the issues of life.',
    source: 'Proverbs 4:23 (KJV)',
    theme: 'heart',
  },
  {
    text: 'I made a covenant with mine eyes.',
    source: 'Job 31:1 (KJV)',
    theme: 'heart',
  },
  {
    text: 'Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God.',
    source: '1 Corinthians 10:31 (KJV)',
    theme: 'glory',
  },
  {
    text: 'God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape, that ye may be able to bear it.',
    source: '1 Corinthians 10:13 (KJV)',
    theme: 'temptation',
  },
  {
    text: 'If ye through the Spirit do mortify the deeds of the body, ye shall live.',
    source: 'Romans 8:13 (KJV)',
    theme: 'mortification',
  },
  {
    text: 'Walk in the Spirit, and ye shall not fulfil the lust of the flesh.',
    source: 'Galatians 5:16 (KJV)',
    theme: 'holiness',
  },
  {
    text: 'Watch and pray, that ye enter not into temptation: the spirit indeed is willing, but the flesh is weak.',
    source: 'Matthew 26:41 (KJV)',
    theme: 'temptation',
  },
  {
    text: 'Flee also youthful lusts: but follow righteousness, faith, charity, peace, with them that call on the Lord out of a pure heart.',
    source: '2 Timothy 2:22 (KJV)',
    theme: 'holiness',
  },
  {
    text: 'The grace of God that bringeth salvation hath appeared to all men, teaching us that, denying ungodliness and worldly lusts, we should live soberly, righteously, and godly, in this present world.',
    source: 'Titus 2:11–12 (KJV)',
    theme: 'grace',
  },
  {
    text: 'Exhort one another daily, while it is called To day; lest any of you be hardened through the deceitfulness of sin.',
    source: 'Hebrews 3:13 (KJV)',
    theme: 'accountability',
  },
  {
    text: 'Confess your faults one to another, and pray one for another, that ye may be healed.',
    source: 'James 5:16 (KJV)',
    theme: 'accountability',
  },
];

/** A random index in [0, length), different from `previous` whenever there is a choice. */
export function pickIndex(length: number, previous: number | null, random = Math.random): number {
  if (length <= 1) return 0;
  const candidates = previous === null || previous < 0 || previous >= length ? length : length - 1;
  let index = Math.floor(random() * candidates);
  if (previous !== null && previous >= 0 && previous < length && index >= previous) index += 1;
  return Math.min(index, length - 1);
}
