import express from 'express';

const router = express.Router();

// ============================================================
// TYPES
// These describe the shape of data coming back from the NPI
// Registry API. We only define the fields we actually use —
// the real API response has many more fields we ignore.
// ============================================================

// Represents one address object inside a provider's record.
// The NPI API can return up to 2 addresses per provider:
//   - "MAILING"  → where mail is sent (P.O. box, office billing, etc.)
//   - "LOCATION" → where the provider physically works
type NpiAddress = {
  address_purpose: 'MAILING' | 'LOCATION';
  address_1: string;
  city: string;
  state: string;
};

// Represents one taxonomy (specialty) object.
// A provider can have multiple — e.g. "Internal Medicine" + "Oncology"
type NpiTaxonomy = {
  desc: string; // human-readable specialty name
};

// Represents a single raw result from the NPI Registry API.
// "basic" holds the provider's personal/credential info.
// We use "any" for basic because the field names are inconsistent
// between NPI-1 (individual) and NPI-2 (organization) records —
// handled in the transform function below.
type NpiRawResult = {
  number: string;           // the NPI number itself
  enumeration_type: string; // "NPI-1" = individual, "NPI-2" = organization
  basic: any;               // inconsistent fields — see transformProvider()
  addresses: NpiAddress[];
  taxonomies: NpiTaxonomy[];
};

// This is the clean, transformed shape we send back to the frontend.
// Every field here is predictable and safe to use in the UI.
type Provider = {
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
  lat?: number | null; // added later during geocoding (optional for now)
  lon?: number | null;
};


// ============================================================
// HELPER FUNCTIONS
// Separating transformation logic from route handlers keeps
// the routes short and easy to read. Each function does one job.
// ============================================================

/**
 * Picks the best available address from a provider's address list.
 *
 * THE BUG WE'RE FIXING: Previously this was:
 *   provider.addresses.find(...).address_1
 * If .find() returned undefined (no MAILING address), accessing
 * .address_1 on undefined would throw a TypeError and crash the
 * whole request. Now we safely fall back to LOCATION, then null.
 */
function getAddress(addresses: NpiAddress[]): string | null {
  // First, try to find a MAILING address
  const mailing = addresses.find(a => a.address_purpose === 'MAILING');
  if (mailing?.address_1) return mailing.address_1;

  // If no MAILING address, fall back to LOCATION
  const location = addresses.find(a => a.address_purpose === 'LOCATION');
  if (location?.address_1) return location.address_1;

  // If neither exists, return null — the UI should handle this gracefully
  return null;
}

/**
 * Picks the best available city and state from a provider's address list.
 * Uses the same priority order as getAddress() — MAILING first, then LOCATION.
 * Returns a fallback object with empty strings so callers don't need null checks.
 */
function getCityState(addresses: NpiAddress[]): { city: string; state: string } {
  const mailing = addresses.find(a => a.address_purpose === 'MAILING');
  if (mailing?.city) return { city: mailing.city, state: mailing.state };

  const location = addresses.find(a => a.address_purpose === 'LOCATION');
  if (location?.city) return { city: location.city, state: location.state };

  return { city: '', state: '' };
}

/**
 * Transforms one raw NPI API result into our clean Provider shape.
 *
 * WHY: The NPI API returns deeply nested, inconsistently named fields.
 * This function is the single place we deal with that messiness so the
 * rest of the code can work with clean, predictable data.
 */
function transformProvider(raw: NpiRawResult): Provider {
  const { city, state } = getCityState(raw.addresses);

  return {
    npi: raw.number,
    // NPI-1 records use "first_name" / "last_name"
    // NPI-2 (org) records use "authorized_official_first_name" etc.
    // The || operator picks whichever one exists.
    first_name: raw.basic.first_name || raw.basic.authorized_official_first_name || '',
    last_name: raw.basic.last_name || raw.basic.authorized_official_last_name || '',
    credential: raw.basic.credential || raw.basic.authorized_official_credential || '',
    npi_type: raw.enumeration_type,
    city,
    state,
    last_updated: raw.basic.last_updated || '',
    // A provider can have multiple taxonomies — join them into one readable string
    // e.g. "Internal Medicine, Medical Oncology"
    specialty: raw.taxonomies.map(t => t.desc).join(', '),
    mailingAddress: getAddress(raw.addresses),
  };
}

