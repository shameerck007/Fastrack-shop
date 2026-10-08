"use client";

import { Children, Fragment, isValidElement, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import SearchSelect, { type SelectOption } from "@/components/ui/SearchSelect";

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode; "data-hint"?: string };
type GroupProps = { label?: string; children?: ReactNode };

function text(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement(node)) return text((node.props as { children?: ReactNode }).children);
  return "";
}

function collect(children: ReactNode, group: string | undefined, out: SelectOption[]) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<OptionProps & GroupProps>;
    if (el.type === Fragment) {
      collect(el.props.children, group, out);
    } else if (el.type === "optgroup") {
      collect(el.props.children, el.props.label, out);
    } else if (el.type === "option") {
      const label = text(el.props.children);
      out.push({ value: el.props.value != null ? String(el.props.value) : label, label, hint: el.props["data-hint"], group, disabled: el.props.disabled });
    }
  });
}

// Layout classes (width, margins, grid spans) are kept from the old <select className>; the look comes from SearchSelect.
const LAYOUT = /^(?:[a-z-]+:)*(?:w-|min-w-|max-w-|flex-|grow|shrink|mt-|mb-|ms-|me-|mx-|my-|col-span-|self-|basis-)/;

/**
 * A drop-in replacement for <select> with <option> / <optgroup> children: same value / onChange(e.target.value) / disabled / name,
 * but it opens the app's searchable list (search box for long lists, bottom sheet on phones).
 */
export default function Select({
  value,
  onChange,
  disabled,
  className = "",
  children,
  name,
  required,
  id,
  searchable,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string | number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  name?: string;
  required?: boolean;
  id?: string;
  searchable?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const options: SelectOption[] = [];
  collect(children, undefined, options);
  const layout = className
    .split(/\s+/)
    .filter((c) => LAYOUT.test(c))
    .join(" ");
  const pill = /\brounded-full\b/.test(className);
  const small = pill || /\b(?:py-1|text-xs)\b/.test(className);
  const empty = options.find((o) => o.value === "");

  return (
    <SearchSelect
      options={options}
      value={String(value ?? "")}
      onChange={(v) => onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
      disabled={disabled}
      name={name}
      required={required}
      id={id}
      searchable={searchable}
      placeholder={placeholder ?? empty?.label ?? "Select…"}
      variant={pill ? "pill" : "field"}
      size={small ? "sm" : "md"}
      ariaLabel={ariaLabel}
      className={layout || (pill ? "" : "w-full")}
    />
  );
}
