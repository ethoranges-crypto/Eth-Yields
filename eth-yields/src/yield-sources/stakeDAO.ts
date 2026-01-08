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
  
  // Target StakeDAO Curve pools with their vault addresses
  const TARGET_POOLS = new Map([
    ["ETH+/WETH", "1-0x7d3dB01a4AC4aa27534d2951e58d59992686EA5C"],
    ["msETH/WETH", "1-0x7053FA875C478045124CE3Ef740a189b6037DF91"],
    ["alETH/WETH", "1-0xa5Ff611a09c4759D304276B770D8B9e1916032e7"],
    ["msETH/OETH", "1-0xCAa77dA5F349034b0d80Ba7E28A0e77B2C5d701b"],
    ["alETH/frxETH", "1-0xb97AA2c3fed9e2cd1805a6A97546884d362dff33"],
    ["dgnETH/ETH+", "1-0x3F5882a0cd3F2f2436f0e46D13f6ab7286f8ad0e"]
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
  
      // Filter valid strategies first
      const validStrategies = strategies.filter(isValidStakeDAOStrategy);
      console.log("Valid StakeDAO strategies after filtering:", validStrategies.length);
  
      // Group duplicates by name and pick the one with highest TVL
      const strategyMap = new Map<string, StakeDAOStrategy>();
      
      validStrategies.forEach((strategy) => {
          const name = strategy.name.trim();
          const existing = strategyMap.get(name);
          
          // Keep the one with higher TVL
          if (!existing || strategyTvlUsd(strategy) > strategyTvlUsd(existing)) {
            strategyMap.set(name, strategy);
          }
        });
  
      console.log("After deduplication:", strategyMap.size);
  
      const opportunities: Opportunity[] = Array.from(strategyMap.values())
        .map((strategy) => {
          const product = strategy.name;
          
          // Get the vault address from our mapping
          const vaultId = TARGET_POOLS.get(product);
          const url = vaultId
            ? `https://www.stakedao.org/strategy?protocol=curve&vault=${vaultId}`
            : "https://www.stakedao.org";
  
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