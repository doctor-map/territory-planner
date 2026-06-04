// ResultsList.tsx
// Renders the list of providers returned from the NPI search.
//
// This component is purely presentational — it receives data and displays it.
// No fetching, no state changes. This is sometimes called a "dumb" component
// and it's a good pattern: easy to test, easy to restyle, easy to understand.

// We import the Provider type so TypeScript can verify we're using
// the fields correctly. This type lives here for now but could be moved
// to a shared types file if it grows.
export type Provider = {
  npi: string;
  first_name: string;
  last_name: string;
  credential: string;
  npi_type: string;
  city: string;
  state: string;
  last_updated: string;
  specialty: string;
  mailingAddress: string | null;
  lat?: number | null;
  lon?: number | null;
};

type ResultsListProps = {
  providers: Provider[];
};

export default function ResultsList({ providers }: ResultsListProps) {
  // If nothing has been searched yet (or search returned nothing), say so
  if (providers.length === 0) {
    return <p>No providers found. Try a different city, state, or specialty.</p>;
  }

  return (
    <div className="results-list">
      <h2>Results ({providers.length} providers)</h2>
      <ul>
        {providers.map(provider => (
          // We use NPI as the key because it's a unique identifier for each provider.
          // React uses keys to efficiently update the list when it changes —
          // using index (e.g. key={i}) is an anti-pattern because it can cause
          // subtle bugs if the list order changes.
          <li key={provider.npi}>
            <strong>{provider.first_name} {provider.last_name}</strong>
            {provider.credential && `, ${provider.credential}`}
            <br />
            <span>{provider.specialty}</span>
            <br />
            <span>{provider.city}, {provider.state}</span>
            {/* Only show address if we have one — mailingAddress can be null */}
            {provider.mailingAddress && (
              <>
                <br />
                <span>{provider.mailingAddress}</span>
              </>
            )}
            <br />
            <small>NPI: {provider.npi} · Last updated: {provider.last_updated}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}