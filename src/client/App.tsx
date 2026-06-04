// App.tsx
// The root component and the "brain" of the frontend application.
//
// RESPONSIBILITIES:
//   1. Owns the application state (search results, loading status, errors)
//   2. Handles data fetching (NPI search + geocoding)
//   3. Wires together the child components (SearchForm, MapComponent, ResultsList)
//
// Notice how App.tsx no longer renders any UI directly — it just manages
// data and passes it down. This is called "lifting state up": state lives
// in the nearest common ancestor of the components that need it.

import './App.css';
import { useState } from 'react';
import SearchForm from './components/SearchForm';
import MapComponent from './components/MapComponent';
import ResultsList from './components/ResultsList';
import type { Provider } from './components/ResultsList';

// The base URL for our Express backend. If we ever deploy this, we'd
// update this one line instead of hunting through every fetch() call.
const API_BASE = 'http://localhost:3000/api';

export default function App() {
  // --- STATE ---
  // providers: the cleaned list of doctors returned from our backend
  const [providers, setProviders] = useState<Provider[]>([]);

  // isLoading: true while we're waiting for API responses — used to
  // disable the search button and show a loading indicator
  const [isLoading, setIsLoading] = useState(false);

  // error: a human-readable error message, or null if everything's fine
  const [error, setError] = useState<string | null>(null);

  // centerCoords: the lat/lon we want the map to fly to after a search.
  // We derive this from the first geocoded provider's coordinates.
  const [centerCoords, setCenterCoords] = useState<[number, number] | null>(null);


  // --- DATA FETCHING ---

  /**
   * Geocodes a single provider's address using our backend /geocode route.
   * Returns [lat, lon] as numbers, or [null, null] if geocoding fails.
   *
   * WHY we return [null, null] instead of throwing: if one provider's
   * address can't be geocoded, we don't want to stop the whole process —
   * we just skip that pin on the map and still show them in the list.
   */
  async function geocodeProvider(provider: Provider): Promise<[number | null, number | null]> {
    // If we don't have an address to geocode, bail out early
    if (!provider.mailingAddress) return [null, null];

    try {
      const response = await fetch(
        `${API_BASE}/geocode?address=${encodeURIComponent(provider.mailingAddress)}&city=${encodeURIComponent(provider.city)}&state=${encodeURIComponent(provider.state)}`
      );
      const data = await response.json();

      // Nominatim returns an array of results ranked by confidence.
      // data.data[0] is the best match. lat/lon come back as strings, so
      // we parse them to numbers for Leaflet.
      if (data.data && data.data.length > 0) {
        return [parseFloat(data.data[0].lat), parseFloat(data.data[0].lon)];
      }
      return [null, null];

    } catch {
      // Network error or bad response — skip this provider's pin silently
      return [null, null];
    }
  }

  /**
   * Main search handler — called by SearchForm when the user clicks Search.
   *
   * Flow:
   *   1. Fetch providers from NPI Registry (via our backend)
   *   2. Geocode each provider's address (via our backend → Nominatim)
   *   3. Attach lat/lon to each provider and update state
   *   4. Set map center to the first successfully geocoded provider
   *
   * WHY we geocode on the frontend side of App.tsx rather than in the backend:
   * Geocoding all 200 providers server-side would make the initial response
   * take a very long time. Doing it here lets us show results immediately
   * and progressively add pins as they come in (future improvement).
   */

/**
 * A small utility that pauses execution for a given number of milliseconds.
 * We use this to throttle geocoding requests so we don't exceed Nominatim's
 * 1 request/second rate limit.
 *
 * HOW IT WORKS: It returns a Promise that resolves after `ms` milliseconds.
 * When we `await` it inside a loop, the loop pauses for that duration before
 * continuing to the next iteration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleSearch(city: string, state: string, specialty: string) {
  setIsLoading(true);
  setError(null);
  setProviders([]);

  try {
    // Step 1: Fetch providers from our NPI backend route (unchanged)
    const response = await fetch(
      `${API_BASE}/npi?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&specialty=${encodeURIComponent(specialty)}`
    );

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    const fetchedProviders: Provider[] = data.data;

    // Show the list immediately — the map pins will appear progressively
    // as each provider gets geocoded one by one below
    setProviders(fetchedProviders);

    // Step 2: Geocode providers one at a time with a 1.1 second delay between each.
    //
    // WHY NOT Promise.all anymore: Nominatim enforces a strict 1 req/second rate
    // limit. Sending all requests at once causes them to respond with an XML error
    // page instead of JSON, which crashes our JSON.parse() call.
    //
    // WHY 1100ms: We use 1100ms (slightly over 1 second) instead of exactly 1000ms
    // to give a small buffer for network latency. Cutting it too close to exactly
    // 1000ms can still occasionally hit the rate limit.
    //
    // TRADEOFF: This is slower — 50 providers takes ~55 seconds to fully geocode.
    // For the MVP this is acceptable. A future improvement would be to batch
    // geocode on the backend, cache results in a database, and only geocode
    // addresses we haven't seen before.
    const geocodedProviders = [...fetchedProviders]; // copy the array so we can mutate it

    for (let i = 0; i < fetchedProviders.length; i++) {
      const [lat, lon] = await geocodeProvider(fetchedProviders[i]);

      // Attach the coordinates to this provider in our working copy
      geocodedProviders[i] = { ...fetchedProviders[i], lat, lon };

      // Update state after each geocode so the map pin appears immediately
      // instead of waiting for ALL providers to finish.
      // We spread into a new array ([...]) because React requires a new array
      // reference to detect the state change and trigger a re-render.
      setProviders([...geocodedProviders]);

      // Set the map center as soon as we get our first successful geocode
      if (lat != null && centerCoords === null) {
        setCenterCoords([lat, lon!]);
      }

      // Wait before the next request — skip the delay after the last one
      if (i < fetchedProviders.length - 1) {
        await sleep(2000);
      }
    }

  } catch (err) {
    console.error('Search failed:', err);
    setError('Something went wrong. Please try again.');
  } finally {
    setIsLoading(false);
  }
}

  // --- RENDER ---
  return (
    <div>
      <h1>Territory Planner</h1>

      {/* SearchForm manages its own input state internally.
          We give it our handleSearch function as a prop so it can
          trigger a search without knowing how searching works. */}
      <SearchForm onSearch={handleSearch} isLoading={isLoading} />

      {/* Show an error message if something went wrong */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* The map always renders. centerCoords is null on first load,
          so the map just stays at the default Denver view until a search happens. */}
      <MapComponent providers={providers} centerCoords={centerCoords} />

      {/* Only show the results list after a search has been run */}
      {providers.length > 0 && <ResultsList providers={providers} />}
    </div>
  );
}





































