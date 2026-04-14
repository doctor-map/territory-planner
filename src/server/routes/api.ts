import express from 'express';

const router = express.Router();

// Types
type NpiProvider = {
  number: string;
  basic: {
    first_name: string;
    last_name: string;
    enumeration_type: string;
  }
}

type NpiTaxonomy = {
  desc: string;
}

// Test route
router.get('/test', (req, res) => {
    console.log('API test route hit');
    return res.json({ message: 'API is working!' });
});

// NPI route
router.get('/npi', async (req, res) => {
    console.log('NPI route hit');

    const searchCity = req.query.city;
    console.log(`City in api.ts`, searchCity);

    try {
      const response = await fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&city=${searchCity}&limit=200`);
      const data = await response.json();
      
      // do something with data if needed, e.g., filter or transform it before sending to client
      // TODO: for duplicate entries, find credentials and/or telephone numbers
      const filteredData = data.results.map((provider: any) => ({
        npi: provider.number,
        //inconsitent first name field, so check both 
        first_name: provider.basic.first_name || provider.basic.authorized_official_first_name,
        last_name: provider.basic.last_name || provider.basic.authorized_official_last_name,
        npi_type: provider.enumeration_type,
        city: provider.addresses[0].city,
        state: provider.addresses[0].state,
        last_updated: provider.basic.last_updated,
        specialty: provider.taxonomies.map((taxonomy): NpiTaxonomy => taxonomy.desc).join(', ') 
      }));

  
      // Grouping providers with multiple entries into a single entry based on name
      const providerMap = new Map();
      for (const provider of filteredData) {
        // TODO: could possibly filter safer with phone number or credentials
        const providerKey = `${provider.first_name} ${provider.last_name}`;
        if (!providerMap.has(providerKey)) {
          providerMap.set(providerKey, provider);
        } else {
          const existingProvider = providerMap.get(providerKey);
          // Merge npi numbers and specialties if the provider already exists
          existingProvider.npi += `, ${provider.npi}`;
          existingProvider.specialty += `, ${provider.specialty}`;
        }
      }

      console.log('ProviderMap:', providerMap);

      res.locals.data = providerMap.size > 0 ? Array.from(providerMap.values()) : [];
      
      // console.log('NPI API response:', res.locals.data);

      return res.json({ data: res.locals.data });

    } catch (error) {
        console.error('Error fetching NPI data:', error);
        return res.status(500).json({ error: 'Failed to fetch NPI data' });
    };
});

export default router;