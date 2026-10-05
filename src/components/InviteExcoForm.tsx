"use client";

import { useState } from "react";
import { inviteExco } from "@/lib/excos";
import { formatPersonName } from "@/lib/formatName";
import { Card, Field, Notice } from "@/components/ui";
import type { ExcoMember } from "@/types";

/** Maps an invite failure to something a non-developer can act on. */
export function inviteErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === "auth/email-already-in-use") return "That email already has an account.";
  if (code === "auth/invalid-email") return "That doesn't look like a valid email address.";
  return "Couldn't send this invite. Try again.";
}

interface ResultProps {
  name: string;
  email: string;
  password: string;
  emailSent: boolean;
  onDone: () => void;
}

/** Shown after a successful invite: the temporary password, once. */
export function InviteResult({ name, email, password, emailSent, onDone }: ResultProps) {
  return (
    <Card title={`${name} has been invited`}>
      <div className="max-w-md space-y-4">
        {emailSent ? (
          <Notice tone="success">
            We emailed {email} a link to set their own password. If it doesn&apos;t arrive, you can share the
            temporary sign-in details below instead.
          </Notice>
        ) : (
          <Notice tone="warning">
            Their login is ready, but we couldn&apos;t send the email. Share these sign-in details with them
            directly. They won&apos;t be shown again.
          </Notice>
        )}
        <dl className="panel space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 text-muted">Email</dt>
            <dd className="font-medium">{email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-muted">Password</dt>
            <dd className="font-mono font-medium">{password}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">The temporary password is only shown now. Encourage them to change it after first sign-in.</p>
        <button onClick={onDone} className="btn-primary">
          Done
        </button>
      </div>
    </Card>
  );
}

interface Props {
  exco: ExcoMember;
  onDone: () => void; // called after the admin dismisses the result screen
  onCancel: () => void;
}

/** Invites an exco who doesn't have a login yet: asks for an email, then creates the login. */
export default function InviteExcoForm({ exco, onDone, onCancel }: Props) {
  const displayName = formatPersonName(exco.name, exco.gender);
  const [email, setEmail] = useState(exco.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError("Email is required to create a login.");

    setSaving(true);
    setError(null);
    try {
      const { password, emailSent } = await inviteExco(exco, email);
      setResult({ email: email.trim(), password, emailSent });
    } catch (err) {
      setError(inviteErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return <InviteResult name={displayName} {...result} onDone={onDone} />;
  }

  return (
    <Card
      title={`Invite ${displayName}`}
      description="This creates their login and emails them a link to set a password. Their role and details are already saved."
    >
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Inviting…" : "Send invite"}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
