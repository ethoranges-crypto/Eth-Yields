"use client";

import { useMemo, useState } from "react";
import type { Opportunity } from "@/lib/yields";

type Props = {
  opportunities: Opportunity[];
};

function formatUsd(n: number) {
  return n >= 1e9
    ? `$${(n / 1e9).toFixed(1)}B`
    : n >= 1e6
    ? `$${(n / 1e6).toFixed(0)}M`
    : `$${n.toFixed(0)}`;
}

export default function YieldTable({ opportunities }: Props) {
  const [protocol, setProtocol] = useState("All");
  const [minApy, setMinApy] = useState(0);

  const protocols = useMemo(() => {
    return ["All", ...Array.from(new Set(opportunities.map((x) => x.protocol)))];
  }, [opportunities]);

  const rows = useMemo(() => {
    return opportunities
      .filter((r) => (protocol === "All" ? true : r.protocol === protocol))
      .filter((r) => r.apyPct >= minApy)
      .sort((a, b) => b.apyPct - a.apyPct);
  }, [opportunities, protocol, minApy]);

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Protocol</label>
          <select
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
          >
            {protocols.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">Min APY</label>
          <input
            type="number"
            className="w-32 rounded border border-zinc-800 bg-zinc-900 px-3 py-2"
            value={minApy}
            min={0}
            step={0.1}
            onChange={(e) => setMinApy(Number(e.target.value))}
          />
        </div>

        <div className="ml-auto text-sm text-zinc-500">
          Showing {rows.length} of {opportunities.length}
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full border-collapse text-left">
          <thead className="bg-zinc-900">
            <tr>
              <th className="px-4 py-3">Protocol</th>
              <th className="px-4 py-3">Yield Product</th>
              <th className="px-4 py-3">TVL</th>
              <th className="px-4 py-3">APY</th>
              <th className="px-4 py-3">Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.protocol}-${r.product}`}
                className="border-t border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">{r.protocol}</td>
                <td className="px-4 py-3">{r.product}</td>
                <td className="px-4 py-3">{formatUsd(r.tvlUsd)}</td>
                <td className="px-4 py-3">{r.apyPct.toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <a
                    className="text-violet-400 hover:underline"
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr className="border-t border-zinc-800">
                <td colSpan={5} className="px-4 py-6 text-zinc-500">
                  No opportunities match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
