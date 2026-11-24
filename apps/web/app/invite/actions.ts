/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use server';

import {
  groupSummarySchema,
  invitationPreviewSchema,
  invitationTokenSchema,
} from '@resolve/contracts';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { ApiRequestError, api } from '@/lib/api';
import { getSession } from '@/lib/auth';

/**
 * Invitation tokens arrive in the link's fragment and travel only in POST bodies (browser to this
 * server, and this server to the API), so they never appear in URLs, access logs or Referer headers.
 */
export type PreviewResult =
  | { status: 'ok'; groupName: string; expiresAt: string }
  | { status: 'signin' }
  | { status: 'invalid' };

export async function previewInvitation(token: unknown): Promise<PreviewResult> {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return { status: 'invalid' };
  if (!(await getSession())) return { status: 'signin' };
  try {
    const preview = await api('/v1/invitations/preview', invitationPreviewSchema, {
      method: 'POST',
      body: { token: parsed.data },
    });
    return { status: 'ok', ...preview };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiRequestError && error.status === 404) return { status: 'invalid' };
    throw error;
  }
}

export async function acceptInvitation(token: unknown): Promise<{ error?: string }> {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return { error: 'This invitation is not valid.' };
  let groupId: string;
  try {
    const group = await api('/v1/invitations/accept', groupSummarySchema, {
      method: 'POST',
      body: { token: parsed.data },
    });
    groupId = group.groupId;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiRequestError && error.code === 'CONFLICT') {
      return { error: 'This group is full. Ask the admin to make room.' };
    }
    if (error instanceof ApiRequestError && error.status === 404) {
      return { error: 'This invitation expired or was already used.' };
    }
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/dashboard/groups');
  redirect(`/dashboard/groups/${groupId}`);
}
