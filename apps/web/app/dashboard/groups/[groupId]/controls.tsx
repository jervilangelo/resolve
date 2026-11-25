/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { unstable_rethrow } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useToast } from '@/components/ui/toaster';
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
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="maxUses">People who can use the link</Label>
          <NativeSelect id="maxUses" name="maxUses" defaultValue="1">
            <option value="1">1 person</option>
            <option value="5">Up to 5 people</option>
            <option value="10">Up to 10 people</option>
          </NativeSelect>
        </div>
        <Button type="submit" loading={pending}>
          Create invite link
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
                const link = state.link ?? '';
                navigator.clipboard.writeText(link).then(
                  () => {
                    setCopied(link);
                  },
                  () => {
                    setCopied(null);
                  },
                );
              }}
            >
              {/* Tracks which link was copied, so a newly created link never reads "Copied". */}
              {copied === state.link ? 'Copied' : 'Copy'}
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
  title,
  description,
  confirmLabel,
  done,
  run,
  destructive = false,
}: {
  label: string;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Toast text once it worked; omitted when the page itself changes (leaving a group). */
  done?: string;
  run: () => Promise<ActionState>;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      pending={pending}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      trigger={
        <Button type="button" size="sm" variant="outline">
          {label}
        </Button>
      }
      onConfirm={() => {
        start(async () => {
          try {
            const result = await run();
            if (result.error) toast(result.error, 'error');
            else if (done) toast(done);
          } catch (error) {
            unstable_rethrow(error); // redirects (sign-in, leaving) are navigations, not failures
            toast('Something went wrong. Please try again.', 'error');
          } finally {
            setOpen(false);
          }
        });
      }}
    />
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
      title={`Remove ${name}?`}
      description="They leave the group and stop following its blocked websites. They need a new invite to rejoin."
      confirmLabel="Remove"
      destructive
      done={`${name} was removed.`}
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
      title="Revoke this invite link?"
      description="It stops working immediately. People who already joined stay in the group."
      confirmLabel="Revoke link"
      done="Invite link revoked."
      run={() => revokeInvitation(groupId, invitationId)}
    />
  );
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  return (
    <ConfirmButton
      label="Leave group"
      title="Leave this group?"
      description="You will need a new invite to rejoin."
      confirmLabel="Leave group"
      destructive
      run={() => leaveGroup(groupId)}
    />
  );
}

export function RenameGroupForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, action, pending] = useActionState(renameGroup.bind(null, groupId), {});
  return (
    <form action={action} className="max-w-lg space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input id="group-name" name="name" defaultValue={name} maxLength={60} required />
        </div>
        <Button type="submit" variant="outline" loading={pending}>
          Rename
        </Button>
      </div>
      <ErrorText message={state.error} />
      {state.saved && (
        <p role="status" className="text-primary text-sm">
          Saved.
        </p>
      )}
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
  const title =
    to === 'ADMIN'
      ? `Make ${name} an admin?`
      : self
        ? 'Step down to member?'
        : `Make ${name} a member?`;
  const description =
    to === 'ADMIN'
      ? 'Admins manage blocked websites, invite and remove members, and can dissolve the group.'
      : self
        ? 'You will lose admin rights in this group.'
        : 'They keep their membership but lose admin rights.';
  return (
    <ConfirmButton
      label={label}
      title={title}
      description={description}
      confirmLabel={label}
      done={
        to === 'ADMIN'
          ? `${name} is now an admin.`
          : self
            ? 'You are now a member.'
            : `${name} is now a member.`
      }
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
        loading={pending}
        disabled={pending || typed !== name}
        onClick={() => {
          start(async () => {
            const result = await dissolveGroup(groupId);
            setError(result.error);
          });
        }}
      >
        Dissolve group
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
            <NativeSelect id="type" name="type" defaultValue="ADDITIONAL">
              <option value="ADDITIONAL">Additional</option>
              <option value="NON_NEGOTIABLE">Non-negotiable</option>
            </NativeSelect>
          </div>
        )}
        <Button type="submit" loading={pending}>
          {isAdmin ? 'Block' : 'Submit'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Includes its subdomains. Essential services such as Gmail and Microsoft 365 always stay
        reachable.
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
  const toLabel = to === 'NON_NEGOTIABLE' ? 'non-negotiable' : 'additional';
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ConfirmButton
        label={to === 'NON_NEGOTIABLE' ? 'Make non-negotiable' : 'Make additional'}
        title={`Make ${domain} ${toLabel}?`}
        description={
          to === 'NON_NEGOTIABLE'
            ? 'A deliberate visit can then send an alert to members’ accountability partners.'
            : 'It stays blocked, but visits no longer send alerts.'
        }
        confirmLabel={`Make ${toLabel}`}
        done={`${domain} is now ${toLabel}.`}
        run={() => setBlockedDomainType(groupId, domain, to)}
      />
      <ConfirmButton
        label="Remove"
        title={`Stop blocking ${domain}?`}
        description="It becomes reachable for everyone in this group."
        confirmLabel="Stop blocking"
        destructive
        done={`${domain} is no longer blocked.`}
        run={() => removeBlockedDomain(groupId, domain)}
      />
    </div>
  );
}
