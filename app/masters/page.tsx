"use client";

import { useEffect, useState } from "react";
import { listMasterRows } from "@/lib/data/masters";

const tabs = ["items", "units", "categories", "suppliers", "customers", "sub_agents"] as const;
type Tab = (typeof tabs)[number];

export default function MastersPage() {
  const [tab, setTab] = useState<Tab>("items");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listMasterRows(tab)
      .then((data) => { if (active) { setRows(data as Record<string, unknown>[]); setError(null); setLoading(false); } })
      .catch((err) => { if (active) { setError(err instanceof Error ? err.message : "Could not load data."); setLoading(false); } });
    return () => { active = false; };
  }, [tab]);

  const columns = rows.length ? Object.keys(rows[0]).filter((key) => !["id", "created_at", "updated_at"].includes(key)).slice(0, 6) : [];
  return <section className="page-panel"><div className="section-label">Masters</div><h1>Business masters</h1><p className="page-intro">Live records from the Mane Masala database.</p><div className="tab-row" role="tablist">{tabs.map((name) => <button key={name} className={tab === name ? "tab active" : "tab"} onClick={() => setTab(name)}>{name.replace("_", " ")}</button>)}</div>{loading && <p>Loading…</p>}{error && <p className="error-message">{error}</p>}{!loading && !error && rows.length === 0 && <p className="empty-state">No records yet.</p>}{!loading && !error && rows.length > 0 && <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}>{columns.map((column) => <td key={column}>{String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></div>}</section>;
}
