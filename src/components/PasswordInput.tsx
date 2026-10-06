"use client";

import { useState } from "react";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
}

// A password input with a Show/Hide toggle — useful on a phone, where
// typos in a new password are easy to make and hard to spot.
export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
  disabled,
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pr-16"
        required={required}
        minLength={minLength}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-rccg-purple-600 hover:text-rccg-purple-800"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
