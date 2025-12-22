import { NextRequest } from "next/server";

function extractNextData(html: string) {
  const marker = 'id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error("__NEXT_DATA__ not found");
  const jsonStart = start + marker.length;
  const end = html.indexOf("</script>", jsonStart);
  if (end === -1) throw new Error("__NEXT_DATA__ not closed");
  return JSON.parse(html.slice(jsonStart, end).trim());
}

// Recursively find numeric fields with interesting names
function findMetrics(obj: any, path: string[] = [], out: any[] = []) {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const p = [...path, k];
      if (typeof v === "number" && isFinite(v)) {
        const key = k.toLowerCase();
        if (key.includes("apy") || key.includes("apr") || key.includes("tvl")) {
          out.push({ path: p.join("."), value: v });
        }
      } else if (v && typeof v === "object") {
        findMetrics(v, p, out);
      }
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const protocol = req.nextUrl.searchParams.get("protocol") || "curve";
  const vault = req.nextUrl.searchParams.get("vault");
  if (!vault) return Response.json({ error: "missing vault param" }, { status: 400 });

  const pageUrl = `https://www.stakedao.org/strategy?protocol=${encodeURIComponent(
    protocol
  )}&vault=${encodeURIComponent(vault)}`;

  const res = await fetch(pageUrl, { cache: "no-store" });
  const html = await res.text();

  const nextData = extractNextData(html);
  const metrics = findMetrics(nextData).slice(0, 200);

  return Response.json({ pageUrl, metricsSample: metrics });
}
