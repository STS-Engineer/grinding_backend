const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt= require('bcryptjs');
const jwt = require('jsonwebtoken');

JWT_SECRET='12345'
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user already exists
    const userExists = await pool.query('SELECT * FROM utilisateur WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const result = await pool.query(
      'INSERT INTO utilisateur (email, password) VALUES ($1, $2) RETURNING *',
      [email, hashedPassword]
    );

    res.status(201).json({ message: 'User created successfully', userId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const result = await pool.query('SELECT * FROM utilisateur WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare the password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});



// Ajouter form prod
router.post('/prod', async (req, res) => {
  const {
    referenceproduit, date, shift, phase,
    commentaires, totalrealise, machine_id, defaut, typedefautproduction,
    totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction,
    dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl
  } = req.body;

  try {
    // Insert production record
    const productionResult = await pool.query(
      `INSERT INTO production (referenceproduit, date, shift, phase, commentaires, totalrealise, machine_id, defaut, typedefautproduction, totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction, dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING *`,
      [referenceproduit, date, shift, phase, commentaires, totalrealise, machine_id, defaut,  typedefautproduction, totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction, dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl]
    );

    // const result = await pool.query('SELECT * from machine where id =$1', [machine_id]);
    // const machineresult = await result.rows[0];
    // const dureevierefroueoutil = machineresult.dureevierefroueoutil;
    // const dureevierefmeulehauteuroutil = machineresult.dureevierefmeulehauteuroutil;
    // const dureevierefmeulelargeuroutil = machineresult.dureevierefmeulelargeuroutil;
    // const dureevierefmeulerefmeulechanfreinsoutil = machineresult.dureevierefmeulerefmeulechanfreinsoutil;
    // const dureevieoutillageusinagerainureoutil = machineresult.dureevieoutillageusinagerainureoutil;
    // const dureevierefmeulerayonnageoutil = machineresult.dureevierefmeulerayonnageoutil;
    // const dureevieusinagetete = machineresult.dureevieusinagetete;
    
    // // Calculate remaining life
    // const dureevierefroueoutilresult =  dureevierefroueoutil - totalrealise ;
    // const dureevierefmeulehauteuroutilresult = dureevierefmeulehauteuroutil - totalrealise;
    // const dureevierefmeulelargeuroutilresult = dureevierefmeulelargeuroutil - totalrealise;
    // const dureevierefmeulerefmeulechanfreinsoutilresult =  dureevierefmeulerefmeulechanfreinsoutil - totalrealise;
    // const dureevieoutillageusinagerainureoutilresult =  dureevieoutillageusinagerainureoutil - totalrealise;
    // const dureevierefmeulerayonnageoutilresult =  dureevierefmeulerayonnageoutil - totalrealise;
    // const dureevieusinageteteresult = dureevieusinagetete - totalrealise;

    // // Update machine table
    // await pool.query(
    //   `UPDATE machine
    //    SET dureevierefroueoutil = $1, dureevierefmeulehauteuroutil = $2, dureevierefmeulelargeuroutil = $3, dureevierefmeulerefmeulechanfreinsoutil = $4, dureevieoutillageusinagerainureoutil = $5, dureevierefmeulerayonnageoutil = $6, dureevieusinagetete = $7
    //    WHERE id = $8`,
    //   [dureevierefroueoutilresult, dureevierefmeulehauteuroutilresult, dureevierefmeulelargeuroutilresult, dureevierefmeulerefmeulechanfreinsoutilresult, dureevieoutillageusinagerainureoutilresult, dureevierefmeulerayonnageoutilresult, dureevieusinageteteresult, machine_id]
    // );

    const production = productionResult.rows[0];

    res.status(201).json({
      message: 'Production created successfully with updated dureedevie',
      production
    });
  } catch (err) {
    console.error('Error adding production:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});





// Middleware to authenticate and extract user from JWT
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("Authorization header missing or invalid");
    return res.status(401).json({ message: 'Authorization token is missing' });
  }

  const token = authHeader.split(' ')[1];
  console.log("Extracted Token:", token);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded Token Payload:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("JWT Verification Error:", error.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};


// Route to add a new machine with user ID
router.post('/machine', authenticate, async (req, res) => {
  const {
    nom,
    reference,
    date,
    cadence_horaire,
    nombre_operateur_chargement,
    cadence_horaire_cf,
    cadence_horaire_csl,
    phase1chargement,
    phase1roueavancement,
    refroueoutil,
    dureevierefroueoutil,
    phase2usinagehauteur,
    refmeulehauteuroutil,
    dureevierefmeulehauteuroutil,
    phase3usinagelargeur,
    refmeulelargeuroutil,
    dureevierefmeulelargeuroutil,
    phase4usinagechanfreins,
    refmeulechanfreinsoutil,
    dureevierefmeulerefmeulechanfreinsoutil,
    phase5usinagerainure,
    outillageusinagerainureoutil,
    dureevieoutillageusinagerainureoutil,
    phase5usinagerayonnage,
    refmeulerayonnage,
    dureevierefmeulerayonnageoutil,
    phase5usinagetete,
    outillageusinagetete,
    dureevieusinagetete,
    phase6inspectioncf,
    nombre_operateur_cf,
    phase6inspectioncsl,
    nombre_operateur_csl
  } = req.body;



  try {
    // Insert the new machine and return its ID
    const machineResult = await pool.query(
      `
      INSERT INTO machine (
        nom, reference, date, cadence_horaire, 
        nombre_operateur_chargement, cadence_horaire_cf, cadence_horaire_csl, 
        phase1chargement, phase1roueavancement, refroueoutil, dureevierefroueoutil, 
        phase2usinagehauteur, refmeulehauteuroutil, dureevierefmeulehauteuroutil, 
        phase3usinagelargeur, refmeulelargeuroutil, dureevierefmeulelargeuroutil, 
        phase4usinagechanfreins, refmeulechanfreinsoutil, dureevierefmeulerefmeulechanfreinsoutil, 
        phase5usinagerainure, outillageusinagerainureoutil, dureevieoutillageusinagerainureoutil, 
        phase5usinagerayonnage, refmeulerayonnage, dureevierefmeulerayonnageoutil, 
        phase5usinagetete, outillageusinagetete, dureevieusinagetete, 
        phase6inspectioncf, nombre_operateur_cf, phase6inspectioncsl, 
        nombre_operateur_csl
      )
      VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, 
        $9, $10, $11, $12, 
        $13, $14, $15, 
        $16, $17, $18, 
        $19, $20, $21, 
        $22, $23, $24, 
        $25, $26, $27, 
        $28, $29, $30, 
        $31, $32, $33
      )
      RETURNING id
      `,
      [
        nom, reference, date, cadence_horaire, 
        nombre_operateur_chargement, cadence_horaire_cf, cadence_horaire_csl, 
        phase1chargement, phase1roueavancement, refroueoutil, dureevierefroueoutil, 
        phase2usinagehauteur, refmeulehauteuroutil, dureevierefmeulehauteuroutil, 
        phase3usinagelargeur, refmeulelargeuroutil, dureevierefmeulelargeuroutil, 
        phase4usinagechanfreins, refmeulechanfreinsoutil, dureevierefmeulerefmeulechanfreinsoutil, 
        phase5usinagerainure, outillageusinagerainureoutil, dureevieoutillageusinagerainureoutil, 
        phase5usinagerayonnage, refmeulerayonnage, dureevierefmeulerayonnageoutil, 
        phase5usinagetete, outillageusinagetete, dureevieusinagetete, 
        phase6inspectioncf, nombre_operateur_cf, phase6inspectioncsl, 
        nombre_operateur_csl
      ]
    );
    
    

    res.status(201).json({ 
      message: 'Machine added successfully', 
      machine: machineResult.rows[0] 
    });
  } catch (err) {
    console.error('Error adding machine:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


//new machine post methid correct
router.post('/machinee', authenticate, async (req, res) => {
  const {
    nom,
    referenceproduit,
    date,
    cadence_horaire,
    nombre_operateur_chargement,
    cadence_horaire_cf,
    cadence_horaire_csl,
    nombre_operateur_cf,
    nombre_operateur_csl,
    tools = [] // default array for tools
  } = req.body;

  const userId = req.user.userId; // Extract user ID from JWT

  // Start a transaction for database consistency
  try {
    await pool.query('BEGIN'); // Start transaction

    // Insert the machine data
    const machineResult = await pool.query(
      `INSERT INTO machine 
      (nom, referenceproduit, date, user_id, cadence_horaire, nombre_operateur_chargement, 
      cadence_horaire_cf, cadence_horaire_csl, nombre_operateur_cf, nombre_operateur_csl) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING id`,
      [
        nom,
        referenceproduit,
        date,
        userId,
        cadence_horaire,
        nombre_operateur_chargement,
        cadence_horaire_cf,
        cadence_horaire_csl,
        nombre_operateur_cf,
        nombre_operateur_csl
      ]
    );

    const machineId = machineResult.rows[0].id; // Get generated machine ID
    console.log('Machine inserted, generated ID:', machineId);

    // If tools are provided, insert them in batch for performance
    if (tools.length > 0) {
      const toolValues = tools.map(tool => [
        tool.phase,
        tool.nom_outil,
        tool.dureedevie,
        machineId,
        referenceproduit
      ]);

      // Prepare placeholders for batch insertion
      const placeholders = toolValues
        .map(
          (_, i) =>
            `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
        )
        .join(', ');

      // Batch insert tools
      await pool.query(
        `INSERT INTO outil (phase, nom_outil, dureedevie, machine_id, referenceproduit) VALUES ${placeholders}`,
        toolValues.flat()
      );

      console.log('Tools inserted:', tools.length);
    } else {
      console.log('No tools provided for insertion.');
    }

    await pool.query('COMMIT'); // Commit the transaction

    // Respond with success
    return res.status(201).json({
      message: 'Machine and tools created successfully',
      machine: {
        id: machineId,
        nombre_operateur_chargement,
        nombre_operateur_cf,
        nombre_operateur_csl,
        tools
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK'); // Rollback transaction on error
    console.error('Error creating machine and tools:', error);

    return res.status(500).json({
      message: 'An error occurred while creating the machine and tools',
      error: error.message // Only for debugging during development
    });
  }
});


// Route to fetch all machine details
router.get('/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machine');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machines:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to add an outil to an existing machine
router.put('/machine/:id/outil', authenticate, async (req, res) => {

  const { 
   
    nombre_operateur_chargement, 
    nombre_operateur_cf, 
    nombre_operateur_csl, 
    tools = [] // default array
  } = req.body;

  const { id } = req.params; // Machine ID from URL parameter
  const userId = req.user.userId; // Extract user ID from JWT

  try {
    // Start the transaction
    await pool.query('BEGIN');

    // Check if the machine exists
    const machineResult = await pool.query(
      `SELECT * FROM machine WHERE id = $1`,
      [id]
    );

    if (machineResult.rows.length === 0) {
      // Rollback transaction and return error if machine not found
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Machine not found' });
    }

    // Update the machine's details
    await pool.query(
      `UPDATE machine
       SET  user_id = $1, 
           nombre_operateur_chargement = $2, nombre_operateur_cf = $3, nombre_operateur_csl = $4
       WHERE id = $5`,
      [userId, nombre_operateur_chargement, 
       nombre_operateur_cf, nombre_operateur_csl, id]
    );

    // Remove existing tools related to the machine (optional based on your use case)
    await pool.query('DELETE FROM outil WHERE machine_id = $1', [id]);

    // Loop through the tools array and insert each one into the 'outil' table with the updated machine_id
    for (const tool of tools) {
      await pool.query(
        'INSERT INTO outil (phase, nom_outil, dureedevie, machine_id) VALUES ($1, $2, $3, $4)',
        [tool.phase, tool.nom_outil, tool.dureedevie, id] // Insert tools linked to the updated machine
      );
    }

    return res.status(200).json({ 
      message: 'Machine and Outils updated successfully',
      machine: { id, nombre_operateur_chargement, nombre_operateur_cf, nombre_operateur_csl }
    });
  } catch (error) {
    console.error('Error updating machine and outils:', error);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while updating the machine and tools' });
  }
});



// Route to get production data based on machine ID
router.get('/production/machine/:id', async (req, res) => {
  const { id } = req.params; // Fetch the machine ID from URL parameters
  try {
    // Query the production table based on machine ID
    const result = await pool.query(
      'SELECT * FROM production WHERE machine_id = $1', // The production table references the machine ID
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No production data found for this machine' });
    }

    res.json(result.rows); // Return the production data for the given machine ID
  } catch (err) {
    console.error('Error fetching production data:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});



router.get('', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM production');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching production:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/outil', authenticate, async (req, res) => {
  const { phase, nom_outil, referenece, dureedevie,machine_id } = req.body;

  // Log the request body for debugging
  console.log(req.body);

  try {

    const result = await pool.query(
      `INSERT INTO outil (  phase, nom_outil, referenece, dureedevie, machine_id  )
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [phase, nom_outil, referenece, dureedevie,machine_id]
    );

    // Return success response
    res.status(201).json({
      message: 'Outil created successfully',
      outil: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating outil:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/ajouter/plannification/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Received id:', id); // Log the received id

  try {
    const result = await pool.query(
      'SELECT totalplanifie FROM plannification WHERE id_machine = $1',
      [id]
    );
    console.log('Query result:', result.rows); // Log the query result

    if (result.rows.length > 0) {
      res.json({ totalplanifie: result.rows[0].totalplanifie });
    } else {
      res.status(404).json({ message: 'Plannification not found' });
    }
  } catch (err) {
    console.error('Error fetching totalplanifie:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Route to add a new machine with user ID
router.post('/plannification', authenticate, async (req, res) => {
  const {
    phasechargement,
    id_machine,
    id_operateur,
    phasereguleur,
    operateur_reguleur,
    phasecsl,
    operateur_csl,
    phasecf,
    operateur_cf,
    operateur_chargement,
    totalplanifie,
    shift,
    nombre_heure_shift1,
    nombre_heure_shift2,
    phasechargementshif2,
    phasereguleurshif2,
    operateur_reguleurshif2,
    phasecslshift2,
    operateurcslshift2,
    phasecfshift2,
    operateurcfshift2,
    objectivecf,
    objectivecsl,
    objectiveproductionshift2,
    objectivecslshift2,
    objectivecfshift2,
    shift2,
    date_creation,
    start_date, // Add this field if you want to pass the date from the request
    end_date 
  } = req.body;

  try {
    // Use CURRENT_TIMESTAMP if no date_creation is passed in the request
    const currentDate = date_creation || new Date().toISOString(); // Default to current date if not provided

    // Insert the new plannification with all the fields, including date_creation
    const result = await pool.query(
      'INSERT INTO plannification (phasechargement, id_machine, id_operateur, phasereguleur, operateur_reguleur, phasecsl, operateur_csl, phasecf, operateur_cf, operateur_chargement, totalplanifie, shift, nombre_heure_shift1, nombre_heure_shift2, phasechargementshif2, phasereguleurshif2, operateur_reguleurshif2, phasecslshift2, operateurcslshift2, phasecfshift2, operateurcfshift2, objectivecf, objectivecsl, objectiveproductionshift2, objectivecslshift2, objectivecfshift2, shift2, date_creation, start_date, end_date ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30) RETURNING *',
      [
        phasechargement,
        id_machine,
        id_operateur,
        phasereguleur,
        operateur_reguleur,
        phasecsl,
        operateur_csl,
        phasecf,
        operateur_cf,
        operateur_chargement,
        totalplanifie,
        shift,
        nombre_heure_shift1,
        nombre_heure_shift2,
        phasechargementshif2,
        phasereguleurshif2,
        operateur_reguleurshif2,
        phasecslshift2,
        operateurcslshift2,
        phasecfshift2,
        operateurcfshift2,
        objectivecf,
        objectivecsl,
        objectiveproductionshift2,
        objectivecslshift2,
        objectivecfshift2,
        shift2,
        currentDate, // Add the current date here,
        start_date,
        end_date
      ]
    );

    res.status(201).json({ message: 'Plannification added successfully', plannification: result.rows[0] });
  } catch (err) {
    console.error('Error adding plannification:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/plannifications', authenticate, async (req, res) => {
  const { start_date, end_date, id_machine } = req.query; // Retrieve start_date, end_date, and machine_id from the query

  try {
    let query = 'SELECT * FROM plannification';
    let queryParams = [];

    // If both start_date and end_date are provided, filter by both
    if (start_date && end_date) {
      query += ' WHERE start_date >= $1 AND end_date <= $2';
      queryParams = [start_date, end_date];
    } else if (start_date) {
      // If only start_date is provided, filter by start_date
      query += ' WHERE start_date >= $1';
      queryParams = [start_date];
    } else if (end_date) {
      // If only end_date is provided, filter by end_date
      query += ' WHERE end_date <= $1';
      queryParams = [end_date];
    }

    // Add filtering for machine_id if provided
    if (id_machine) {
      query += queryParams.length ? ' AND id_machine = $' + (queryParams.length + 1) : ' WHERE id_machine = $1';
      queryParams.push(id_machine);
    }

    // Execute the query to fetch plannifications
    const result = await pool.query(query, queryParams);

    // Map the result to match the expected structure, including the machine details
    const plannifications = await Promise.all(result.rows.map(async (item) => {
      const machineResult = await pool.query("SELECT * FROM machine WHERE id = $1", [item.id_machine]);
      const machine = machineResult.rows[0];

      return {
        id: item.id,
        phasechargement: item.phasechargement,
        shift: item.shift,
        shift2: item.shift2,
        date_creation: item.date_creation,
        start_date: item.start_date,
        end_date: item.end_date,
        id_machine: item.id_machine,
        machine_name: machine ? machine.nom : "Unknown Machine", // Get machine name
      };
    }));

    // Send the response with the filtered plannifications
    res.status(200).json(plannifications);
  } catch (err) {
    console.error('Error fetching plannifications:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


//get plannifications
router.get('/plannification/:machineId', async (req, res) => {
  const { machineId } = req.params;

  try {
    // Fetch plannification records filtered by machine ID
    const plannificationResults = await pool.query(
      `SELECT * FROM plannification WHERE id_machine = $1`,
      [machineId]
    );
    if(plannificationResults.rows.length>0){
    return  res.status(200).json({message:"totalplanifie", totalplanifie: plannificationResults.rows[0].totalplanifie})
    } else {
    return  res.status(404).json({message:"plannification not found", plannification: plannificationResults.totalplanifie})
    }

  
  } catch (error) {
    console.error('Error fetching plannification:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/getoperateurs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operateur');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Operateurs retrieved successfully',
      operateurs: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve operateurs:', error);
    return res.status(500).json({
      message: 'Failed to retrieve operateurs',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});

//get by operateur id
router.get('/getoperateur/:id', async(req,res)=>{
  try{
    const {id} = req.params;

  const result = await pool.query('select nom from operateur where id = $1 ', [id]);
  const operateur = result.rows[0];
  if (!operateur){
    return res.status(400).json({message:'operateur not found'})
  }
  return res.status(200).json({message:'operateur handled succefully', operateur: operateur})
  
  } catch(error){
    console.error('failed')
  }
})
router.post('/addoperateur', async(req,res)=>{
  try{
  const {matricule, nom , prenom}= req.body;
  const result = await pool.query('insert into operateur (matricule, nom,prenom) values ($1,$2,$3)', [matricule,nom,prenom])
  const newoperateur = await result.rows[0];
   return res.status(200).json({message:'added succefully', result: newoperateur})

  } catch(error){
    console.error("Internal server");
    return res.status(500).json({message:'Internal server'})
  }
})


module.exports = router;
