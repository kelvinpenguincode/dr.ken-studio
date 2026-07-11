import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectOptionGroup = {
  label: string;
  options: SelectOption[];
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  placeholder?: string;
  options?: SelectOption[];
  groups?: SelectOptionGroup[];
};

export function Select({
  label,
  error,
  className,
  id,
  options = [],
  groups,
  placeholder = "Please select your product",
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
          error && "border-red-400 focus:border-red-400 focus:ring-red-100",
          className,
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {groups && groups.length > 0
          ? groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
      </select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
