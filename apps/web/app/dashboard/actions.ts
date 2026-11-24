/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use server';

import {
  createGroupRequestSchema,
  groupSummarySchema,
  idempotencyKeySchema,
  profileSchema,
  updateProfileRequestSchema,
} from '@resolve/contracts';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { ApiRequestError, api } from '@/lib/api';

export interface FormState {
  error?: string;
  saved?: boolean;
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function errorMessage(error: unknown, invalid: string): string {
  if (error instanceof ApiRequestError && error.code === 'VALIDATION_FAILED') return invalid;
  return GENERIC_ERROR;
}

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const input = updateProfileRequestSchema.safeParse({ displayName: formData.get('displayName') });
  if (!input.success) return { error: 'Enter a name of 1–60 characters without < or >.' };
  try {
    await api('/v1/me', profileSchema, { method: 'PATCH', body: input.data });
  } catch (error) {
    unstable_rethrow(error); // let sign-in redirects through
    return { error: errorMessage(error, 'That name is not allowed.') };
  }
  revalidatePath('/dashboard', 'layout');
  return { saved: true };
}

export async function createGroup(_state: FormState, formData: FormData): Promise<FormState> {
  const input = createGroupRequestSchema.safeParse({ name: formData.get('name') });
  if (!input.success) return { error: 'Enter a group name of 1–60 characters without < or >.' };
  // Rendered into the form once, so a double submit or retry creates only one group.
  const key = idempotencyKeySchema.safeParse(formData.get('idempotencyKey'));
  let groupId: string;
  try {
    const group = await api('/v1/groups', groupSummarySchema, {
      method: 'POST',
      body: input.data,
      headers: key.success ? { 'idempotency-key': key.data } : {},
    });
    groupId = group.groupId;
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error, 'That group name is not allowed.') };
  }
  revalidatePath('/dashboard/groups');
  redirect(`/dashboard/groups/${groupId}`);
}
