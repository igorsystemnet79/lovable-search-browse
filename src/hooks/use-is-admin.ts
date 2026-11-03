import { useEffect, useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { useAuth } from "@/hooks/use-auth";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!user) { setIsAdmin(false); setIsModerator(false); setChecked(true); return; }
    setChecked(false);
    Promise.all([ponudimi.rpc("has_role", { _user_id: user.id, _role: "admin" }), ponudimi.rpc("has_role", { _user_id: user.id, _role: "moderator" })])
      .then(([a, m]) => { if (!active) return; setIsAdmin(!!a.data); setIsModerator(!!m.data); setChecked(true); })
      .catch(() => { if (active) { setIsAdmin(false); setIsModerator(false); setChecked(true); } });
    return () => { active = false; };
  }, [user, loading]);
  return { user, isAdmin, isModerator, checked };
}
