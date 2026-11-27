export function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sd(xs: number[]) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number) {
  const MAXIT = 200;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function incBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Student t with df degrees of freedom. */
export function tTwoSidedP(t: number, df: number) {
  return incBeta(df / (df + t * t), df / 2, 0.5);
}

/** Critical t value for a two-sided 95% interval (bisection on the CDF). */
export function tCrit95(df: number) {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedP(mid, df) > 0.05) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface Summary {
  n: number;
  mean: number | null;
  sd: number | null;
  se: number | null;
  ci95: [number, number] | null;
}

export function summarize(xs: number[]): Summary {
  if (!xs.length) return { n: 0, mean: null, sd: null, se: null, ci95: null };
  const m = mean(xs);
  const s = sd(xs);
  const se = s != null ? s / Math.sqrt(xs.length) : null;
  const ci95: [number, number] | null = se != null ? [m - tCrit95(xs.length - 1) * se, m + tCrit95(xs.length - 1) * se] : null;
  return { n: xs.length, mean: m, sd: s, se, ci95 };
}

/** Welch's unequal-variance t-test. Requires ≥2 replicates per group. */
export function welchTTest(a: number[], b: number[]) {
  if (a.length < 2 || b.length < 2) return null;
  const va = (sd(a) as number) ** 2 / a.length;
  const vb = (sd(b) as number) ** 2 / b.length;
  if (va + vb === 0) return null;
  const t = (mean(a) - mean(b)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { t, df, p: tTwoSidedP(Math.abs(t), df) };
}
