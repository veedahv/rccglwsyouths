"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { describeAuthError, MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/authErrors";
import { formatPersonName } from "@/lib/formatName";
import RequireAuth from "@/components/RequireAuth";
import PasswordInput from "@/components/PasswordInput";
import { Page, PageHeader, Card, Field, Notice, Badge } from "@/components/ui";

function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    const problem = validateNewPassword(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    if (next === current) {
      setError("Your new password must be different from your current one.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <Field label="Current password">
        <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
      </Field>
      <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
        <PasswordInput
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
        />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>

      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">Your password has been changed.</Notice>}

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

function ProfileInner() {
  const { user, exco, roleLabel } = useAuth();
  if (!exco) return null;

  return (
    <Page size="md">
      <PageHeader title="My profile" description="Your account details and password." />

      <div className="space-y-6">
        <Card
          title={formatPersonName(exco.name, exco.gender)}
          action={<Badge tone="purple">{roleLabel}</Badge>}
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Sign-in email" value={user?.email ?? exco.email} />
            <DetailRow label="Phone" value={exco.phone} />
            <DetailRow label="Unit" value={exco.unit} />
            {exco.title && <DetailRow label="Title" value={exco.title} />}
          </dl>
          <p className="hint mt-4">To update these details, ask an admin who manages excos.</p>
        </Card>

        <Card title="Change password" description="You'll need your current password to set a new one.">
          <ChangePasswordForm />
        </Card>
      </div>
    </Page>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
