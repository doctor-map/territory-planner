import './App.css'
import { useState } from 'react';

function App() {
  const [ city, setCity ] = useState('');
  const [ searchResults, setSearchResults ] = useState([]);

  const clicked = async () => {
    console.log('clicked');
    
    try {
      const newCity = city;
      console.log(`In App try block, city:`, newCity);

      const response = await fetch(`http://localhost:3000/api/npi?city=${encodeURIComponent(newCity)}`);

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
      <input type="text" value={city} placeholder="Enter city name" onChange={ e => setCity(e.target.value)} />
      <button onClick={clicked} >Search</button>

      <ul>
        {searchResults.map((result: any) => (
          <li key={result.npi}> first name: {result.first_name}, last name: {result.last_name}, NPI type: {result.npi_type} specialty: {result.specialty}, last updated: {result.last_updated}</li>
        ))}
      </ul>
    </div>
  )
}

export default App
