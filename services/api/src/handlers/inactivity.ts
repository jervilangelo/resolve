/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { z } from 'zod';
import { scanInactiveInstallations } from '../installations';
import { createLogger } from '../logger';
import { createDynamoStore } from '../store/dynamo';

const envSchema = z.object({
  TABLE_NAME: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * Scheduled inactivity check (docs/MASTER_PLAN.md §7.4), run by EventBridge Scheduler. Logs counts
 * only: never a user, group or installation.
 */
export async function handler(): Promise<void> {
  const env = envSchema.parse(process.env);
  const log = createLogger(env.LOG_LEVEL);
  // The function times out after 60 s; stop taking new batches after 40 s.
  const result = await scanInactiveInstallations(createDynamoStore(env.TABLE_NAME), new Date());
  log.log(
    result.failed > 0 ? 'warn' : 'info',
    `inactivity scan: due=${String(result.due)} alerted=${String(result.alerted)} silent=${String(result.silent)} changed=${String(result.changed)} failed=${String(result.failed)}`,
  );
}