/**
 * Deduplicates providers who appear multiple times in the NPI results.
 *
 * WHY: The NPI Registry sometimes returns the same doctor under multiple
 * NPI numbers (e.g. individual NPI + group NPI). We merge them by name,
 * combining NPI numbers and specialties into comma-separated strings.
 *
 * LIMITATION: Name-matching is imperfect — two different "John Smith"
 * doctors would be incorrectly merged. A more robust solution would use
 * NPI number or address matching, but this works well enough for now.
 */
function deduplicateProviders(providers: Provider[]): Provider[] {
  // A Map lets us look up existing providers by name in O(1) time
  const providerMap = new Map<string, Provider>();

  for (const provider of providers) {
    const key = `${provider.first_name} ${provider.last_name}`;

    if (!providerMap.has(key)) {
      // First time we see this name — add them to the map
      providerMap.set(key, provider);
    } else {
      // We've seen this name before — merge rather than add a duplicate
      const existing = providerMap.get(key)!; // ! tells TS we know this exists
      existing.npi += `, ${provider.npi}`;
      existing.specialty += `, ${provider.specialty}`;
    }
  }

  // Convert the Map's values back into a plain array for the response
  return Array.from(providerMap.values());
}


// ============================================================
// ROUTES
// These are the actual API endpoints. They're kept short because
// the logic lives in the helper functions above.
// ============================================================

// Health check — useful for confirming the server is running
router.get('/test', (req, res) => {
  console.log('API test route hit');
  return res.json({ message: 'API is working!' });
});

/**
 * GET /api/npi?city=Denver&state=CO&specialty=Oncology
 *
 * Queries the public NPI Registry for providers matching the given
 * city, state, and specialty. Returns a cleaned, deduplicated list.
 */
router.get('/npi', async (req, res) => {
  console.log('NPI route hit');

  const { city, state, specialty } = req.query;
  console.log(`Searching for: ${specialty} in ${city}, ${state}`);

  try {
    // Call the NPI Registry — this is a free public government API,
    // no API key needed. Limit 200 is the max per request.
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?version=2.1&city=${city}&state=${state}&taxonomy_description=${specialty}&limit=200`
    );
    const data = await response.json();

    // The API returns a "results" array. If nothing matched, it may be
    // undefined, so we default to an empty array to avoid crashes below.
    const rawResults: NpiRawResult[] = data.results ?? [];

    // Step 1: Keep only individual providers (NPI-1), not organizations (NPI-2)
    // Step 2: Transform each raw result into our clean Provider shape
    const providers = rawResults
      .filter(r => r.enumeration_type === 'NPI-1')
      .map(transformProvider);

    // Step 3: Merge duplicate entries for the same doctor
    const deduplicated = deduplicateProviders(providers);

    return res.json({ data: deduplicated });

  } catch (error) {
    console.error('Error fetching NPI data:', error);
    return res.status(500).json({ error: 'Failed to fetch NPI data' });
  }
});

/**
 * GET /api/geocode?address=123 Main St&city=Denver&state=CO
 *
 * Converts a street address into lat/lon coordinates using Nominatim,
 * which is OpenStreetMap's free geocoding service.
 *
 * WHY we do this server-side: Nominatim requires a User-Agent header
 * identifying your app. Browsers can't reliably set custom headers on
 * fetch requests to third-party APIs, so we proxy through our backend.
 *
 * RATE LIMIT: Nominatim allows max 1 request/second. For large result
 * sets we'll eventually need to add a delay between geocoding calls.
 */
router.get('/geocode', async (req, res) => {
  console.log('Geocode route hit');
  const { address, city, state } = req.query;

  // Combine into one string for better geocoding accuracy.
  // e.g. "123 Main St, Denver, CO" is more precise than just "123 Main St"
  const fullAddress = `${address}, ${city ?? ''}, ${state ?? ''}`;
  console.log(`Geocoding: ${fullAddress}`);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`,
      {
        headers: {
          // Nominatim requires this header — they use it to identify and
          // contact you if your app is causing problems on their servers
          'User-Agent': 'TerritoryPlanner/1.0',
        },
      }
    );

    console.log(response.status);
    console.log(response.headers.get('content-type'));

    const data = await response.json();
    
    // Nominatim returns an array of matches ranked by confidence.
    // The first result is usually the best one.
    return res.json({ data });

  } catch (error) {
    console.error('Error fetching geocode data:', error);
    return res.status(500).json({ error: 'Failed to fetch geocode data' });
  }
});

