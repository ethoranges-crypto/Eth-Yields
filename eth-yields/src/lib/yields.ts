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
  
  // --- helpers ---
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
      .filter((p) => p.project?.toLowerCase() === opts.project.toLowerCase())
      .filter((p) => p.chain?.toLowerCase() === chain)
      .filter((p) =>
        opts.symbolIncludes.every((s) =>
          (p.symbol ?? "").toLowerCase().includes(s.toLowerCase())
        )
      )
      .filter((p) => typeof p.tvlUsd === "number" && p.tvlUsd > 0)
      .filter((p) => typeof p.apy === "number" && Number.isFinite(p.apy));
  
    if (candidates.length === 0) return null;
  
    candidates.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
    return candidates[0];
  }
  
  // StakeDAO picks (exactly what you want to show)
  const STAKEDAO_PICKS = [
    {
      protocol: "StakeDAO",
      product: "ETH+ / wETH",
      protocolParam: "curve",
      vaultParam: "1-0x7d3dB01a4AC4aa27534d2951e58d59992686EA5C",
      url: "https://www.stakedao.org/strategy?protocol=curve&vault=1-0x7d3dB01a4AC4aa27534d2951e58d59992686EA5C",
    },
    {
      protocol: "StakeDAO",
      product: "msETH / wETH",
      protocolParam: "curve",
      vaultParam: "1-0x7053FA875C478045124CE3Ef740a189b6037DF91",
      url: "https://www.stakedao.org/strategy?protocol=curve&vault=1-0x7053FA875C478045124CE3Ef740a189b6037DF91",
    },
    {
      protocol: "StakeDAO",
      product: "dgnETH / ETH+",
      protocolParam: "curve",
      vaultParam: "1-0x3F5882a0cd3F2f2436f0e46D13f6ab7286f8ad0e",
      url: "https://www.stakedao.org/strategy?protocol=curve&vault=1-0x3F5882a0cd3F2f2436f0e46D13f6ab7286f8ad0e",
    },
  ] as const;
  
  // Very defensive extractor: handles unknown JSON shapes
  function firstNumber(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  
  function getPath(obj: any, path: string[]): any {
    let cur = obj;
    for (const key of path) {
      if (cur == null) return undefined;
      cur = cur[key];
    }
    return cur;
  }
  
  function extractStakeDaoMetrics(json: any): { tvlUsd: number | null; apyPct: number | null } {
    // Ignore translations subtree entirely
    const pageProps = json?.props?.pageProps;
    const root =
      pageProps?.dehydratedState?.queries
        ?.map((q: any) => q?.state?.data)
        ?.filter(Boolean) ?? [json];
  
    const candidates: { key: string; value: number }[] = [];
  
    const parseNumberish = (v: any): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v !== "string") return null;
  
      const s = v.trim();
      if (!s) return null;
  
      // handle "$12,345.67", "3.21%", "12345"
      const cleaned = s.replace(/[$,%\s]/g, "").replace(/,/g, "");
      if (!/^[-]?\d+(\.\d+)?$/.test(cleaned)) return null;
  
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    };
  
    const walk = (obj: any) => {
      if (!obj || typeof obj !== "object") return;
  
      for (const [k, v] of Object.entries(obj)) {
        const key = k.toLowerCase();
  
        // skip translation store if it appears again
        if (key.includes("_nexti18next")) continue;
  
        const n = parseNumberish(v);
        if (n !== null) {
          candidates.push({ key, value: n });
        }
  
        if (v && typeof v === "object") walk(v);
      }
    };
  
    for (const r of root) walk(r);
  
    // Heuristics:
    // - TVL is usually a large USD number (>= 100k)
    // - APY/APR is usually between 0 and 200
    const tvl = candidates
      .filter((c) => c.key.includes("tvl") || c.key.includes("value") || c.key.includes("locked") || c.key.includes("deposit"))
      .filter((c) => c.value >= 100_000)
      .sort((a, b) => b.value - a.value)[0]?.value ?? null;
  
    const apy = candidates
      .filter((c) => c.key.includes("apy") || c.key.includes("apr") || c.key.includes("yield") || c.key.includes("rate"))
      .filter((c) => c.value >= 0 && c.value <= 200)
      .sort((a, b) => b.value - a.value)[0]?.value ?? null;
  
    return { tvlUsd: tvl, apyPct: apy };
  }
  
  
  async function fetchStakeDaoStrategy(protocol: string, vault: string) {
    const pageUrl = `https://www.stakedao.org/strategy?protocol=${encodeURIComponent(
      protocol
    )}&vault=${encodeURIComponent(vault)}`;
  
    const res = await fetch(pageUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`StakeDAO page fetch failed ${res.status}`);
  
    const html = await res.text();
  
    const marker = 'id="__NEXT_DATA__" type="application/json">';
    const start = html.indexOf(marker);
    if (start === -1) throw new Error("StakeDAO __NEXT_DATA__ not found");
  
    const jsonStart = start + marker.length;
    const end = html.indexOf("</script>", jsonStart);
    if (end === -1) throw new Error("StakeDAO __NEXT_DATA__ script not closed");
  
    const nextDataRaw = html.slice(jsonStart, end).trim();
    const nextData = JSON.parse(nextDataRaw);
  
    const { tvlUsd, apyPct } = extractStakeDaoMetrics(nextData);
  
    return {
      tvlUsd: tvlUsd ?? 0,
      apyPct: apyPct ?? 0,
    };
  }
  
  export async function getYields(): Promise<YieldsResponse> {
    const updatedAt = new Date().toISOString();
    const opportunities: Opportunity[] = [];
  
    // 1) DefiLlama (big payload, cannot be cached by Next data cache)
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
    } catch {
      // continue
    }
  
    // 2) StakeDAO strategies (always show rows)
    const stakedaoResults = await Promise.allSettled(
      STAKEDAO_PICKS.map(async (p) => {
        const { tvlUsd, apyPct } = await fetchStakeDaoStrategy(p.protocolParam, p.vaultParam);
        return {
          protocol: p.protocol,
          product: p.product,
          tvlUsd,
          apyPct,
          url: p.url,
        } satisfies Opportunity;
      })
    );
  
    stakedaoResults.forEach((r, i) => {
      const pick = STAKEDAO_PICKS[i];
      opportunities.push(
        r.status === "fulfilled"
          ? r.value
          : { protocol: pick.protocol, product: pick.product, tvlUsd: 0, apyPct: 0, url: pick.url }
      );
    });
  
    // If absolutely nothing loaded, provide a minimal fallback
    if (opportunities.length === 0) {
      opportunities.push(
        { protocol: "Lido", product: "stETH", tvlUsd: 0, apyPct: 0, url: "https://lido.fi" },
        { protocol: "Rocket Pool", product: "rETH", tvlUsd: 0, apyPct: 0, url: "https://rocketpool.net" }
      );
    }
  
    return { updatedAt, opportunities };
  }
  