// src/yield-sources/stakeDAO.ts
// StakeDAO Curve strategies v2 (Ethereum mainnet)

export type Opportunity = {
    protocol: string;
    product: string;
    tvlUsd: number;
    apyPct: number;
    url: string;
  };
  
  export type YieldsResponse = {
    updatedAt: string;
    opportunities: Opportunity[];
  };
  
  type StakeDAOStrategy = {
    name: string;
    tvl?: number;
    apr?: {
      current?: {
        total?: number;
      };
    };
    minApr?: number;
    maxApr?: number;
    address?: string;
    gauge?: string;
  };
  
  // StakeDAO API endpoint - fetching from GitHub
  const STAKEDAO_API = "https://raw.githubusercontent.com/stake-dao/api/refs/heads/main/api/strategies/v2/curve/1.json";
  
  // Target StakeDAO Curve pools
  const TARGET_POOLS = new Set([
    "ETH+/WETH",
    "msETH/WETH",
    "alETH/WETH",
    "msETH/OETH",
    "alETH/frxETH",
    "dgnETH/ETH+"
  ]);
  
  async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...opts,
      headers: { accept: "application/json", ...(opts?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`StakeDAO fetch failed ${res.status} for ${url}`);
    return (await res.json()) as T;
  }
  
  function strategyTvlUsd(strategy: StakeDAOStrategy): number {
    const tvl = strategy.tvl;
    return typeof tvl === "number" && Number.isFinite(tvl) ? tvl : 0;
  }
  
  function strategyAprPct(strategy: StakeDAOStrategy): number {
    // Use current.total if available, otherwise fall back to minApr
    const apr = strategy.apr?.current?.total ?? strategy.minApr;
    return typeof apr === "number" && Number.isFinite(apr) ? apr : 0;
  }
  
  function isTargetStrategy(strategy: StakeDAOStrategy): boolean {
    if (!strategy.name) return false;
    const name = strategy.name.trim();
    return TARGET_POOLS.has(name);
  }
  
  function isValidStakeDAOStrategy(strategy: StakeDAOStrategy): boolean {
    if (!isTargetStrategy(strategy)) return false;
    if (strategyTvlUsd(strategy) <= 0) return false;
    return true;
  }
  
  export async function getStakeDAOYields(): Promise<YieldsResponse> {
    try {
      // StakeDAO v2 API returns a direct array
      const strategies = await fetchJson<StakeDAOStrategy[]>(
        STAKEDAO_API,
        { cache: "no-store" }
      );
  
      console.log("Total strategies fetched from StakeDAO:", strategies.length);
  
      // Debug: Log all ETH-related strategy names
      const ethStrategies = strategies
        .filter(s => (s.name || "").toLowerCase().includes("eth"))
        .map(s => s.name);
      console.log("All ETH strategies:", ethStrategies);
  
      // Group duplicates by name and pick the one with highest TVL
      const strategyMap = new Map<string, StakeDAOStrategy>();
      
      strategies
        .filter(isValidStakeDAOStrategy)
        .forEach((strategy) => {
          const name = strategy.name;
          const existing = strategyMap.get(name);
          
          // Keep the one with higher TVL
          if (!existing || strategyTvlUsd(strategy) > strategyTvlUsd(existing)) {
            strategyMap.set(name, strategy);
          }
        });
  
      const opportunities: Opportunity[] = Array.from(strategyMap.values())
        .map((strategy) => {
          const product = strategy.name;
          
          // Safely extract address as string
          let poolAddress = "";
          if (typeof strategy.address === "string") {
            poolAddress = strategy.address;
          } else if (typeof strategy.gauge === "string") {
            poolAddress = strategy.gauge;
          }
          
          const url = poolAddress
            ? `https://curve.fi/#/ethereum/pools/${poolAddress}/deposit`
            : "https://curve.fi";
  
          return {
            protocol: "StakeDAO",
            product,
            tvlUsd: strategyTvlUsd(strategy),
            apyPct: strategyAprPct(strategy),
            url,
          };
        })
        .sort((a, b) => b.tvlUsd - a.tvlUsd);
  
      console.log("StakeDAO opportunities found:", opportunities.length);
      console.log("StakeDAO opportunities:", opportunities);
  
      return {
        updatedAt: new Date().toISOString(),
        opportunities,
      };
    } catch (error) {
      console.error("StakeDAO fetch error:", error);
      return {
        updatedAt: new Date().toISOString(),
        opportunities: [],
      };
    }
  }