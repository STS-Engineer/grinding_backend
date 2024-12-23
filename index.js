const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors middleware
const prodformrouter = require('./services/formulaireprod');
const app = express();

app.use(bodyParser.json());

app.use(cors({
  origin: 'https://grinding-same.azurewebsites.net', // Allow frontend origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Explicitly allow these methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify headers allowed in requests
  credentials: true, // Allow credentials (if using cookies or authentication headers)
}));
  
app.use('/ajouter', prodformrouter)

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
