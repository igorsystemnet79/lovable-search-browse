import type { HTMLAttributes } from "react";
import { X } from "lucide-react";
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
        className={cn("w-full min-w-0 bg-transparent pr-12 outline-none placeholder:text-muted-foreground", className)}
      />
      <button
        type="button"
        aria-label={`Obriši: ${ariaLabel.toLowerCase()}`}
        title="Obriši tekst"
        onClick={() => onChange("")}
        className="absolute right-0 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white opacity-100 shadow-md transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <X className="h-5 w-5" strokeWidth={3} />
      </button>
    </div>
  );
}
