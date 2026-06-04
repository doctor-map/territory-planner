// MapComponent.tsx
// Renders an interactive map with a pin for each provider.
//
// We're using react-leaflet, which is a React wrapper around Leaflet.js —
// a popular open-source mapping library. It uses OpenStreetMap tiles (free,
// no API key needed) for the actual map imagery.
//
// HOW REACT-LEAFLET WORKS:
// - <MapContainer> sets up the map with an initial center and zoom level
// - <TileLayer> loads the map imagery (the actual street/satellite tiles)
// - <Marker> places a pin at a lat/lon coordinate
// - <Popup> shows a tooltip when you click a marker
// - useMap() is a hook that gives you access to the Leaflet map instance
//   so you can programmatically move/zoom it

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Provider } from './ResultsList';

type MapComponentProps = {
  providers: Provider[];
  // The map centers on this location when the user searches a new city.
  // We pass it in from App.tsx so the parent controls where the map looks.
  centerCoords: [number, number] | null;
};

/**
 * MapAutoCenter
 * A helper component that re-centers the map whenever centerCoords changes.
 *
 * WHY it's a separate component: useMap() only works inside a <MapContainer>.
 * We can't call it in MapComponent directly (it's the parent of MapContainer),
 * so we put it inside as a child component where it has access to the map instance.
 *
 * useEffect runs after render, whenever the deps array [map, centerCoords] changes.
 * When centerCoords updates (new search), the effect fires and flies the map there.
 */
function MapAutoCenter({ centerCoords }: { centerCoords: [number, number] | null }) {
  const map = useMap(); // gives us the Leaflet map instance

  useEffect(() => {
    if (centerCoords) {
      // flyTo smoothly animates to the new location instead of jumping
      map.flyTo(centerCoords, 11); // zoom level 11 shows a city-wide view
    }
  }, [map, centerCoords]); // only re-run when these values change

  return null; // this component renders nothing — it just controls the map
}

export default function MapComponent({ providers, centerCoords }: MapComponentProps) {
  // Default center: Denver, CO — a sensible starting point for this use case
  const defaultCenter: [number, number] = [39.7392, -104.9903];

  // Only show markers for providers that have been geocoded (have lat/lon).
  // Providers without coordinates are still shown in the list, just not on the map.
  const mappableProviders = providers.filter(
    p => p.lat != null && p.lon != null
  );

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      scrollWheelZoom={false} // prevents accidental zoom while scrolling the page
      className="leaflet-container" // matches the CSS class in App.css that sets height/width
    >
      {/* TileLayer loads the actual map imagery from OpenStreetMap.
          The {s}, {z}, {x}, {y} placeholders are filled in by Leaflet
          to request the right map tile for the current view. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Auto-center the map when the user searches a new city */}
      <MapAutoCenter centerCoords={centerCoords} />

      {/* Render one marker per geocoded provider */}
      {mappableProviders.map(provider => (
        <Marker
          key={provider.npi}
          position={[provider.lat!, provider.lon!]}
          // The ! tells TypeScript "I know this isn't null" —
          // safe here because we filtered to only mappableProviders above
        >
          {/* Popup content shown when the user clicks the pin */}
          <Popup>
            <strong>{provider.first_name} {provider.last_name}</strong>
            {provider.credential && `, ${provider.credential}`}
            <br />
            {provider.specialty}
            <br />
            {provider.mailingAddress ?? 'Address unavailable'}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}