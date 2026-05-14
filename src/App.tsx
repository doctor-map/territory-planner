import './App.css'
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMapEvent, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapComponentControls() {
  //equivalent to MyComponent in docs
  const map = useMap()
  console.log('map center:', map.getCenter())

  // set
  return null
}

function MapComponent() {
  //equivalent to MyMapCompenent in the docs
  return (
    <MapContainer center={[40.7123, -74.006]} zoom={13} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[40.7123, -74.006]}>
        <Popup>
          A pretty CSS3 popup. <br /> Easily customizable.
        </Popup>
      </Marker>
      {/* <MapComponentControls /> */}
    </MapContainer>
  );
}

function App() {
  const [ city, setCity ] = useState('');
  const [ state, setState ] = useState('');
  const [ searchResults, setSearchResults ] = useState([]);
  const [ specialty, setSpecialty ] = useState('');

  const handleClick = async () => {
    console.log('clicked');
    
    try {
      const newCity = city;
      const newSpecialty = specialty;
      const newState = state;
      console.log(`In App try block, city:`, newCity, newSpecialty, newState);

      const response = await fetch(`http://localhost:3000/api/npi?city=${encodeURIComponent(newCity)}&specialty=${encodeURIComponent(newSpecialty)}&state=${encodeURIComponent(newState)}`);

      const data = await response.json();
      console.log('data', data)
    // console.log('NPI API response:', res.locals.data);
    //   return res.json({ data: res.locals.data }); 
      setSearchResults(data.data);

    // // Geocode each provider's mailing address to get lat and lon, then update searchResults state with lat and lon for each provider to be used for map markers
    //   const geocodedResults = await Promise.all(data.data.map(async (provider: any) => {
    //     const geocodeData = await geocodeAddress(provider.mailingAddress);
    //     if (geocodeData.length > 0) {
    //       provider.lat = geocodeData[0].lat;
    //       provider.lon = geocodeData[0].lon;
    //     } else {
    //       provider.lat = null;
    //       provider.lon = null;
    //     }
    //     return provider;
    //   }));

    // To test, geocode the first provider's mailing address to get lat and lon, then log the geocoded results to verify we are getting the correct lat and lon for the provider's mailing address
    const geocodeData = await geocodeAddress(data.data[0].mailingAddress, data.data[0].city, data.data[0].state);
    console.log('geocodeData for first provider:', geocodeData);

      // console.log('geocodedResults', geocodedResults);
    
    } catch (err) {
      console.error('A network error occurred: ', err);
    }
    
  } 

  // Geocoding address using backend API route
  const geocodeAddress = async (address: string, city: string, state: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/geocode?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error geocoding address:', error);
      throw error;
    }
  };


  return (
    <div>
      <h1>Territory Planner</h1>
      <MapComponent />
      <input type="text" value={city} placeholder="Enter city name" onChange={ e => setCity(e.target.value)} />
      <input type="text" value={state} placeholder="Enter state abbreviation" onChange={ e => setState(e.target.value)} />
      <input type="text" value={specialty} placeholder="Enter specialty" required onChange={ e => setSpecialty(e.target.value)} />
      <button onClick={handleClick} >Search</button>

      <ul>
        {searchResults.map((result: any) => (
          <li key={result.npi}> 
            first name: {result.first_name}, 
            last name: {result.last_name}, 
            NPI type: {result.npi_type}, 
            specialty: {result.specialty}, 
            last updated: {result.last_updated}, 
            credential: {result.credential}, 
            mailing address: {result.mailingAddress}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
