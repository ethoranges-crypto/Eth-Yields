import Link from "next/link";
import Header from "@/components/Header";
import { getYields } from "@/lib/yields";


export default async function Home() {
    const { updatedAt } = await getYields();
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header updatedAt={updatedAt} />

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold leading-tight">
            Earn yield on ETH without selling your ETH
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            ETH-denominated yield compounds with ETH itself — so if ETH appreciates
            over time, your yield can become supercharged in $ terms.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/yield-sources"
              className="rounded bg-violet-600 px-6 py-3 font-medium hover:bg-violet-500"
            >
              View Yield Sources
            </Link>
            <a
              href="#why"
              className="rounded border border-zinc-800 px-6 py-3 font-medium text-zinc-200 hover:text-white"
            >
              Learn why ETH matters
            </a>
          </div>
        </div>
      </section>

      {/* WHY ETH YIELDS MATTER */}
      <section id="why" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Why ETH yields matter</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card
            title="$-denominated upside + yield"
            body="If ETH appreciates over time, earning yield in ETH can translate into strong $-denominated returns."
          />
          <Card
            title="No impermanent loss"
            body="Focus on ETH-native strategies. Keep clean exposure to ETH without LP-style dilution."
          />
          <Card
            title="ETH captures ecosystem value"
            body="As the leading smart contract ecosystem, DeFi growth tends to increase demand for ETH as collateral and settlement."
          />
        </div>
      </section>

      {/* ETH IS THE INDEX */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded border border-zinc-800 bg-zinc-900/30 p-6">
          <h3 className="text-xl font-semibold">ETH is the index</h3>
          <ul className="mt-4 space-y-2 text-zinc-300">
            <li>• DeFi activity ultimately settles into ETH demand (fees, collateral, liquidity).</li>
            <li>• If DeFi does well, ETH often benefits — owning ETH is like owning the S&P 500 of crypto.</li>
            <li>• Pairing ETH exposure with ETH yield is a simple long-term strategy.</li>
          </ul>

          <div className="mt-6">
            <Link
              href="/yield-sources"
              className="inline-block rounded bg-violet-600 px-5 py-2.5 font-medium hover:bg-violet-500"
            >
              Go to Yield Sources →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800 px-6 py-8 text-sm text-zinc-500">
        <div className="mx-auto max-w-6xl">
          Data is aggregated automatically. Not financial advice. DYOR.
        </div>
      </footer>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/30 p-5">
      <div className="font-semibold">{title}</div>
      <div className="mt-2 text-sm text-zinc-400">{body}</div>
    </div>
  );
}
