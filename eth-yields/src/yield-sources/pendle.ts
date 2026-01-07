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
 // Removed fixed allowlist - now accepting all ETH-denominated markets
  
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
    const limit = 100; // Max limit that works
    let skip = 0;
    let allMarkets: PendleMarket[] = [];
    let hasMore = true;
    
    console.log(`🔄 Starting to fetch all Pendle markets with pagination...`);
    
    while (hasMore) {
      const url = `${PENDLE_CORE_BASE}/v1/1/markets?limit=${limit}&skip=${skip}`;
      
      try {
        const data = await fetchJson<any>(url);
        
        if (data?.results && Array.isArray(data.results)) {
          const fetchedCount = data.results.length;
          allMarkets.push(...data.results);
          
          console.log(`✅ Fetched ${fetchedCount} markets (total so far: ${allMarkets.length}/${data.total || '?'})`);
          
          // Check if we've fetched everything
          if (fetchedCount < limit || allMarkets.length >= (data.total || Infinity)) {
            hasMore = false;
            console.log(`🏁 Finished! Fetched all ${allMarkets.length} markets`);
          } else {
            skip += limit;
          }
        } else {
          hasMore = false;
          console.error(`❌ Unexpected response format`);
        }
      } catch (e) {
        hasMore = false;
        console.error(`❌ Failed fetching markets at skip=${skip}:`, e instanceof Error ? e.message : 'Unknown error');
        
        // If we already have some markets, return them instead of failing completely
        if (allMarkets.length > 0) {
          console.log(`⚠️ Returning ${allMarkets.length} markets fetched before error`);
          break;
        }
        throw new Error("Failed to fetch Pendle markets");
      }
    }
    
    return allMarkets;
  }
  
  function marketUnderlyingLabel(m: PendleMarket): string | undefined {
    // Match what your sample actually provides
    return m.simpleSymbol ?? m.sy?.proSymbol ?? m.sy?.simpleSymbol;
  }
  
  function marketTvlUsd(m: PendleMarket): number {
    const tvl = m.liquidity?.usd;
    return typeof tvl === "number" && Number.isFinite(tvl) ? tvl : 0;
  }
  
  function isExpired(expiry?: string | null): boolean {
    if (!expiry) return false;
    const expiryDate = new Date(expiry);
    const now = new Date();
    return expiryDate < now;
  }

  function isTargetMarket(m: PendleMarket, targetChainId: number): boolean {
    if (m.chainId !== targetChainId) return false;
    const label = marketUnderlyingLabel(m);
    if (!label) return false;
    
    // Accept all markets where the underlying contains "ETH"
    // This captures stETH, rETH, eETH, weETH, pufETH, etc.
    const labelLower = label.toLowerCase();
    return labelLower.includes("eth");
  }
  
  export async function getPendleYields(chainId: number = 1): Promise<YieldsResponse> {
    const markets = await fetchAllMainnetMarkets();
  
    console.log(`📊 Total markets fetched: ${markets.length}`);
  const ethMarkets = markets
  .filter(m => isTargetMarket(m, chainId))
  .filter(m => !isExpired(m.expiry)); // Remove expired markets
  console.log(`🎯 ETH markets after filtering: ${ethMarkets.length}`);
  
    const opportunities: Opportunity[] = ethMarkets
      .map((m) => {
        const label = marketUnderlyingLabel(m) ?? "Unknown";
        const exp = expiryDate(m.expiry);
        const product = `Pendle PT ${label}${exp ? ` (exp ${exp})` : ""}`;
  
        const url = `https://app.pendle.finance/trade/markets/${m.address}?chain=ethereum&view=pt`;
  
        return {
          protocol: "Pendle",
          product,
          tvlUsd: marketTvlUsd(m),
          apyPct: asPct(m.impliedApy),
          url,
        };
      })
      .sort((a, b) => b.tvlUsd - a.tvlUsd);
  
    return {
      updatedAt: new Date().toISOString(),
      opportunities,
    };
  }
