import { useEffect, useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { useAuth } from "@/hooks/use-auth";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (!user) { setIsAdmin(false); setChecked(true); return; }
    ponudimi.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }: { data: unknown }) => {
      setIsAdmin(!!data);
      setChecked(true);
    });
  }, [user, loading]);
  return { user, isAdmin, checked };
}
