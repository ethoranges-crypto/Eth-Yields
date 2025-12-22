import Link from "next/link";

type HeaderProps = {
  updatedAt?: string; // ISO timestamp
};

function minsAgo(updatedAt?: string) {
  if (!updatedAt) return null;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  return mins;
}

export default function Header({ updatedAt }: HeaderProps) {
  const m = minsAgo(updatedAt);

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-violet-600 text-sm">
            Ξ
          </span>
          <span>ETH YIELDS</span>
        </Link>

        <Link
          href="/yield-sources"
          className="text-sm font-medium text-zinc-200 hover:text-white"
        >
          Yield Sources
        </Link>

        <div className="text-sm text-zinc-500">
          Updated: {m === null ? "—" : `${m}m`} ago
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <a
            href="https://discord.com"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-300 hover:text-white"
          >
            Discord
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-300 hover:text-white"
          >
            Twitter
          </a>
        </div>
      </div>
    </header>
  );
}
