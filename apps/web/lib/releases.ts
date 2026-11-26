/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import 'server-only';
import { z } from 'zod';
import { REPOSITORY } from './site';

const releaseSchema = z.object({
  tag_name: z.string(),
  name: z.string().nullable(),
  html_url: z.url(),
  published_at: z.iso.datetime().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.url(), size: z.number() })),
});

export interface LatestRelease {
  version: string;
  url: string;
  publishedAt: string | null;
  /** The Chromium build (Chrome, Edge, Brave), when the release ships one. */
  chromium: { url: string; name: string; size: number } | null;
  /** The Firefox build, when the release ships one. */
  firefox: { url: string; name: string; size: number } | null;
}

export type ReleaseLookup =
  { state: 'ok'; release: LatestRelease } | { state: 'none' } | { state: 'unavailable' };

/**
 * The latest published, non-prerelease GitHub release (GitHub's "latest" excludes drafts and
 * pre-releases). Cached for an hour; a failure never shows invented data.
 */
export async function latestRelease(): Promise<ReleaseLookup> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'resolve-website' },
      next: { revalidate: 3600 },
    });
    if (res.status === 404) return { state: 'none' };
    if (!res.ok) return { state: 'unavailable' };
    const parsed = releaseSchema.safeParse(await res.json());
    if (!parsed.success || parsed.data.draft || parsed.data.prerelease) return { state: 'none' };
    const r = parsed.data;
    const asset = (test: RegExp) => {
      const a = r.assets.find((item) => test.test(item.name) && item.name.endsWith('.zip'));
      return a ? { url: a.browser_download_url, name: a.name, size: a.size } : null;
    };
    return {
      state: 'ok',
      release: {
        version: r.tag_name.replace(/^v/, ''),
        url: r.html_url,
        publishedAt: r.published_at,
        chromium: asset(/chrom/i),
        firefox: asset(/firefox|gecko/i),
      },
    };
  } catch {
    return { state: 'unavailable' };
  }
}
