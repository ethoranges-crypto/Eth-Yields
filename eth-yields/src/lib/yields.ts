import { getPendleYields } from "@/yield-sources/pendle";
import { getStakeDAOYields } from "@/yield-sources/stakeDAO";

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
  
  type LlamaPool = {
    pool: string;
    chain: string;
    project: string;
    symbol: string;
    tvlUsd: number;
    apy?: number;
  };
  
  async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
    return (await res.json()) as T;
  }
  
  function pickBestPool(
    pools: LlamaPool[],
    opts: { project: string; chain?: string; symbolIncludes: string[] }
  ): LlamaPool | null {
    const chain = (opts.chain ?? "Ethereum").toLowerCase();
  
    const candidates = pools
      .filter((p) => (p.project ?? "").toLowerCase() === opts.project.toLowerCase())
      .filter((p) => (p.chain ?? "").toLowerCase() === chain)
      .filter((p) =>
        opts.symbolIncludes.every((s) =>
          (p.symbol ?? "").toLowerCase().includes(s.toLowerCase())
        )
      )
      .filter((p) => typeof p.tvlUsd === "number" && Number.isFinite(p.tvlUsd) && p.tvlUsd > 0)
      .filter((p) => typeof p.apy === "number" && Number.isFinite(p.apy));
  
    if (candidates.length === 0) return null;
  
    candidates.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
    return candidates[0];
  }
  
  export async function getYields(): Promise<YieldsResponse> {
    const updatedAt = new Date().toISOString();
    const opportunities: Opportunity[] = [];
  
    try {
      const data = await fetchJson<{ data: LlamaPool[] }>("https://yields.llama.fi/pools", {
        cache: "no-store",
      });
  
      const pools = data.data ?? [];
  
      const lido = pickBestPool(pools, {
        project: "lido",
        chain: "Ethereum",
        symbolIncludes: ["steth"],
      });
  
      const rocketPool = pickBestPool(pools, {
        project: "rocket-pool",
        chain: "Ethereum",
        symbolIncludes: ["reth"],
      });
  
      if (lido) {
        opportunities.push({
          protocol: "Lido",
          product: "stETH",
          tvlUsd: lido.tvlUsd,
          apyPct: lido.apy ?? 0,
          url: "https://lido.fi",
        });
      }
  
      if (rocketPool) {
        opportunities.push({
          protocol: "Rocket Pool",
          product: "rETH",
          tvlUsd: rocketPool.tvlUsd,
          apyPct: rocketPool.apy ?? 0,
          url: "https://rocketpool.net",
        });
      }
      
      try {
        const pendle = await getPendleYields();
        opportunities.push(...pendle.opportunities);
      } catch (error) {
        console.error("Pendle fetch error:", error);
      }

      try {
        const stakeDAO = await getStakeDAOYields();
        opportunities.push(...stakeDAO.opportunities);
      } catch (error) {
        console.error("StakeDAO fetch error:", error);
      }
    
    } catch (error) {
      console.error("Main yields fetch error:", error);
    }
  
    // Minimal fallback
    if (opportunities.length === 0) {
      opportunities.push(
        { protocol: "Lido", product: "stETH", tvlUsd: 0, apyPct: 0, url: "https://lido.fi" },
        { protocol: "Rocket Pool", product: "rETH", tvlUsd: 0, apyPct: 0, url: "https://rocketpool.net" },
        { protocol: "Pendle", product: "PT ghETH", tvlUsd: 0, apyPct: 0, url: "https://app.pendle.finance" },
        { protocol: "Pendle", product: "PT dETH", tvlUsd: 0, apyPct: 0, url: "https://app.pendle.finance" },
        { protocol: "Pendle", product: "PT ysETH", tvlUsd: 0, apyPct: 0, url: "https://app.pendle.finance" },
        { protocol: "Pendle", product: "PT pufETH", tvlUsd: 0, apyPct: 0, url: "https://app.pendle.finance" },
        { protocol: "Pendle", product: "PT tETH", tvlUsd: 0, apyPct: 0, url: "https://app.pendle.finance" },
        { protocol: "Pendle", product: "PT strETH", tvlUsd: 0, apyPct: 0, url: "https://app.pendle.finance" },
        { protocol: "StakeDAO", product: "ETH+/WETH", tvlUsd: 0, apyPct: 0, url: "https://curve.fi" },
        { protocol: "StakeDAO", product: "msETH/WETH", tvlUsd: 0, apyPct: 0, url: "https://curve.fi" },
        { protocol: "StakeDAO", product: "alETH/WETH", tvlUsd: 0, apyPct: 0, url: "https://curve.fi" },
        { protocol: "StakeDAO", product: "msETH/OETH", tvlUsd: 0, apyPct: 0, url: "https://curve.fi" },
        { protocol: "StakeDAO", product: "alETH/frxETH", tvlUsd: 0, apyPct: 0, url: "https://curve.fi" },
        { protocol: "StakeDAO", product: "dgnETH/ETH+", tvlUsd: 0, apyPct: 0, url: "https://curve.fi" }
      );
    }
  
    return { updatedAt, opportunities };
  }