import express from 'express';
import { getData } from './scraper'; 


const app = express();
const port = process.env.PORT || 3001; 

app.use(express.json());

app.get('/api/listings', getData); 

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
