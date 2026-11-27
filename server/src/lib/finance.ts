interface Money {
  amountEgp: number;
  isEstimate: boolean;
}
interface Harvest {
  quantityTon: number;
  isEstimate: boolean;
}
interface Sale {
  quantityTon: number;
  pricePerTonEgp: number;
  isEstimate: boolean;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMarginPct: number | null;
  harvestTon: number;
  soldTon: number;
  unsoldTon: number;
  costPerTon: number | null;
  expensesByCategory: Record<string, number>;
}

function summarizeSubset(expenses: (Money & { category: string })[], harvests: Harvest[], sales: Sale[]): FinancialSummary {
  const totalRevenue = sales.reduce((a, s) => a + s.quantityTon * s.pricePerTonEgp, 0);
  const totalCosts = expenses.reduce((a, e) => a + e.amountEgp, 0);
  const netProfit = totalRevenue - totalCosts;
  const harvestTon = harvests.reduce((a, h) => a + h.quantityTon, 0);
  const soldTon = sales.reduce((a, s) => a + s.quantityTon, 0);
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amountEgp;
  return {
    totalRevenue,
    totalCosts,
    netProfit,
    profitMarginPct: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null,
    harvestTon,
    soldTon,
    unsoldTon: Math.max(0, harvestTon - soldTon),
    costPerTon: harvestTon > 0 ? totalCosts / harvestTon : null,
    expensesByCategory,
  };
}

/** Actual and estimated figures are always computed separately and never mixed. */
export function financialSummary(expenses: (Money & { category: string })[], harvests: Harvest[], sales: Sale[]) {
  return {
    actual: summarizeSubset(
      expenses.filter((e) => !e.isEstimate),
      harvests.filter((h) => !h.isEstimate),
      sales.filter((s) => !s.isEstimate),
    ),
    estimated: summarizeSubset(
      expenses.filter((e) => e.isEstimate),
      harvests.filter((h) => h.isEstimate),
      sales.filter((s) => s.isEstimate),
    ),
  };
}
