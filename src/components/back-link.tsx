import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Link "nazad" koji se vraća jedan korak unazad u istoriji pregledača
 * ako korisnik došao sa neke druge strane sajta; ako je strana otvorena
 * direktno (nema prethodne strane), vodi na `to` (podrazumevano početnu).
 */
export function BackLink({
  to = "/",
  className,
  children,
}: {
  to?: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      to={to}
      className={className}
      onClick={(e) => {
        const idx =
          typeof window !== "undefined"
            ? (window.history.state?.__TSR_index as number | undefined)
            : undefined;
        if (typeof idx === "number" && idx > 0) {
          e.preventDefault();
          router.history.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
