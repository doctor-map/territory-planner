import './App.css'
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapComponent() {
  return (
    <MapContainer center={[40.7123, -74.006]} zoom={13} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[51.505, -0.09]}>
        <Popup>
          A pretty CSS3 popup. <br /> Easily customizable.
        </Popup>
      </Marker>
    </MapContainer>
  );
}

function App() {
  const [ city, setCity ] = useState('');
  const [ searchResults, setSearchResults ] = useState([]);
  const [ specialty, setSpecialty ] = useState('');

  const clicked = async () => {
    console.log('clicked');
    
    try {
      const newCity = city;
      const newSpecialty = specialty;
      console.log(`In App try block, city:`, newCity);

      const response = await fetch(`http://localhost:3000/api/npi?city=${encodeURIComponent(newCity)}&specialty=${encodeURIComponent(newSpecialty)}`);

      const data = await response.json();
      console.log('data', data)
    // console.log('NPI API response:', res.locals.data);
    //   return res.json({ data: res.locals.data });
      setSearchResults(data.data);
    
    } catch (err) {
      console.error('A network error occurred: ', err);
    }
    
  }

  return (
    <div>
      <h1>Territory Planner</h1>
      <MapComponent />
      <input type="text" value={city} placeholder="Enter city name" onChange={ e => setCity(e.target.value)} />
      <input type="text" value={specialty} placeholder="Enter specialty" onChange={ e => setSpecialty(e.target.value)} />
      <button onClick={clicked} >Search</button>

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