export default router;





















// import express from 'express';

// const router = express.Router();

// // Types
// type NpiProvider = {
//   number: string;
//   basic: {
//     first_name: string;
//     last_name: string;
//     enumeration_type: string;
//   }
// }

// type NpiTaxonomy = {
//   desc: string;
// }

// // Test route
// router.get('/test', (req, res) => {
//     console.log('API test route hit');
//     return res.json({ message: 'API is working!' });
// });

// // NPI route
// router.get('/npi', async (req, res) => {
//     console.log('NPI route hit');

//     const searchCity = req.query.city;
//     const searchSpecialty = req.query.specialty;
//     const searchState = req.query.state;
//     console.log(`City in api.ts`, searchCity, `State in api.ts`, searchState);

//     try {
//       // NPI Registry API call to get providers based on city, state, and specialty
//       const response = await fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&city=${searchCity}&state=${searchState}&taxonomy_description=${searchSpecialty}&limit=200`);
//       const data = await response.json();

//       // console.log('Raw NPI API response:', data);
      
//       // do something with data if needed, e.g., filter or transform it before sending to client
//       // TODO: currently only returns providers with NPI-1, but we may want to include NPI-2 in the future, so we should consider how to handle that in the data structure
//       const filteredData = data.results
//       .filter((provider: any) => provider.enumeration_type === 'NPI-1')
//       .map((provider: any) => ({
//         npi: provider.number,
//         //inconsitent first name field, so check both 
//         first_name: provider.basic.first_name || provider.basic.authorized_official_first_name,
//         last_name: provider.basic.last_name || provider.basic.authorized_official_last_name,
//         credential: provider.basic.credential || provider.basic.authorized_official_credential,
//         npi_type: provider.enumeration_type,
//         city: provider.addresses[0].city,
//         state: provider.addresses[0].state,
//         last_updated: provider.basic.last_updated,
//         specialty: provider.taxonomies.map((taxonomy): NpiTaxonomy => taxonomy.desc).join(', '),
//         // Include mailing address if available
//         mailingAddress: provider.addresses.find((address: any) => address.address_purpose === 'MAILING').address_1 || null,
//       }));

  
//       // Grouping providers with multiple entries into a single entry based on name
//       const providerMap = new Map();
//       for (const provider of filteredData) {
//         const providerKey = `${provider.first_name} ${provider.last_name}`;
//         if (!providerMap.has(providerKey)) {
//           providerMap.set(providerKey, provider);
//         } else {
//           const existingProvider = providerMap.get(providerKey);
//           // Merge npi numbers and specialties if the provider already exists
//           existingProvider.npi += `, ${provider.npi}`;
//           existingProvider.specialty += `, ${provider.specialty}`;
//         }
//       }

//       // console.log('ProviderMap:', providerMap);

//       res.locals.data = providerMap.size > 0 ? Array.from(providerMap.values()) : [];
      
//       // console.log('NPI API response:', res.locals.data);

//       return res.json({ data: res.locals.data });

//     } catch (error) {
//         console.error('Error fetching NPI data:', error);
//         return res.status(500).json({ error: 'Failed to fetch NPI data' });
//     };
// });

// // Geocode route
// router.get('/geocode', async (req, res) => {
//   console.log('Geocode route hit');
//   const { address, city, state } = req.query;

//   // const address = req.query.address;
//   // console.log(`Address in geocode route: ${address}`);
//   // // Add City and State to the address to improve geocoding accuracy, since many providers may have the same mailing address but are in different cities/states
//   const fullAddress = `${address}, ${city || ''}, ${state || ''}`;
//   console.log(`Full address for geocoding: ${fullAddress}`);
  
//   try {    
//     const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`, {
//       headers: {
//         'User-Agent': 'TerritoryPlanner/1.0'
//       }
//     });
//     const data = await response.json();
//     console.log('Geocode API response:', data);
//     return res.json({ data });

//   } catch (error) {
//     console.error('Error fetching geocode data:', error);
//     return res.status(500).json({ error: 'Failed to fetch geocode data' });
//   }
// });

// export default router;