/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { getEnv } from '../env';
import { type Route, createHandler } from '../http';
import { createRouter, createRoutes } from '../routes';
import { createDynamoStore } from '../store/dynamo';

let router: Route | undefined;

/** Single API Lambda behind API Gateway; built lazily so env errors use the error contract. */
export const handler = createHandler('api', (event, context) => {
  if (!router) {
    const env = getEnv();
    const pool = env.USER_POOL_ID;
    const cognito = new CognitoIdentityProviderClient({});
    router = createRouter(
      createRoutes({
        env,
        store: createDynamoStore(env.TABLE_NAME),
        // With email sign-in, the Cognito username is the user's sub.
        deleteIdentity: pool
          ? async (userId) => {
              await cognito
                .send(new AdminDeleteUserCommand({ UserPoolId: pool, Username: userId }))
                .catch((error: unknown) => {
                  if (!(error instanceof UserNotFoundException)) throw error;
                });
            }
          : undefined,
      }),
    );
  }
  return router(event, context);
});
