import { PitwallLoader } from "@/components/PitwallLoader";

// Shared loading state for every page under the (app) group. Paints instantly
// on navigation while the server renders the real page. The header skeleton
// holds the layout steady; the pit-wall car gives the wait some personality.
export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite">
      <header className="border-b border-border-default px-6 py-6 sm:px-12">
        <div className="h-3 w-32 animate-pulse bg-surface" />
        <div className="mt-3 h-10 w-64 animate-pulse bg-surface" />
      </header>
      <div className="flex justify-center px-6 py-16 sm:px-12 sm:py-24">
        <PitwallLoader />
      </div>
    </main>
  );
}
