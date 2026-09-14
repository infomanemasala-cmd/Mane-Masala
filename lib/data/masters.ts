import { createClient } from "@/lib/supabase/client";

export type MasterTable = "items" | "units" | "categories" | "suppliers" | "customers" | "sub_agents";

const tableMap: Record<MasterTable, string> = {
  items: "items",
  units: "units",
  categories: "categories",
  suppliers: "suppliers",
  customers: "customers",
  sub_agents: "sub_agents",
};

export async function listMasterRows(table: MasterTable) {
  const supabase = createClient();
  const { data, error } = await supabase.from(tableMap[table]).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertMasterRow(table: MasterTable, values: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase.from(tableMap[table]).insert(values).select().single();
  if (error) throw error;
  return data;
}

export async function updateMasterRow(table: MasterTable, id: string, values: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase.from(tableMap[table]).update(values).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
