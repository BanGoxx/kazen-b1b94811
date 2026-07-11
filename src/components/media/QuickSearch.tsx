import { SearchAutocomplete } from "./SearchAutocomplete";

// Compact predictive search launcher for the Discover hero area.
// Delegates to SearchAutocomplete which now provides a live dropdown preview
// (prefix + light fuzzy ranking with poster mini-previews). Full results still
// live on /recherche.
export function QuickSearch({ className }: { className?: string }) {
  return <SearchAutocomplete className={className} />;
}
