/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { getEnv } from '../env';
import { type Route, createHandler } from '../http';
import { createRouter, createRoutes } from '../routes';
import { createDynamoStore } from '../store/dynamo';

let router: Route | undefined;

/** Single API Lambda behind API Gateway; built lazily so env errors use the error contract. */
export const handler = createHandler('api', (event, context) => {
  if (!router) {
    const env = getEnv();
    router = createRouter(createRoutes({ env, store: createDynamoStore(env.TABLE_NAME) }));
  }
  return router(event, context);
});
