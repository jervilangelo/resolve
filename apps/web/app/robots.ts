/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { MetadataRoute } from 'next';

/**
 * Documented crawlers that collect content for AI training or AI products and say they honour
 * robots.txt. This states the owner's intent; it cannot stop a crawler that ignores it.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Meta-ExternalAgent',
  'FacebookBot',
  'PerplexityBot',
  'Amazonbot',
  'cohere-ai',
  'cohere-training-data-crawler',
  'Diffbot',
  'Omgilibot',
  'AI2Bot',
  'Timpibot',
  'ImagesiftBot',
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...AI_CRAWLERS], disallow: '/' },
      // Ordinary search engines may index the public pages, never accounts or invitations.
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/auth', '/invite'] },
    ],
  };
}
