import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-muted">
          <SearchX className="h-6 w-6 text-foreground" />
        </div>
        <h1 className="mt-5 text-xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm font-medium">
          <Link href="/" className="text-[color:var(--brand)] underline-offset-4 hover:underline">
            Home
          </Link>
          <Link href="/dashboard" className="text-[color:var(--brand)] underline-offset-4 hover:underline">
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
