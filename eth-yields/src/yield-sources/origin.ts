// src/yield-sources/origin.ts
// Origin Protocol ARM stETH vault data

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
  
  // Type for DeFiLlama pools
  type LlamaPool = {
    pool: string;
    chain: string;
    project: string;
    symbol: string;
    tvlUsd: number;
    apy?: number;
    apyBase?: number;
    apyReward?: number;
  };
  
  async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...opts,
      headers: { accept: "application/json", ...(opts?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Origin fetch failed ${res.status} for ${url}`);
    return (await res.json()) as T;
  }
  
  function asPct(x: number | undefined): number {
    if (x == null || !Number.isFinite(x)) return 0;
    // If it's already a percentage (>1.5), return as-is. Otherwise multiply by 100.
    return x <= 1.5 ? x * 100 : x;
  }
  
  // Fetch from DeFiLlama pools API
  async function fetchFromDeFiLlama(): Promise<Opportunity | null> {
    try {
      const data = await fetchJson<{ data: LlamaPool[] }>(
        "https://yields.llama.fi/pools",
        { cache: "no-store" }
      );
  
      const pools = data.data ?? [];
  
      // Look for Origin ARM pool on Ethereum mainnet
      // Specifically the WETH-stETH ARM vault
      const armPool = pools.find(
        (p) => {
          const project = (p.project ?? "").toLowerCase();
          const chain = (p.chain ?? "").toLowerCase();
          const symbol = (p.symbol ?? "").toLowerCase();
          
          return (
            project.includes("origin") &&
            project.includes("arm") &&
            chain === "ethereum" &&
            (symbol.includes("weth") || symbol.includes("steth")) &&
            typeof p.tvlUsd === "number" &&
            p.tvlUsd > 0
          );
        }
      );
  
      if (!armPool) {
        console.log("Origin ARM WETH-stETH pool not found in DeFiLlama");
        return null;
      }
  
      // Calculate total APY (base + rewards if present)
      const totalApy = (armPool.apy ?? armPool.apyBase ?? 0) + (armPool.apyReward ?? 0);
  
      console.log("Found Origin ARM WETH-stETH pool:", {
        symbol: armPool.symbol,
        tvl: armPool.tvlUsd,
        apy: totalApy,
        project: armPool.project,
        chain: armPool.chain
      });
  
      return {
        protocol: "Origin Protocol",
        product: "ARM WETH-stETH",
        tvlUsd: armPool.tvlUsd,
        apyPct: asPct(totalApy),
        url: "https://app.originprotocol.com/#/arm/1:ARM-WETH-stETH",
      };
    } catch (error) {
      console.error("Origin DeFiLlama fetch error:", error);
      return null;
    }
  }
  
  export async function getOriginYields(): Promise<YieldsResponse> {
    const opportunities: Opportunity[] = [];
  
    // Try DeFiLlama
    const llamaData = await fetchFromDeFiLlama();
    if (llamaData && llamaData.tvlUsd > 0) {
      opportunities.push(llamaData);
    }
  
    return {
      updatedAt: new Date().toISOString(),
      opportunities,
    };
  }