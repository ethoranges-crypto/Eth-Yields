import Header from "@/components/Header";
import YieldTable from "@/components/YieldTable";
import { getYields } from "@/lib/yields";
export const revalidate = 60;

export default async function YieldSourcesPage() {
  const { updatedAt, opportunities } = await getYields();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header updatedAt={updatedAt} />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Yield Sources</h1>
        <p className="mt-2 text-zinc-400">
          A curated list of ETH-denominated yield opportunities.
        </p>
      </section>

      <YieldTable opportunities={opportunities} />
    </main>
  );
}
