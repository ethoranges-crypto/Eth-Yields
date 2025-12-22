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

function isNumericString(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  // allow "123", "123.45", "1,234.56"
  const cleaned = s.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(cleaned);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (isNumericString(v)) return Number((v as string).replace(/,/g, ""));
  return null;
}

const KEYWORDS = [
  "tvl",
  "apy",
  "apr",
  "yield",
  "rate",
  "boost",
  "deposit",
  "underlying",
  "aum",
  "value",
  "locked",
];

function scan(obj: any, path: string[] = [], out: any[] = []) {
  if (!obj || typeof obj !== "object") return out;

  for (const [k, v] of Object.entries(obj)) {
    const p = [...path, k];
    const key = k.toLowerCase();

    const interestingKey = KEYWORDS.some((w) => key.includes(w));

    const n = toNumber(v);
    if (interestingKey && n !== null) {
      out.push({ path: p.join("."), value: n, raw: v });
    } else if (interestingKey && typeof v === "string") {
      // capture non-numeric strings too (sometimes "$6.3m")
      out.push({ path: p.join("."), value: v });
    }

    if (v && typeof v === "object") scan(v, p, out);
  }

  return out;
}

export async function GET(req: NextRequest) {
  const protocol = req.nextUrl.searchParams.get("protocol") || "curve";
  const vault = req.nextUrl.searchParams.get("vault");
  if (!vault) return Response.json({ error: "missing vault" }, { status: 400 });

  const url = `https://www.stakedao.org/strategy?protocol=${encodeURIComponent(
    protocol
  )}&vault=${encodeURIComponent(vault)}`;

  const res = await fetch(url, { cache: "no-store" });
  const html = await res.text();
  const nextData = extractNextData(html);

  const hits = scan(nextData).slice(0, 300);
  return Response.json({ url, count: hits.length, hits });
}
