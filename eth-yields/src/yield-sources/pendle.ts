// src/yield-sources/pendle.ts
// Pendle PT market data (Ethereum mainnet) for a small allowlist of underlyings.

export type Opportunity = {
    protocol: string;
    product: string;
    tvlUsd: number;
    apyPct: number;
    url: string;
  };
  
  export type YieldsResponse = {
    updatedAt: string; // ISO string
    opportunities: Opportunity[];
  };
  
  type PendleMarket = {
    chainId: number;
    address: string;
  
    // Pendle returns expiry as ISO string in your sample
    expiry?: string | null;
  
    // What we should match on (exists in your sample)
    simpleSymbol?: string;
    simpleName?: string;
  
    // TVL in your sample lives under liquidity.usd
    liquidity?: { usd?: number };
  
    // PT yield in your sample exists as impliedApy (fraction)
    impliedApy?: number;
  
    // Optional nested shapes we might use for labels
    sy?: { proSymbol?: string; simpleSymbol?: string };
    pt?: { symbol?: string };
  };
  
  const PENDLE_CORE_BASE = "https://api-v2.pendle.finance/core";
  
  // Your allowlist
  const TARGET_UNDERLYINGS = new Set(["ghETH", "dETH", "ysETH", "pufETH", "tETH", "strETH"]);
  
  async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...opts,
      headers: { accept: "application/json", ...(opts?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Pendle fetch failed ${res.status} for ${url}`);
    return (await res.json()) as T;
  }
  
  function asPct(x: number | undefined): number {
    if (x == null || !Number.isFinite(x)) return 0;
    return x <= 1.5 ? x * 100 : x;
  }
  
  function expiryDate(iso?: string | null): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  }
  
  async function fetchAllMainnetMarkets(): Promise<PendleMarket[]> {
    // Your response shape matches: array of markets
    // Keep a couple of candidates in case Pendle changes paths.
    const candidates = [
      `${PENDLE_CORE_BASE}/v1/1/markets?limit=1000`,
      `${PENDLE_CORE_BASE}/v1/1/markets`,
    ];
  
    let lastErr: unknown;
    for (const url of candidates) {
      try {
        const data = await fetchJson<any>(url);
  
        if (Array.isArray(data)) return data as PendleMarket[];
        if (Array.isArray(data?.markets)) return data.markets as PendleMarket[];
        if (Array.isArray(data?.data)) return data.data as PendleMarket[];
        if (Array.isArray(data?.results)) return data.results as PendleMarket[];
  
        throw new Error(`Unexpected response shape from ${url}`);
      } catch (e) {
        lastErr = e;
      }
    }
  
    throw lastErr instanceof Error ? lastErr : new Error("Failed to fetch Pendle markets");
  }
  
  function marketUnderlyingLabel(m: PendleMarket): string | undefined {
    // Match what your sample actually provides
    return m.simpleSymbol ?? m.sy?.proSymbol ?? m.sy?.simpleSymbol;
  }
  
  function marketTvlUsd(m: PendleMarket): number {
    const tvl = m.liquidity?.usd;
    return typeof tvl === "number" && Number.isFinite(tvl) ? tvl : 0;
  }
  
  function isTargetMarket(m: PendleMarket): boolean {
    if (m.chainId !== 1) return false;
    const label = marketUnderlyingLabel(m);
    if (!label) return false;
    return TARGET_UNDERLYINGS.has(label);
  }
  
  export async function getPendleYields(): Promise<YieldsResponse> {
    const markets = await fetchAllMainnetMarkets();


    const opportunities: Opportunity[] = markets
      .filter(isTargetMarket)
      .map((m) => {
        const label = marketUnderlyingLabel(m) ?? "Unknown";
        const exp = expiryDate(m.expiry);
        const product = `Pendle PT ${label}${exp ? ` (exp ${exp})` : ""}`;
  
        const url = `https://app.pendle.finance/trade/markets/${m.address}?chain=ethereum&view=pt`;
  
        return {
          protocol: "Pendle",
          product,
          tvlUsd: marketTvlUsd(m),
          apyPct: asPct(m.impliedApy), // PT fixed/implied APY
          url,
        };
      })
      .sort((a, b) => b.tvlUsd - a.tvlUsd);
  
    return {
      updatedAt: new Date().toISOString(),
      opportunities,
    };
  }
  