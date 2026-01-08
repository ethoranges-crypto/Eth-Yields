// src/yield-sources/origin.ts
// Origin Protocol ARM stETH vault data
// TVL from contract, APY from DeFiLlama (since Origin doesn't expose ARM APY via public API)

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
  
  // DeFiLlama pool type
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
  
  // ARM vault contract address
  const ARM_VAULT_ADDRESS = "0x85B78AcA6Deae198fBF201c82DAF6Ca21942acc6";
  
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
    // If value is <= 1.5, it's likely a decimal (0.019 = 1.9%), so multiply by 100
    // If value is > 1.5, it's already a percentage (1.83 = 1.83%), return as-is
    return x <= 1.5 ? x * 100 : x;
  }
  
  // Fetch ETH price from CoinGecko
  async function getEthPrice(): Promise<number> {
    try {
      const response = await fetchJson<{ ethereum: { usd: number } }>(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      return response.ethereum.usd;
    } catch {
      return 3400; // Fallback price
    }
  }
  
  // Fetch totalAssets from ARM contract
  async function getTotalAssetsFromContract(): Promise<number> {
    try {
      const response = await fetch("https://eth.llamarpc.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: ARM_VAULT_ADDRESS,
              data: "0x01e1d114", // totalAssets() function signature
            },
            "latest",
          ],
          id: 1,
        }),
      });
  
      const data = await response.json();
      if (data.result) {
        const totalAssetsWei = BigInt(data.result);
        const totalAssetsETH = Number(totalAssetsWei) / 1e18;
        return totalAssetsETH;
      }
      return 0;
    } catch (error) {
      console.error("Error fetching totalAssets from contract:", error);
      return 0;
    }
  }
  
  // Fetch APY from DeFiLlama (most reliable source for ARM APY currently)
  async function getAPYFromDeFiLlama(): Promise<number> {
    try {
      const data = await fetchJson<{ data: LlamaPool[] }>(
        "https://yields.llama.fi/pools",
        { cache: "no-store" }
      );
  
      const pools = data.data ?? [];
  
      // Find Origin ARM pool
      const armPool = pools.find(
        (p) => {
          const project = (p.project ?? "").toLowerCase();
          const chain = (p.chain ?? "").toLowerCase();
          const symbol = (p.symbol ?? "").toLowerCase();
          
          return (
            project.includes("origin") &&
            project.includes("arm") &&
            chain === "ethereum" &&
            (symbol.includes("weth") || symbol.includes("steth"))
          );
        }
      );
  
      if (armPool) {
        const totalApy = (armPool.apy ?? armPool.apyBase ?? 0) + (armPool.apyReward ?? 0);
        console.log("DeFiLlama ARM APY:", (totalApy * 100).toFixed(2) + "%");
        return totalApy;
      }
  
      return 0;
    } catch (error) {
      console.error("Error fetching APY from DeFiLlama:", error);
      return 0;
    }
  }
  
  // Main function to get Origin ARM data
  async function fetchOriginARMData(): Promise<Opportunity | null> {
    try {
      // Get TVL from contract (most accurate)
      const totalAssetsETH = await getTotalAssetsFromContract();
      const ethPrice = await getEthPrice();
      const tvlUsd = totalAssetsETH * ethPrice;
      
      // Get APY from DeFiLlama (best available source)
      const apy = await getAPYFromDeFiLlama();
      
      console.log("Origin ARM data:", {
        totalAssetsETH: totalAssetsETH.toFixed(2),
        ethPrice: ethPrice.toFixed(2),
        tvlUsd: tvlUsd.toFixed(2),
        apy: (apy * 100).toFixed(2) + "%"
      });
  
      if (tvlUsd === 0) {
        return null;
      }
  
      return {
        protocol: "Origin Protocol",
        product: "ARM WETH-stETH",
        tvlUsd: tvlUsd,
        apyPct: asPct(apy),
        url: "https://app.originprotocol.com/#/arm/1:ARM-WETH-stETH",
      };
    } catch (error) {
      console.error("Origin ARM fetch error:", error);
      return null;
    }
  }
  
  export async function getOriginYields(): Promise<YieldsResponse> {
    const opportunities: Opportunity[] = [];
  
    const armData = await fetchOriginARMData();
    if (armData && armData.tvlUsd > 0) {
      opportunities.push(armData);
    }
  
    return {
      updatedAt: new Date().toISOString(),
      opportunities,
    };
  }