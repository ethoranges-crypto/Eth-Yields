import { NextRequest } from "next/server";

type LlamaPool = {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy?: number;
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim();

  const res = await fetch("https://yields.llama.fi/pools", {
    next: { revalidate: 60 },
  });
  if (!res.ok) return Response.json({ error: "llama fetch failed" }, { status: 500 });

  const json = (await res.json()) as { data: LlamaPool[] };
  const pools = json.data ?? [];

  const hits = pools
    .filter((p) => (p.project || "").toLowerCase().includes("stake"))
    .filter((p) => (p.chain || "").toLowerCase() === "ethereum")
    .filter((p) =>
      q
        ? (p.pool || "").toLowerCase().includes(q) ||
          (p.symbol || "").toLowerCase().includes(q)
        : true
    )
    .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
    .slice(0, 25);

  return Response.json({ q, count: hits.length, hits });
}
