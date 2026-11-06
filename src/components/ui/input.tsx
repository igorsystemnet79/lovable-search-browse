import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, value, defaultValue, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const setInputRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const inputClassName = cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      type === "search" && "pr-10",
      className,
    );

    if (type === "search") {
      const clearSearch = () => {
        const input = inputRef.current;
        if (!input || input.disabled) return;
        input.value = "";
        if (onChange) {
          onChange({
            target: input,
            currentTarget: input,
          } as React.ChangeEvent<HTMLInputElement>);
        } else {
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        input.focus();
      };

      return (
        <div className="relative w-full">
          <input
            type="search"
            className={inputClassName}
            ref={setInputRef}
            onChange={onChange}
            value={value}
            defaultValue={defaultValue}
            {...props}
          />
          <button
            type="button"
            aria-label="Obriši tekst pretrage"
            title="Obriši pretragu"
            disabled={props.disabled}
            onClick={clearSearch}
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-100 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      );
    }

    return (
      <input
        type={type}
        className={inputClassName}
        ref={forwardedRef}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