// import './App.css'
// import { useState } from 'react';
// import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMapEvent, useMap } from 'react-leaflet';
// import 'leaflet/dist/leaflet.css';

// function MapComponentControls() {
//   //equivalent to MyComponent in docs
//   const map = useMap()
//   console.log('map center:', map.getCenter())

//   // set
//   return null
// }

// function MapComponent() {
//   //equivalent to MyMapCompenent in the docs
//   return (
//     <MapContainer center={[40.7123, -74.006]} zoom={13} scrollWheelZoom={false}>
//       <TileLayer
//         attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//       />
//       <Marker position={[40.7123, -74.006]}>
//         <Popup>
//           A pretty CSS3 popup. <br /> Easily customizable.
//         </Popup>
//       </Marker>
//       {/* <MapComponentControls /> */}
//     </MapContainer>
//   );
// }

// function App() {
//   const [ city, setCity ] = useState('');
//   const [ state, setState ] = useState('');
//   const [ searchResults, setSearchResults ] = useState([]);
//   const [ specialty, setSpecialty ] = useState('');

//   const handleClick = async () => {
//     console.log('clicked');
    
//     try {
//       const newCity = city;
//       const newSpecialty = specialty;
//       const newState = state;
//       console.log(`In App try block, city:`, newCity, newSpecialty, newState);

//       const response = await fetch(`http://localhost:3000/api/npi?city=${encodeURIComponent(newCity)}&specialty=${encodeURIComponent(newSpecialty)}&state=${encodeURIComponent(newState)}`);

//       const data = await response.json();
//       console.log('data', data)
//     // console.log('NPI API response:', res.locals.data);
//     //   return res.json({ data: res.locals.data }); 
//       setSearchResults(data.data);

//     // // Geocode each provider's mailing address to get lat and lon, then update searchResults state with lat and lon for each provider to be used for map markers
//     //   const geocodedResults = await Promise.all(data.data.map(async (provider: any) => {
//     //     const geocodeData = await geocodeAddress(provider.mailingAddress);
//     //     if (geocodeData.length > 0) {
//     //       provider.lat = geocodeData[0].lat;
//     //       provider.lon = geocodeData[0].lon;
//     //     } else {
//     //       provider.lat = null;
//     //       provider.lon = null;
//     //     }
//     //     return provider;
//     //   }));

//     // To test, geocode the first provider's mailing address to get lat and lon, then log the geocoded results to verify we are getting the correct lat and lon for the provider's mailing address
//     const geocodeData = await geocodeAddress(data.data[0].mailingAddress, data.data[0].city, data.data[0].state);
//     console.log('geocodeData for first provider:', geocodeData);

//       // console.log('geocodedResults', geocodedResults);
    
//     } catch (err) {
//       console.error('A network error occurred: ', err);
//     }
    
//   } 

//   // Geocoding address using backend API route
//   const geocodeAddress = async (address: string, city: string, state: string) => {
//     try {
//       const response = await fetch(`http://localhost:3000/api/geocode?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
//       const data = await response.json();
//       return data.data;
//     } catch (error) {
//       console.error('Error geocoding address:', error);
//       throw error;
//     }
//   };


//   return (
//     <div>
//       <h1>Territory Planner</h1>
//       <MapComponent />
//       <input type="text" value={city} placeholder="Enter city name" onChange={ e => setCity(e.target.value)} />
//       <input type="text" value={state} placeholder="Enter state abbreviation" onChange={ e => setState(e.target.value)} />
//       <input type="text" value={specialty} placeholder="Enter specialty" required onChange={ e => setSpecialty(e.target.value)} />
//       <button onClick={handleClick} >Search</button>

//       <ul>
//         {searchResults.map((result: any) => (
//           <li key={result.npi}> 
//             first name: {result.first_name}, 
//             last name: {result.last_name}, 
//             NPI type: {result.npi_type}, 
//             specialty: {result.specialty}, 
//             last updated: {result.last_updated}, 
//             credential: {result.credential}, 
//             mailing address: {result.mailingAddress}
//           </li>
//         ))}
//       </ul>
//     </div>
//   )
// }

// export default App
