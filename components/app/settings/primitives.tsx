import type { ReactNode } from "react";
import { MotionRegion } from "@/components/motion/motion-region";
export function SettingsHeading({
  title,
  description,
  scope,
}: {
  title: string;
  description: string;
  scope?: string;
}) {
  return (
    <header className="settings-heading">
      {scope ? <p className="settings-caption">{scope}</p> : null}
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}
export function SettingsFeedback({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <>
      {error ? (
        <p role="alert" className="settings-error">
          {error}
        </p>
      ) : null}
      {message ? (
        <MotionRegion variant="status" changeKey={message}>
          <p role="status" className="settings-message">
            {message}
          </p>
        </MotionRegion>
      ) : null}
    </>
  );
}
export function SettingsToggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <span>
        <strong>{label}</strong>
        <small>{note}</small>
      </span>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
