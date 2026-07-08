"use client";

// Small shared form primitives for the track editor panels.

import type { ReactNode } from "react";

export function PanelSection({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded border border-zinc-700 bg-[#1b232e] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-zinc-300">
      <span className="shrink-0 text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`ui-input w-full rounded border border-zinc-600 bg-[#10151d] px-2 py-1 text-xs text-zinc-200 outline-none ${className ?? ""}`}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  step = 0.001,
  min,
  max,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      step={step}
      min={min}
      max={max}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`ui-input w-24 rounded border border-zinc-600 bg-[#10151d] px-2 py-1 text-right font-mono text-xs text-zinc-200 outline-none ${className ?? ""}`}
    />
  );
}

export function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-36 shrink-0 text-zinc-400">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 flex-1 accent-cyan-400"
      />
      <span className="w-10 text-right font-mono text-zinc-300">{value.toFixed(2)}</span>
    </div>
  );
}

export function SmallButton({
  children,
  onClick,
  tone = "default",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger" | "accent";
  disabled?: boolean;
  title?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-800 text-red-300 hover:border-red-600"
      : tone === "accent"
        ? "border-cyan-700 text-cyan-300 hover:border-cyan-500"
        : "border-zinc-600 text-zinc-300 hover:border-zinc-400";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`ui-interactive rounded border bg-[#10151d] px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}
