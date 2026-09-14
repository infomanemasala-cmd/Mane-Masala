import { createClient } from "@/lib/supabase/client";

export const workflowTables = {
  purchases: "purchases",
  purchase_lines: "purchase_lines",
  purchase_receipts: "purchase_receipts",
  inventory_batches: "inventory_batches",
  inventory_transactions: "inventory_transactions",
  stock_reservations: "stock_reservations",
  stock_outs: "stock_outs",
  recipes: "recipes",
  recipe_versions: "recipe_versions",
  recipe_lines: "recipe_lines",
  production_batches: "production_batches",
  production_consumption: "production_consumption",
  production_outputs: "production_outputs",
  orders: "orders",
  order_lines: "order_lines",
  dispatches: "dispatches",
  dispatch_lines: "dispatch_lines",
  sales: "sales",
  sale_lines: "sale_lines",
  invoices: "invoices",
  invoice_lines: "invoice_lines",
  supplier_payments: "supplier_payments",
  customer_payments: "customer_payments",
} as const;

export type WorkflowTable = keyof typeof workflowTables;

export async function listWorkflowRows(table: WorkflowTable, limit = 100) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(workflowTables[table])
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function insertWorkflowRow(table: WorkflowTable, values: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase.from(workflowTables[table]).insert(values).select().single();
  if (error) throw error;
  return data;
}
