import { X } from "lucide-react";

type ClearableSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
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
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        inputMode={inputMode}
        className={`w-full min-w-0 bg-transparent pr-9 outline-none placeholder:text-muted-foreground ${className ?? ""}`}
      />
      <button
        type="button"
        aria-label={`Obriši: ${ariaLabel.toLowerCase()}`}
        title="Obriši pretragu"
        onClick={() => onChange("")}
        className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-100 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
