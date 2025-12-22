import { getYields } from "@/lib/yields";

export async function GET() {
  const data = await getYields();

  return Response.json(data, {
    headers: {
      // good default for later when you cache server-side
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
