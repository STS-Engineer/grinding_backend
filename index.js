const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors middleware
const prodformrouter = require('./services/formulaireprod');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

app.use(bodyParser.json());
app.use(cors({
    origin: 'https://grinding-backend.azurewebsites.net'
  }));
  
app.use('/ajouter', prodformrouter)

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
