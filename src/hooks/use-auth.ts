import { useEffect, useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";

type User = { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string };

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data } = ponudimi.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    ponudimi.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
