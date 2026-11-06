import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ClearableSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
};

export function ClearableSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  inputMode,
}: ClearableSearchInputProps) {
  return (
    <div className="relative flex w-full min-w-0 flex-1 items-center">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        inputMode={inputMode}
        className={cn("w-full min-w-0 bg-transparent pr-14 outline-none placeholder:text-muted-foreground", className)}
      />
      <button
        type="button"
        aria-label={`Obriši: ${ariaLabel.toLowerCase()}`}
        title="Obriši tekst"
        onClick={() => onChange("")}
        className="absolute right-0 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 appearance-none items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white opacity-100 shadow-lg hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        style={{ display: "flex", visibility: "visible", opacity: 1, backgroundColor: "#f97316", color: "#ffffff", pointerEvents: "auto" }}
      >
        <span aria-hidden="true" className="text-2xl font-bold leading-none">×</span>
      </button>
    </div>
  );
}
