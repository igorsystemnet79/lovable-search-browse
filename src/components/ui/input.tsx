import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", onChange, value, defaultValue, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const setInputRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };
    const clearable = ["text", "search", "email", "tel", "url"].includes(type);
    const inputClassName = cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      clearable && "pr-12",
      className,
    );
    const clearValue = () => {
      const input = inputRef.current;
      if (!input || input.disabled) return;
      input.value = "";
      if (onChange) onChange({ target: input, currentTarget: input } as React.ChangeEvent<HTMLInputElement>);
      else {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      input.focus();
    };
    if (clearable) {
      return (
        <div className="relative w-full min-w-0">
          <input type={type} className={inputClassName} ref={setInputRef} onChange={onChange} value={value} defaultValue={defaultValue} {...props} />
          <button type="button" aria-label="Obriši tekst" title="Obriši tekst" disabled={props.disabled} onClick={clearValue}
            className="absolute right-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white opacity-100 shadow-md transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40">
            <X className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>
      );
    }
    return <input type={type} className={inputClassName} ref={forwardedRef} value={value} defaultValue={defaultValue} onChange={onChange} {...props} />;
  },
);
Input.displayName = "Input";
export { Input };
