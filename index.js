const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors middleware
const prodformrouter = require('./services/formulaireprod');
const nodemailer = require('nodemailer');


const app = express();

// Replace with your OAuth2 credentials
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'YOUR_REDIRECT_URI';
const REFRESH_TOKEN = 'YOUR_REFRESH_TOKEN'; // You need to obtain the refresh token


app.use(bodyParser.json());
app.use(cors({
    origin: 'http://localhost:3000'
  }));
  
app.use('/ajouter', prodformrouter)








const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
