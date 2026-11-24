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
  addBlockedDomain,
  createInvitation,
  dissolveGroup,
  leaveGroup,
  removeBlockedDomain,
  removeMember,
  renameGroup,
  revokeInvitation,
  setBlockedDomainType,
  setMemberRole,
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

export function RenameGroupForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, action, pending] = useActionState(renameGroup.bind(null, groupId), {});
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="group-name">Group name</Label>
        <Input id="group-name" name="name" defaultValue={name} maxLength={60} required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Rename'}
      </Button>
      <div className="sm:basis-full">
        <ErrorText message={state.error} />
        {state.saved && (
          <p role="status" className="text-primary text-sm">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}

export function RoleButton({
  groupId,
  userId,
  name,
  to,
  self,
}: {
  groupId: string;
  userId: string;
  name: string;
  to: 'ADMIN' | 'MEMBER';
  self: boolean;
}) {
  const label = to === 'ADMIN' ? 'Make admin' : self ? 'Step down' : 'Make member';
  const confirmText =
    to === 'ADMIN'
      ? `Make ${name} an admin? Admins can invite and remove members, change roles and dissolve the group.`
      : self
        ? 'Step down to member? You will lose admin rights in this group.'
        : `Change ${name} to a regular member?`;
  return (
    <ConfirmButton
      label={label}
      confirmText={confirmText}
      run={() => setMemberRole(groupId, userId, to)}
    />
  );
}

export function DissolveGroupPanel({ groupId, name }: { groupId: string; name: string }) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Dissolving removes the group, its members and its invite links for everyone. This cannot be
        undone.
      </p>
      <div className="max-w-sm space-y-2">
        <Label htmlFor="confirm-dissolve">Type the group name to confirm</Label>
        <Input
          id="confirm-dissolve"
          value={typed}
          autoComplete="off"
          onChange={(e) => {
            setTyped(e.target.value);
          }}
        />
      </div>
      <Button
        type="button"
        variant="destructive"
        disabled={pending || typed !== name}
        onClick={() => {
          start(async () => {
            const result = await dissolveGroup(groupId);
            setError(result.error);
          });
        }}
      >
        {pending ? 'Dissolving…' : 'Dissolve group'}
      </Button>
      <ErrorText message={error} />
    </div>
  );
}

export function BlockDomainForm({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  const [state, action, pending] = useActionState(addBlockedDomain.bind(null, groupId), {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="domain">Website to block</Label>
          <Input id="domain" name="domain" placeholder="example.com" autoComplete="off" required />
        </div>
        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="type">Category</Label>
            <select
              id="type"
              name="type"
              defaultValue="ADDITIONAL"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="ADDITIONAL">Additional</option>
              <option value="NON_NEGOTIABLE">Non-negotiable</option>
            </select>
          </div>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : isAdmin ? 'Block' : 'Submit'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Covers the website and all its subdomains. Essential services (such as Gmail, YouTube and
        Microsoft 365) always stay reachable.
      </p>
      <ErrorText message={state.error} />
      {state.message && (
        <p role="status" className="text-primary text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function DomainActions({
  groupId,
  domain,
  type,
}: {
  groupId: string;
  domain: string;
  type: 'NON_NEGOTIABLE' | 'ADDITIONAL';
}) {
  const to = type === 'ADDITIONAL' ? 'NON_NEGOTIABLE' : 'ADDITIONAL';
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ConfirmButton
        label={to === 'NON_NEGOTIABLE' ? 'Make non-negotiable' : 'Make additional'}
        confirmText={`Change ${domain} to ${to === 'NON_NEGOTIABLE' ? 'non-negotiable' : 'additional'}?`}
        run={() => setBlockedDomainType(groupId, domain, to)}
      />
      <ConfirmButton
        label="Remove"
        confirmText={`Stop blocking ${domain} for this group?`}
        run={() => removeBlockedDomain(groupId, domain)}
      />
    </div>
  );
}
