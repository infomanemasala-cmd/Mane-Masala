"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function HealthPage() {
  const [status, setStatus] = useState("Checking database…");
  useEffect(() => {
    const supabase = createClient();
    supabase.from("business_settings").select("business_name").limit(1).then(({ error }) => {
      setStatus(error ? `Database check failed: ${error.message}` : "Database connection is working.");
    });
  }, []);
  return <section className="page-panel"><div className="section-label">System</div><h1>Connection check</h1><p className="page-intro">{status}</p></section>;
}
