"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();

    try {
      setIsPending(true);
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleLogout}
      disabled={isPending}
      className="w-full sm:w-auto"
    >
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}
