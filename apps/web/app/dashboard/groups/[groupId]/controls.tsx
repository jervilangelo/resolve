/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type ActionState,
  createInvitation,
  leaveGroup,
  removeMember,
  revokeInvitation,
} from './actions';

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

export function InvitePanel({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(createInvitation.bind(null, groupId), {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="maxUses">People who can use the link</Label>
          <select
            id="maxUses"
            name="maxUses"
            defaultValue="1"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="1">1 person</option>
            <option value="5">Up to 5 people</option>
            <option value="10">Up to 10 people</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create invite link'}
        </Button>
      </form>
      <ErrorText message={state.error} />
      {state.link && (
        <div className="bg-muted space-y-2 rounded-md p-4">
          <Label htmlFor="invite-link">Share this link privately</Label>
          <div className="flex gap-2">
            <Input
              id="invite-link"
              readOnly
              value={state.link}
              onFocus={(e) => {
                e.target.select();
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(state.link ?? '').then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Shown only once. Anyone with the link can join until it expires on{' '}
            {new Date(state.expiresAt ?? '').toLocaleDateString('en', { dateStyle: 'long' })}.
          </p>
        </div>
      )}
    </div>
  );
}

function ConfirmButton({
  label,
  confirmText,
  run,
  variant = 'outline',
}: {
  label: string;
  confirmText: string;
  run: () => Promise<ActionState>;
  variant?: 'outline' | 'destructive';
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          start(async () => {
            const result = await run();
            setError(result.error);
          });
        }}
      >
        {pending ? 'Working…' : label}
      </Button>
      <ErrorText message={error} />
    </span>
  );
}

export function RemoveMemberButton({
  groupId,
  userId,
  name,
}: {
  groupId: string;
  userId: string;
  name: string;
}) {
  return (
    <ConfirmButton
      label="Remove"
      confirmText={`Remove ${name} from this group?`}
      run={() => removeMember(groupId, userId)}
    />
  );
}

export function RevokeInvitationButton({
  groupId,
  invitationId,
}: {
  groupId: string;
  invitationId: string;
}) {
  return (
    <ConfirmButton
      label="Revoke"
      confirmText="Revoke this invite link? It will stop working immediately."
      run={() => revokeInvitation(groupId, invitationId)}
    />
  );
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  return (
    <ConfirmButton
      label="Leave group"
      variant="destructive"
      confirmText="Leave this group? You will need a new invitation to rejoin."
      run={() => leaveGroup(groupId)}
    />
  );
}
