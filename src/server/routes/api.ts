import express from 'express';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
    console.log('API test route hit');
    return res.json({ message: 'API is working!' });
});

// NPI route
router.get('/npi', async (req, res) => {
    console.log('NPI route hit');

    try {
      const response = await fetch('https://npiregistry.cms.hhs.gov/api/?version=2.1&city=baltimore');
      const data = await response.json();
      
      // do something with data if needed, e.g., filter or transform it before sending to client
      const filteredData = data.results.map((provider: any) => ({
        npi: provider.number,
        name: provider.basic.first_name,
        city: provider.addresses[0].city,
        state: provider.addresses[0].state,
      }));
      res.locals.data = filteredData;
      
      console.log('NPI API response:', res.locals.data);

      return res.json({ data: res.locals.data });

    } catch (error) {
        console.error('Error fetching NPI data:', error);
        return res.status(500).json({ error: 'Failed to fetch NPI data' });
    };

});

export default router;