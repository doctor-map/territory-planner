// SearchForm.tsx
// A controlled form component for entering city, state, and specialty.
//
// "Controlled" means React state owns the input values — every keystroke
// updates state, and the inputs always display what's in state. This is
// the standard React pattern and gives you a single source of truth.
//
// This component doesn't know anything about the API — it just collects
// input values and calls onSearch() with them when the button is clicked.
// Keeping data-fetching out of here makes this component easy to reuse
// or redesign without touching any API logic.

type SearchFormProps = {
  onSearch: (city: string, state: string, specialty: string) => void;
  isLoading: boolean; // disables the button while a search is in progress
};

// Common medical specialties for the dropdown.
// Using a select instead of a free-text field prevents typos that would
// return 0 results (e.g. "oncologist" vs "oncology" vs "medical oncology")
const SPECIALTIES = [
  'Medical Oncology',
  'Cardiology',
  'Endocrinology',
  'General Surgery',
  'Internal Medicine',
  'Neurology',
  'Orthopedic Surgery',
  'Pulmonology',
  'Rheumatology',
  'Urology',
];

// US state abbreviations for the dropdown — same reason as above
const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

import { useState } from 'react';

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  // Each input has its own piece of state. When the user types, the
  // onChange handler updates that state, re-rendering the input with
  // the new value — that's what "controlled" means.
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [specialty, setSpecialty] = useState('');

  const handleSearch = () => {
    // Basic validation before calling up to the parent
    if (!city.trim() || !state || !specialty) {
      alert('Please fill in all fields before searching.');
      return;
    }
    // We don't fetch data here — we hand the values up to App.tsx via
    // the onSearch prop. App.tsx owns the results state and the fetch logic.
    onSearch(city.trim(), state, specialty);
  };

  return (
    <div className="search-form">
      <input
        type="text"
        value={city}
        placeholder="City (e.g. Denver)"
        onChange={e => setCity(e.target.value)}
      />

      {/* Dropdown prevents the user from typing an invalid state abbreviation */}
      <select value={state} onChange={e => setState(e.target.value)}>
        <option value="">Select state</option>
        {STATES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Dropdown prevents free-text specialty mismatches against the NPI API */}
      <select value={specialty} onChange={e => setSpecialty(e.target.value)}>
        <option value="">Select specialty</option>
        {SPECIALTIES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <button onClick={handleSearch} disabled={isLoading}>
        {/* Show different text while loading so the user knows something's happening */}
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </div>
  );
}