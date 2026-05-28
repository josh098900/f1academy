// Shared loading skeleton for every page under the (app) group. Paints
// instantly on navigation while the server renders the real page — the new
// route always looks "there" the moment the tab is tapped.
export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite">
      <header className="border-b border-border-default px-6 py-6 sm:px-12">
        <div className="h-3 w-32 animate-pulse bg-surface" />
        <div className="mt-3 h-10 w-64 animate-pulse bg-surface" />
      </header>
      <div className="space-y-3 px-6 py-8 sm:px-12">
        <div className="h-24 w-full animate-pulse bg-surface" />
        <div className="h-24 w-full animate-pulse bg-surface" />
        <div className="h-24 w-full animate-pulse bg-surface sm:hidden" />
      </div>
    </main>
  );
}
