import { getPendleYields } from "@/yield-sources/pendle";
import { getStakeDAOYields } from "@/yield-sources/stakeDAO";
import { getOriginYields } from "@/yield-sources/origin";

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
      // Fetch ALL sources in parallel with Promise.allSettled
      const [llamaResult, pendleResult, stakeDaoResult, originResult] = await Promise.allSettled([
        fetchJson<{ data: LlamaPool[] }>("https://yields.llama.fi/pools", { cache: "no-store" }),
        getPendleYields(),
        getStakeDAOYields(),
        getOriginYields(),
      ]);

      // Process DeFiLlama data (Lido, Rocket Pool)
      if (llamaResult.status === "fulfilled") {
        const pools = llamaResult.value.data ?? [];
  
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
      } else {
        console.error("DeFiLlama fetch error:", llamaResult.reason);
      }
      
      // Process Pendle
      if (pendleResult.status === "fulfilled") {
        opportunities.push(...pendleResult.value.opportunities);
      } else {
        console.error("Pendle fetch error:", pendleResult.reason);
      }

      // Process StakeDAO
      if (stakeDaoResult.status === "fulfilled") {
        console.log("StakeDAO opportunities before push:", stakeDaoResult.value.opportunities.length);
        opportunities.push(...stakeDaoResult.value.opportunities);
        console.log("Total opportunities after StakeDAO:", opportunities.length);
      } else {
        console.error("StakeDAO fetch error:", stakeDaoResult.reason);
      }

      // Process Origin
      if (originResult.status === "fulfilled") {
        console.log("Origin opportunities before push:", originResult.value.opportunities.length);
        opportunities.push(...originResult.value.opportunities);
        console.log("Total opportunities after Origin:", opportunities.length);
      } else {
        console.error("Origin fetch error:", originResult.reason);
      }
    
    } catch (error) {
      console.error("Main yields fetch error:", error);
    }

    // Debug: Count StakeDAO entries
    const stakeDaoCount = opportunities.filter(o => o.protocol === "StakeDAO").length;
    console.log("Final StakeDAO count in opportunities:", stakeDaoCount);
    console.log("Total final opportunities:", opportunities.length);
  
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
        { protocol: "StakeDAO", product: "dgnETH/ETH+", tvlUsd: 0, apyPct: 0, url: "https://curve.fi" },
        { protocol: "Origin Protocol", product: "ARM stETH Vault", tvlUsd: 0, apyPct: 0, url: "https://app.originprotocol.com" }
      );
    }
  
    return { updatedAt, opportunities };
  }