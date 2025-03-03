const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt= require('bcryptjs');
const jwt = require('jsonwebtoken');


JWT_SECRET='12345'
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;

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
      'INSERT INTO utilisateur (email, password, role) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, role]
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

    res.status(200).json({ message: 'Login successful', token, role: user.role  });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});



// Ajouter form prod
router.post('/prod', async (req, res) => {
  const {
    referenceproduit, date, shift, phase, totalplanifie,
    commentaires, totalrealise, machine_id, defaut, typedefautproduction,
    totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl,
    typedeproblemeproduction, dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf,
    typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl, nombreoperateur
  } = req.body;

  try {
    // Insert production record
    const productionResult = await pool.query(
      `INSERT INTO production (referenceproduit, date, shift, phase, totalplanifie, commentaires, totalrealise, machine_id, defaut, typedefautproduction, totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction, dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl, nombreoperateur)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING *`,
      [referenceproduit, date, shift, phase, totalplanifie, commentaires, totalrealise, machine_id, defaut, typedefautproduction, totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction, dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl, nombreoperateur]
    );

    const production = productionResult.rows[0];

    // Retrieve the nom_machine for the given machine_id
    const machineResult = await pool.query(
      `SELECT nom FROM machine WHERE id = $1`,
      [machine_id]
    );

    if (machineResult.rows.length === 0) {
      return res.status(404).json({ message: 'Machine not found for the provided machine_id' });
    }

    const nomMachine = machineResult.rows[0].nom;

    // Retrieve the declaration records matching the nom_machine
    const declarationResult = await pool.query(
      `SELECT * FROM declaration WHERE nom_machine = $1`,
      [nomMachine]
    );

    if (declarationResult.rows.length === 0) {
      return res.status(404).json({ message: `No matching declaration found for machine: ${nomMachine}` });
    }

    // Update only the matching declaration records
    const updatePromises = declarationResult.rows.map(async (declaration) => {
      const currentDureeDeviePointeur = declaration.dureedeviepointeur;
      const updatedDureeDeviePointeur = Math.max(0, currentDureeDeviePointeur - totalrealise);

      console.log(`Updating declaration for machine ${nomMachine}:`);
      console.log('Current DureeDeviePointeur:', currentDureeDeviePointeur);
      console.log('Updated DureeDeviePointeur:', updatedDureeDeviePointeur);

      return pool.query(
        `UPDATE declaration 
         SET dureedeviepointeur = $1 
         WHERE id = $2 
         RETURNING *`,
        [updatedDureeDeviePointeur, declaration.id]
      );
    });

    const updatedDeclarations = await Promise.all(updatePromises);

    res.status(201).json({
      message: 'Production created successfully with the totalplanifie value',
      production,
      updatedDeclarations
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
    nom, referenceproduit, date, cadence_horaire, 
    nombre_operateur_chargement, cadence_horaire_cf, cadence_horaire_csl, 
    nombre_operateur_cf, nombre_operateur_csl, tools = [] 
  } = req.body;

  const userId = req.user.userId; // Extract user ID from JWT

  try {
    console.log('Received data:', { nom, referenceproduit, date, userId, cadence_horaire, nombre_operateur_chargement, cadence_horaire_cf, cadence_horaire_csl, nombre_operateur_cf, nombre_operateur_csl, tools });

    // Start the transaction
    await pool.query('BEGIN');

    // Insert the machine
    const result = await pool.query(
      `INSERT INTO machine (nom, referenceproduit, date, user_id, cadence_horaire, nombre_operateur_chargement, 
                            cadence_horaire_cf, cadence_horaire_csl, nombre_operateur_cf, nombre_operateur_csl) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING id`, 
      [nom, referenceproduit, date, userId, cadence_horaire, nombre_operateur_chargement, cadence_horaire_cf, 
       cadence_horaire_csl, nombre_operateur_cf, nombre_operateur_csl]
    );

    // Get the generated machine id
    const machineId = result.rows[0].id;

    console.log('Machine inserted, generated ID:', machineId);

    if (tools.length > 0) {
      for (const tool of tools) {
        if (!tool.nom_outil || tool.nom_outil.trim() === '') {
          console.log(`Skipping empty tool:`, tool);
          continue; // Skip empty tools
        }

        console.log('Inserting tool:', tool);
        const dureedeviepointeur = tool.dureedeviepointeur ?? tool.dureedevie;

        // Insert tool into outil table
        await pool.query(
          'INSERT INTO outil (phase, nom_outil, dureedevie, machine_id, referenceproduit, dureedeviepointeur, nom_machine) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [tool.phase, tool.nom_outil, tool.dureedevie, machineId, tool.referenceproduit, dureedeviepointeur, nom]
        );

   
      }
    } else {
      console.log('No tools provided for insertion.');
    }

    // Commit the transaction
    await pool.query('COMMIT');

    return res.status(201).json({
      message: 'Machine and Outils created successfully',
      machine: { id: machineId, nombre_operateur_chargement, nombre_operateur_cf, nombre_operateur_csl, tools }
    });
  } catch (error) {
    console.error('Error creating machine and outils:', error.message);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while creating the machine and tools', error: error.message });
  }
});


router.get('/plannificationss', authenticate, async (req, res) => {
  const { phase, shift, id_machine, referenceproduit } = req.query;
  
  // Get today's date in the same format as the database date (yyyy-mm-dd)
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await pool.query(
      'SELECT * FROM plannification WHERE phase = $1 AND shift = $2 AND $3 BETWEEN start_date AND end_date AND id_machine = $4 AND referenceproduit = $5',
      [phase, shift, today, id_machine, referenceproduit]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching plannifications:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/listplannification', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plannification');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Plannification retrieved successfully',
      plannifications: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve Probleme:', error);
    return res.status(500).json({
      message: 'Failed to retrieve Probleme',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});

router.put('/updateplannification/:id', authenticate, async (req, res) => {
  const {
    phase,
    id_machine,
    operateurs,
    totalplanifie,
    shift,
    nombre_heure_shift1,
    nombre_heure_shift2,
    date_creation,
    start_date, // Add this field if you want to pass the date from the request
    end_date, 
    referenceproduit,
    nombredemanqueoperateur
  } = req.body;

  const { id } = req.params; // Get the plannification id from the route parameter

  try {
    // Use CURRENT_TIMESTAMP if no date_creation is passed in the request
    const currentDate = date_creation 
      ? new Date(date_creation).toISOString().split("T")[0] 
      : new Date().toISOString().split("T")[0]; // Default to current date if not provided

    // Update the plannification with the provided data
    const result = await pool.query(
      'UPDATE plannification SET phase = $1, id_machine = $2, operateurs = $3, totalplanifie = $4, shift = $5, nombre_heure_shift1 = $6, nombre_heure_shift2 = $7, date_creation = $8, start_date = $9, end_date = $10, referenceproduit = $11, nombredemanqueoperateur = $12 WHERE id = $13 RETURNING *',
      [
        phase,
        id_machine,
        operateurs,
        totalplanifie,
        shift,
        nombre_heure_shift1,
        nombre_heure_shift2,
        currentDate, // Update with the current date if necessary
        start_date,
        end_date,
        referenceproduit,
        nombredemanqueoperateur,
        id // Use the ID to find the plannification to update
      ]
    );

    if (result.rows.length > 0) {
      res.status(200).json({ message: 'Plannification updated successfully', plannification: result.rows[0] });
    } else {
      res.status(404).json({ message: 'Plannification not found' });
    }
  } catch (err) {
    console.error('Error updating plannification:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/plannifications/:id', authenticate, async (req, res) => {
  const { id } = req.params;  // Get the 'id' from the URL parameters

  try {
    // First, check if the plannification exists by fetching it
    const result = await pool.query(
      'SELECT * FROM plannification WHERE id = $1',  // Use the 'id' to fetch the plannification
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plannification not found' });
    }

    // If the plannification exists, delete it
    await pool.query(
      'DELETE FROM plannification WHERE id = $1',  // SQL query to delete the plannification
      [id]
    );

    res.status(200).json({ message: 'Plannification deleted successfully' });

  } catch (err) {
    console.error('Error deleting plannification:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.put('/machinee/:id', authenticate, async (req, res) => {
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
    tools = [] // default array
  } = req.body;

  const userId = req.user.userId; // Extract user ID from JWT
  const machineId = req.params.id; // Machine ID to update

  try {
    // Start the transaction
    await pool.query('BEGIN');

    // Update the machine
    const updateMachineResult = await pool.query(
      `UPDATE machine
       SET nom = $1,
           referenceproduit = $2,
           date = $3,
           user_id = $4,
           cadence_horaire = $5,
           nombre_operateur_chargement = $6,
           cadence_horaire_cf = $7,
           cadence_horaire_csl = $8,
           nombre_operateur_cf = $9,
           nombre_operateur_csl = $10
       WHERE id = $11`,
      [
        nom,
        referenceproduit,
        date || null,
        userId,
        cadence_horaire || 0,
        nombre_operateur_chargement || 0,
        cadence_horaire_cf || 0,
        cadence_horaire_csl || 0,
        nombre_operateur_cf || 0,
        nombre_operateur_csl || 0,
        machineId
      ]
    );

    if (updateMachineResult.rowCount === 0) {
      // Rollback and return if the machine doesn't exist
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Machine not found' });
    }

    console.log('Machine updated, ID:', machineId); // Debugging line

    // Fetch existing tools for the machine
    const existingToolsResult = await pool.query('SELECT id FROM outil WHERE machine_id = $1', [machineId]);
    const existingToolIds = existingToolsResult.rows.map(row => row.id);

    // Split tools into categories
    const toolsToUpdate = tools.filter(tool => tool.id && existingToolIds.includes(tool.id));
    const toolsToAdd = tools.filter(tool => !tool.id);
    const toolsToDelete = existingToolIds.filter(id => !tools.some(tool => tool.id === id));

    // Update existing tools
    for (const tool of toolsToUpdate) {
      await pool.query(
        `UPDATE outil
         SET phase = $1,
             nom_outil = $2,
             dureedevie = $3,
             referenceproduit = $4
         WHERE id = $5`,
        [tool.phase, tool.nom_outil, tool.dureedevie, referenceproduit, tool.id]
      );
    }

    // Add new tools
    for (const tool of toolsToAdd) {
      await pool.query(
        `INSERT INTO outil (phase, nom_outil, dureedevie, machine_id, referenceproduit)
         VALUES ($1, $2, $3, $4, $5)`,
        [tool.phase, tool.nom_outil, tool.dureedevie, machineId, referenceproduit]
      );
    }

    // Delete removed tools
    for (const toolId of toolsToDelete) {
      await pool.query('DELETE FROM outil WHERE id = $1', [toolId]);
    }

    // Commit the transaction
    await pool.query('COMMIT');

    return res.status(200).json({
      message: 'Machine and tools updated successfully',
      machine: {
        id: machineId,
        nombre_operateur_chargement,
        nombre_operateur_cf,
        nombre_operateur_csl,
        tools
      }
    });
  } catch (error) {
    console.error('Error updating machine and tools:', error);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while updating the machine and tools' });
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

    // Commit the transaction
    await pool.query('COMMIT');

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



router.delete('/machinee/:id', authenticate, async (req, res) => {
  const machineId = req.params.id; // Get machine ID from URL parameter
  const userId = req.user.userId; // Extract user ID from JWT

  try {
    // Log the machine ID and user ID for debugging
    console.log('Received machine ID to delete:', machineId, 'User ID:', userId);

    // Start the transaction
    await pool.query('BEGIN');

    // Check if the machine exists and if the user is authorized to delete it
    const machineResult = await pool.query(
      'SELECT user_id FROM machine WHERE id = $1',
      [machineId]
    );

    if (machineResult.rowCount === 0) {
      return res.status(404).json({ message: 'Machine not found' });
    }

    const machine = machineResult.rows[0];

    if (machine.user_id !== userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this machine' });
    }

    // Delete all tools associated with the machine
    await pool.query(
      'DELETE FROM outil WHERE machine_id = $1',
      [machineId]
    );
    console.log('Tools deleted for machine ID:', machineId);

    // Delete the machine
    await pool.query(
      'DELETE FROM machine WHERE id = $1',
      [machineId]
    );
    console.log('Machine deleted:', machineId);

    // Commit the transaction
    await pool.query('COMMIT');

    return res.status(200).json({
      message: 'Machine and associated tools deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting machine and tools:', error.message);

    // Log the full stack trace for debugging
    if (error.stack) console.error(error.stack);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while deleting the machine and tools', error: error.message });
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
    phase,
    id_machine,
    operateurs,
    totalplanifie,
    shift,
    nombre_heure_shift1,
    nombre_heure_shift2,
    date_creation,
    start_date, // Add this field if you want to pass the date from the request
    end_date, 
    referenceproduit,
    nombredemanqueoperateur
   
  } = req.body;

  try {
    // Use CURRENT_TIMESTAMP if no date_creation is passed in the request
        const currentDate = date_creation 
        ? new Date(date_creation).toISOString().split("T")[0] 
        : new Date().toISOString().split("T")[0];

    // Insert the new plannification with all the fields, including date_creation
    const result = await pool.query(
      'INSERT INTO plannification (phase, id_machine, operateurs, totalplanifie, shift, nombre_heure_shift1, nombre_heure_shift2, date_creation, start_date, end_date, referenceproduit, nombredemanqueoperateur ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [
        phase,
        id_machine,
        operateurs,
        totalplanifie,
        shift,
        nombre_heure_shift1,
        nombre_heure_shift2,
        currentDate, // Add the current date here,
        start_date,
        end_date,
        referenceproduit,
        nombredemanqueoperateur
        
      ]
    );

    res.status(201).json({ message: 'Plannification added successfully', plannification: result.rows[0] });
  } catch (err) {
    console.error('Error adding plannification:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.put('/updateplannification/:id', authenticate, async (req, res) => {
  const {
    phase,
    id_machine,
    operateurs,
    totalplanifie,
    shift,
    nombre_heure_shift1,
    nombre_heure_shift2,
    date_creation,
    start_date, // Add this field if you want to pass the date from the request
    end_date, 
    referenceproduit,
    nombredemanqueoperateur
  } = req.body;

  const { id } = req.params; // Get the plannification id from the route parameter

  try {
    // Use CURRENT_TIMESTAMP if no date_creation is passed in the request
    const currentDate = date_creation 
      ? new Date(date_creation).toISOString().split("T")[0] 
      : new Date().toISOString().split("T")[0]; // Default to current date if not provided

    // Update the plannification with the provided data
    const result = await pool.query(
      'UPDATE plannification SET phase = $1, id_machine = $2, operateurs = $3, totalplanifie = $4, shift = $5, nombre_heure_shift1 = $6, nombre_heure_shift2 = $7, date_creation = $8, start_date = $9, end_date = $10, referenceproduit = $11, nombredemanqueoperateur = $12 WHERE id = $13 RETURNING *',
      [
        phase,
        id_machine,
        operateurs,
        totalplanifie,
        shift,
        nombre_heure_shift1,
        nombre_heure_shift2,
        currentDate, // Update with the current date if necessary
        start_date,
        end_date,
        referenceproduit,
        nombredemanqueoperateur,
        id // Use the ID to find the plannification to update
      ]
    );

    if (result.rows.length > 0) {
      res.status(200).json({ message: 'Plannification updated successfully', plannification: result.rows[0] });
    } else {
      res.status(404).json({ message: 'Plannification not found' });
    }
  } catch (err) {
    console.error('Error updating plannification:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/plannifications/:id', authenticate, async (req, res) => {
  const { id } = req.params;  // Get the 'id' from the URL parameters

  try {
    // First, check if the plannification exists by fetching it
    const result = await pool.query(
      'SELECT * FROM plannification WHERE id = $1',  // Use the 'id' to fetch the plannification
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plannification not found' });
    }

    // If the plannification exists, delete it
    await pool.query(
      'DELETE FROM plannification WHERE id = $1',  // SQL query to delete the plannification
      [id]
    );

    res.status(200).json({ message: 'Plannification deleted successfully' });

  } catch (err) {
    console.error('Error deleting plannification:', err);
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
        totalplanifie: item.totalplanifie,
        phase: item.phase,
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

router.get('/plannifications/:id', authenticate, async (req, res) => {
  const { id } = req.params;  // Get the 'id' from the URL parameters

  try {
    const result = await pool.query(
      'SELECT * FROM plannification WHERE id = $1',  // Use the 'id' to fetch the plannification
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plannification not found' });
    }

    res.status(200).json(result.rows[0]);  // Return the plannification object
  } catch (err) {
    console.error('Error fetching plannification:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/plannificationss', authenticate, async (req, res) => {
  const { phase, shift, date_creation } = req.query;

  try {
    const result = await pool.query(
      'SELECT * FROM plannification WHERE phase = $1 AND shift = $2 AND date_creation = $3 ',
      [phase, shift, date_creation]
    );
    res.status(200).json(result.rows);
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




router.get('/check/plannification', async (req, res) => {
  const { id_machine, start_date, end_date } = req.query;

  // Validate required parameters
  if (!id_machine || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required query parameters: id_machine, start_date, or end_date' });
  }

  try {
    // PostgreSQL query to check overlapping plannification
    const query = `
      SELECT 1 
      FROM plannification
      WHERE id_machine = $1
        AND start_date <= $2  -- Ensure the start_date overlaps
        AND end_date >= $3    -- Ensure the end_date overlaps
      LIMIT 1;
    `;

    // Execute the query with parameterized inputs
    const result = await pool.query(query, [id_machine, end_date, start_date]);

    // Respond with the existence check
    res.status(200).json({ exists: result.rowCount > 0 });
  } catch (error) {
    console.error('Error checking plannification:', error);

    // Respond with a generic error message
    res.status(500).json({ error: 'Failed to check plannification.' });
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


router.put('/operateur/:id', authenticate, async (req, res) => {
  const {matricule, nom, prenom } = req.body;
  const RegleurId = req.params.id; // Regleur ID to update

  try {
    // Start the transaction
    await pool.query('BEGIN');

    // Update the regleur
    const updateOperateurResult = await pool.query(
      `UPDATE operateur
       SET matricule = $1, nom = $2, prenom = $3
       WHERE id = $4`, // Fixed the query by removing the extra comma before the WHERE clause
      [matricule, nom, prenom, RegleurId]
    );

    if (updateOperateurResult.rowCount === 0) {
      // Rollback and return if the regleur doesn't exist
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Operateur not found' });
    }

    // Commit the transaction
    await pool.query('COMMIT');

    return res.status(200).json({
      message: 'Operateur updated successfully',
      Regleur: {
        id: RegleurId,
        matricule,
        nom,
        prenom
      }
    });
  } catch (error) {
    console.error('Error updating Operateur:', error);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while updating the Operateur' });
  }
});

// delete operateur 

router.delete('/operateur/:id', authenticate, async (req, res) => {
  const operateurId = req.params.id; // Get machine ID from URL parameter
  const userId = req.user.userId; // Extract user ID from JWT

  try {
    // Log the machine ID and user ID for debugging
    console.log('Received operateur ID to delete:', operateurId, 'User ID:', userId);

    // Start the transaction
    await pool.query('BEGIN');


    // Delete the regleur
    await pool.query(
      'DELETE FROM operateur WHERE id = $1',
      [operateurId]
    );
    

    // Commit the transaction
    await pool.query('COMMIT');

    return res.status(200).json({
      message: 'Operateur a été supprimé',
    });
  } catch (error) {
    console.error('Error deleting Opérateur :', error.message);

    // Log the full stack trace for debugging
    if (error.stack) console.error(error.stack);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while deleting the operateur and tools', error: error.message });
  }
});

//getreguleurs

router.get('/getregleur', authenticate, async (req, res) => {
  try {
    // Await the query execution
    const result = await pool.query('SELECT * FROM regleur');

    // Return a 200 status (OK) and send all rows, not just the first row
    return res.status(200).json({ 
      message: 'Regleur handled successfully', 
      regleurs: result.rows 
    });
  } catch (error) {
    console.error('Error fetching regleur:', error); // Log the error for debugging
    return res.status(500).json({ message: 'Internal server error' });
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


router.post('/addregleur', authenticate , async(req,res)=>{
  try{
    const {nom,prenom} = req.body;
    const result = await pool.query('INSERT INTO regleur (nom, prenom)  VALUES ($1,$2) RETURNING *', [nom, prenom]);
    return res.status(201).json({message:"regleur added succefully", regleur: result.rows})
 
  }catch(error){
    return res.status(500).json({message:'internal server'})
  }
});

router.get('/getregleur', authenticate, async (req, res) => {
  try {
    // Await the query execution
    const result = await pool.query('SELECT * FROM regleur');

    // Return a 200 status (OK) and send all rows, not just the first row
    return res.status(200).json({ 
      message: 'Regleur handled successfully', 
      regleurs: result.rows 
    });
  } catch (error) {
    console.error('Error fetching regleur:', error); // Log the error for debugging
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/ajouterprobleme', authenticate, async (req, res) => {
  const { probleme } = req.body;

  try {
    if (!probleme) {
      return res.status(400).json({ message: 'The "probleme" field is required' });
    }

    // Execute the query
    const result = await pool.query(
      'INSERT INTO problemetechnique (probleme) VALUES ($1) RETURNING *',
      [probleme]
    );

    // Debugging: Log the result to ensure rows exist
    console.log('Query result:', result);

    // Check if rows are returned
    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ message: 'Problem was not inserted into the database' });
    }

    // Extract the new problem
    const newProbleme = result.rows[0];

    // Return a success response
    return res.status(201).json({
      message: 'Problem created successfully',
      probleme: newProbleme,
    });
  } catch (error) {
    console.error('Error creating problem:', error.message);

    // Return an error response
    return res.status(500).json({
      message: 'An error occurred while creating the problem',
      error: error.message,
    });
  }
});

router.post('/ajouterproblemecontrole', authenticate, async (req, res) => {
  const { problemecontrole } = req.body;

  try {

    // Execute the query
    const result = await pool.query(
      'INSERT INTO postecontrole (problemecontrole) VALUES ($1) RETURNING *',
      [problemecontrole]
    );

    // Debugging: Log the result to ensure rows exist
    console.log('Query result:', result);

    // Check if rows are returned
    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ message: 'Problem was not inserted into the database' });
    }

    // Extract the new problem
    const newProbleme = result.rows[0];

    // Return a success response
    return res.status(201).json({
      message: 'Problem created successfully',
      problemecontrole: newProbleme,
    });
  } catch (error) {
    console.error('Error creating problem:', error.message);

    // Return an error response
    return res.status(500).json({
      message: 'An error occurred while creating the problem',
      error: error.message,
    });
  }
});

router.get('/getproblemespostedecontrole', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM postecontrole');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Probleme retrieved successfully',
      operateurs: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve Probleme:', error);
    return res.status(500).json({
      message: 'Failed to retrieve Probleme',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});




// Update a problemecontrole
router.put('/updateproblemepostedecontrole/:id', async (req, res) => {
  const { id } = req.params; // The ID of the record to update
  const { problemecontrole} = req.body; // Assuming these are the fields to update (adjust as per your schema)

  try {
    const result = await pool.query(
      'UPDATE postecontrole SET problemecontrole = $1 WHERE id = $2 RETURNING *',
      [problemecontrole, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'Problemecontrole not found',
      });
    }

    return res.status(200).json({
      message: 'Problemecontrol updated successfully',
      updatedProbleme: result.rows[0], // Send back the updated record
    });
  } catch (error) {
    console.error('Error updating Problemecontrole:', error);
    return res.status(500).json({
      message: 'Failed to update Problemecontrole',
      error: error.message, // Optional: Include error message for debugging
    });
  }
});



// Delete a problemecontrole
router.delete('/deleteproblemepostedecontrole/:id', async (req, res) => {
  const { id } = req.params; // The ID of the record to delete

  try {
    const result = await pool.query(
      'DELETE FROM postecontrole WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'Problemecontrol not found',
      });
    }

    return res.status(200).json({
      message: 'Problemecontrol deleted successfully',
      deletedProbleme: result.rows[0], // Send back the deleted record
    });
  } catch (error) {
    console.error('Error deleting Problemecontrole:', error);
    return res.status(500).json({
      message: 'Failed to delete Problemecontrole',
      error: error.message, // Optional: Include error message for debugging
    });
  }
});

router.get('/getproblemes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM problemetechnique');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Probleme retrieved successfully',
      operateurs: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve Probleme:', error);
    return res.status(500).json({
      message: 'Failed to retrieve Probleme',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});
//defauts
router.post('/ajouterdefaut', authenticate, async (req, res) => {
  const { defaut } = req.body;

  try {
    if (!defaut) {
      return res.status(400).json({ message: 'The "defaut" field is required' });
    }

    // Execute the query
    const result = await pool.query(
      'INSERT INTO typedefaut (defaut) VALUES ($1) RETURNING *',
      [defaut]
    );

    // Debugging: Log the result to ensure rows exist
    console.log('Query result:', result);

    // Check if rows are returned
    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ message: 'defaut was not inserted into the database' });
    }

    // Extract the new problem
    const newDefaut = result.rows[0];

    // Return a success response
    return res.status(201).json({
      message: 'defaut created successfully',
      probleme: newDefaut,
    });
  } catch (error) {
    console.error('Error creating problem:', error.message);

    // Return an error response
    return res.status(500).json({
      message: 'An error occurred while creating the problem',
      error: error.message,
    });
  }
});

router.get('/getdefauts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM typedefaut');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Defaut retrieved successfully',
      operateurs: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve Probleme:', error);
    return res.status(500).json({
      message: 'Failed to retrieve Probleme',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});

router.post('/ajouterdefautinspection', authenticate, async (req, res) => {
  const { inspectiondefaut } = req.body;

  try {
 

    // Execute the query
    const result = await pool.query(
      'INSERT INTO inspectiondefaut (inspectiondefaut) VALUES ($1) RETURNING *',
      [inspectiondefaut]
    );

    // Debugging: Log the result to ensure rows exist
    console.log('Query result:', result);

    // Check if rows are returned
    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ message: 'defaut was not inserted into the database' });
    }

    // Extract the new problem
    const newDefaut = result.rows[0];

    // Return a success response
    return res.status(201).json({
      message: 'defaut inspection à été ajouté avec succés',
      probleme: newDefaut,
    });
  } catch (error) {
    console.error('Error creating problem:', error.message);

    // Return an error response
    return res.status(500).json({
      message: 'An error occurred while creating the problem',
      error: error.message,
    });
  }
});
router.get('/getdefautsinspection', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inspectiondefaut');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Defaut inspection retrieved successfully',
      operateurs: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve Probleme:', error);
    return res.status(500).json({
      message: 'Failed to retrieve Probleme',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});

router.delete('/regleur/:id', authenticate, async (req, res) => {
  const regleurId = req.params.id; // Get machine ID from URL parameter
  const userId = req.user.userId; // Extract user ID from JWT

  try {
    // Log the machine ID and user ID for debugging
    console.log('Received machine ID to delete:', regleurId, 'User ID:', userId);

    // Start the transaction
    await pool.query('BEGIN');


    // Delete the regleur
    await pool.query(
      'DELETE FROM regleur WHERE id = $1',
      [regleurId]
    );
    console.log('Machine deleted:', regleurId);

    // Commit the transaction
    await pool.query('COMMIT');

    return res.status(200).json({
      message: 'Regleur a été supprimé',
    });
  } catch (error) {
    console.error('Error deleting regleur :', error.message);

    // Log the full stack trace for debugging
    if (error.stack) console.error(error.stack);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while deleting the machine and tools', error: error.message });
  }
});

router.put('/regleur/:id', authenticate, async (req, res) => {
  const { nom, prenom } = req.body;
  const RegleurId = req.params.id; // Regleur ID to update

  try {
    // Start the transaction
    await pool.query('BEGIN');

    // Update the regleur
    const updateRegleurResult = await pool.query(
      `UPDATE regleur
       SET nom = $1, prenom = $2
       WHERE id = $3`, // Fixed the query by removing the extra comma before the WHERE clause
      [nom, prenom, RegleurId]
    );

    if (updateRegleurResult.rowCount === 0) {
      // Rollback and return if the regleur doesn't exist
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Regleur not found' });
    }

    // Commit the transaction
    await pool.query('COMMIT');

    return res.status(200).json({
      message: 'Regleur updated successfully',
      Regleur: {
        id: RegleurId,
        nom,
        prenom
      }
    });
  } catch (error) {
    console.error('Error updating regleur:', error);

    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    return res.status(500).json({ message: 'An error occurred while updating the regleur' });
  }
});

router.post('/ajouteroutil', authenticate, async (req, res) => {
  const { phase, nom_outil, dureedevie, referenceproduit } = req.body;

  try {
  

    // Execute the query
    const result = await pool.query(
      'INSERT INTO outil (phase, nom_outil, dureedevie, referenceproduit) VALUES ($1, $2,$3,$4) RETURNING *',
      [phase, nom_outil, dureedevie, referenceproduit]
    );

    // Debugging: Log the result to ensure rows exist
    console.log('Query result:', result);

    // Check if rows are returned
    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ message: 'Outil was not inserted into the database' });
    }

    // Extract the new problem
    const newOutil = result.rows[0];

    // Return a success response
    return res.status(201).json({
      message: 'Outil created successfully',
      problemecontrole: newOutil,
    });
  } catch (error) {
    console.error('Error creating problem:', error.message);

    // Return an error response
    return res.status(500).json({
      message: 'An error occurred while creating the problem',
      error: error.message,
    });
  }
});

router.get('/getoutil', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM declaration');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Outil retrieved successfully',
      operateurs: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve Outil:', error);
    return res.status(500).json({
      message: 'Failed to retrieve Outil',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});

router.post('/checkoutil', async (req, res) => {
  const { nom_outil, phase } = req.body;

  if (!nom_outil || !phase) {
    return res.status(400).json({
      message: 'Both nom_outil and phase are required.',
    });
  }

  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM outil WHERE nom_outil = $1 AND phase = $2',
      [nom_outil, phase]
    );

    const exists = parseInt(result.rows[0].count, 10) > 0;

    if (exists) {
      return res.status(200).json({
        exists: true,
        message: 'Outil or phase already exists.',
      });
    }

    return res.status(200).json({
      exists: false,
      message: 'Outil does not exist.',
    });
  } catch (error) {
    console.error('Failed to check Outil existence:', error);
    return res.status(500).json({
      message: 'Failed to check Outil existence',
      error: error.message,
    });
  }
});

router.get('/tools', authenticate, async (req, res) => {
  try {
    const tools = await pool.query('SELECT id, outil,dureedeviepointeur,dureedevie, reference FROM declaration');
    res.status(200).json(tools.rows);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ message: 'Failed to fetch tools' });
  }
});

// Update a tool
router.put('/tools/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { outil,  dureedeviepointeur, reference } = req.body;

  try {
    const updatedTool = await pool.query(
      'UPDATE declaration SET outil = $1, dureedeviepointeur = $2, reference = $3 WHERE id = $4 RETURNING *',
      [outil , dureedeviepointeur,reference, id]
    );

    if (updatedTool.rowCount === 0) {
      return res.status(404).json({ message: 'Tool not found' });
    }

    res.status(200).json({ message: 'Tool updated successfully', tool: updatedTool.rows[0] });
  } catch (error) {
    console.error('Error updating tool:', error);
    res.status(500).json({ message: 'Failed to update tool' });
  }
});

// Delete a tool
router.delete('/tools/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedTool = await pool.query('DELETE FROM declaration WHERE id = $1 RETURNING *', [id]);

    if (deletedTool.rowCount === 0) {
      return res.status(404).json({ message: 'Tool not found' });
    }

    res.status(200).json({ message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Error deleting tool:', error);
    res.status(500).json({ message: 'Failed to delete tool' });
  }
});

router.put('/resetdureedevie/:id', async (req, res) => {
  const { id } = req.params; // Extract the outil ID from the request parameters

  try {
    // Fetch the dureedevie from the specified outil
    const outildureedevie = await pool.query('SELECT dureedevie FROM declaration WHERE id = $1', [id]);
    const outilnom = await pool.query('SELECT outil FROM declaration WHERE id = $1', [id]);
    const outildureedeviepointeur = await pool.query('SELECT dureedeviepointeur FROM declaration WHERE id = $1', [id]);

    // Check if the outil exists and retrieve the dureedevie
    if (outildureedevie.rows.length === 0) {
      return res.status(404).json({ message: `No outil found with id: ${id}` });
    }

    const dureedevie = outildureedevie.rows[0].dureedevie;
    const dureedeviepointeur = outildureedeviepointeur.rows[0].dureedeviepointeur;  // Access the 'dureedevie' field
    const nom_outil = outilnom.rows[0].outil; // Access the 'dureedevie' field

    console.log('Dureedevie:', dureedevie); // Optional debugging line

    // Update the dureedeviepointeur column with the value of dureedevie
    const result = await pool.query(
      'UPDATE declaration SET dureedeviepointeur = $1 WHERE id = $2 RETURNING *',
      [dureedevie, id]
    );

    // Check if the outil was updated
    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'Outil not found or could not be updated',
      });
    }

    const historiqueMessage = `The Tool ${nom_outil} that has tool life ${dureedeviepointeur} has been changed`;

    // Manually format the current date and time
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // Insert into the database
    await pool.query(
      'INSERT INTO historique ( text, created_at) VALUES ($1, $2)',
      [ historiqueMessage, formattedDate]
    );
    
       

    return res.status(200).json({
      message: 'Durée de vie reset successfully',
      outil: result.rows[0], // Return the updated outil with the new dureedeviepointeur value
    });
  } catch (error) {
    console.error('Failed to reset durée de vie:', error);
    return res.status(500).json({
      message: 'Failed to reset durée de vie',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});

router.get('/historique', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM historique');

    // Assuming result.rows contains the data
    return res.status(200).json({
      message: 'Historical retrieved successfully',
      historiques: result.rows, // Sending only the data rows
    });
  } catch (error) {
    console.error('Failed to retrieve Probleme:', error);
    return res.status(500).json({
      message: 'Failed to retrieve Probleme',
      error: error.message, // Optional: Include the error message for debugging
    });
  }
});
router.post('/ajouterproduit', authenticate, async (req, res) => {
  const { reference, outil, nom_machine, dureedevie } = req.body;

  try {
    console.log('Received Data:', { reference, outil, nom_machine, dureedevie });

    // Insert into the 'produit' table (including dureedevie if needed)
    const result = await pool.query(
      'INSERT INTO produit (reference, outil, nom_machine) VALUES ($1, $2, $3) RETURNING *',
      [reference, outil, nom_machine]
    );

    console.log('Produit Insertion Result:', result.rows);

    if (!result.rows || result.rows.length === 0) {
      console.error('No rows returned from produit insert');
      return res.status(500).json({ message: 'Produit was not inserted into the database' });
    }

    // Extract the new product
    const newProduit = result.rows[0];

    // Check if an existing dureedevie exists for the given outil
    const existingDuree = await pool.query(
      'SELECT dureedevie FROM declaration WHERE outil = $1 AND dureedevie IS NOT NULL LIMIT 1',
      [outil]
    );

    let finalDureedevie = dureedevie; // Default to provided dureedevie

    if (existingDuree.rows.length > 0) {
      // If there's already a dureedevie for this outil, use it
      finalDureedevie = existingDuree.rows[0].dureedevie;
    }

    // Insert into the 'declaration' table with the correct dureedevie
    const declarationResult = await pool.query(
      'INSERT INTO declaration (nom_machine, reference, outil, dureedeviepointeur, dureedevie) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nom_machine, reference, outil, finalDureedevie, finalDureedevie]
    );

    console.log('Declaration Insertion Result:', declarationResult.rows);

    if (!declarationResult.rows || declarationResult.rows.length === 0) {
      console.error('No rows returned from declaration insert');
      return res.status(500).json({ message: 'Declaration was not inserted into the database' });
    }

    // Return a success response
    return res.status(201).json({
      message: 'Produit created successfully',
      produit: newProduit,
      dureedevie: dureedevie, // Return the assigned dureedevie
    });
  } catch (error) {
    console.error('Error creating product:', error);

    // Return an error response
    return res.status(500).json({
      message: 'An error occurred while creating the product',
      error: error.message,
    });
  }
});


// Fetch all machines for the dropdown
router.get('/nommachine', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT nom_machine FROM declaration');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching machines:', error.message);
    return res.status(500).json({ message: 'Error fetching machines' });
  }
});

// Fetch references for a selected machine
router.get('/get/references/:nom_machine', async (req, res) => {
  const { nom_machine } = req.params;
  try {
    const result = await pool.query(
      'SELECT DISTINCT reference FROM declaration WHERE nom_machine = $1',
      [nom_machine]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching references:', error.message);
    return res.status(500).json({ message: 'Error fetching references' });
  }
});

// Fetch tools for a selected reference
router.get('/get/tools/:reference/:nom_machine', async (req, res) => {
  const { reference, nom_machine } = req.params;

  try {
    // Fetch all tools and dureedeviepointeur across all references
    const allTools = await pool.query(
      'SELECT DISTINCT outil, dureedeviepointeur FROM declaration WHERE dureedeviepointeur IS NOT NULL'
    );

    // Create a map where the key is 'outil' and the value is 'dureedeviepointeur'
    const toolDureeMap = new Map();
    allTools.rows.forEach(row => {
      if (row.outil && row.dureedeviepointeur !== null) {
        toolDureeMap.set(row.outil, row.dureedeviepointeur);
      }
    });

    // Fetch tools for the selected reference
    const result = await pool.query(
      'SELECT DISTINCT outil FROM declaration WHERE reference = $1 AND nom_machine = $2',
      [reference, nom_machine ]
    );

    // Assign the global dureedeviepointeur for each outil
    const tools = result.rows.map(row => {
      const dureedeviepointeur = toolDureeMap.get(row.outil) || null;
      return {
        outil: row.outil,
        dureedeviepointeur // Use dureedeviepointeur instead of dureedevie
      };
    });

    return res.json(tools);
  } catch (error) {
    console.error('Error fetching tools:', error.message);
    return res.status(500).json({ message: 'Error fetching tools' });
  }
});



router.put('/update/reference', async (req, res) => {
  const { nom_machine, new_reference, old_reference } = req.body;

  try {
    await pool.query('BEGIN'); // Start transaction

    // 1️⃣ Remove tools from the old reference that are not in the new reference
    await pool.query(
      `DELETE FROM declaration
       WHERE nom_machine = $1
         AND reference = $2
         AND outil NOT IN (
           SELECT outil FROM declaration WHERE nom_machine = $1 AND reference = $3
         )`,
      [nom_machine, old_reference, new_reference]
    );

    // 2️⃣ Remove duplicate tools from the old reference (keep only the tool in the new reference)
    await pool.query(
      `DELETE FROM declaration a
       USING declaration b
       WHERE a.nom_machine = b.nom_machine
         AND a.reference = $2
         AND a.outil = b.outil
         AND a.ctid > b.ctid
         AND b.nom_machine = $1
         AND b.reference = $3`,
      [nom_machine, old_reference, new_reference]
    );

    // 3️⃣ Transfer `dureedeviepointeur` from old reference to new reference for common tools
    await pool.query(
      `UPDATE declaration d
       SET dureedeviepointeur = old.dureedeviepointeur
       FROM declaration old
       WHERE d.nom_machine = $1
         AND d.reference = $2
         AND d.outil = old.outil
         AND old.nom_machine = $1
         AND old.reference = $3`,
      [nom_machine, new_reference, old_reference]
    );

    // 4️⃣ Remove the old reference entirely after all updates
    await pool.query(
      `DELETE FROM declaration
       WHERE nom_machine = $1
         AND reference = $2`,
      [nom_machine, old_reference]
    );

    await pool.query('COMMIT'); // Commit transaction

    return res.json({
      message: 'Reference updated successfully: tools aligned, duplicates removed, and old reference deleted.',
    });
  } catch (error) {
    await pool.query('ROLLBACK'); // Rollback on error
    console.error('Error updating reference:', error.message);
    return res.status(500).json({ message: 'Error updating reference', error: error.message });
  }
});


router.get('/toolss', authenticate, async (req, res) => {
  try {
    const tools = await pool.query('SELECT nom_outil, phase, dureedevie FROM outil');
    res.status(200).json(tools.rows);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ message: 'Failed to fetch tools' });
  }
});
router.put('/updateDeclaration', async (req, res) => {
  const { nom_machine, old_reference, new_reference, tools } = req.body;

  try {
    await pool.query('BEGIN');
    console.log("🔍 Transaction started");

    

    // 1️⃣ Fetch latest dureedeviepointeur and dureedevie for each tool from the old reference
    const toolData = await pool.query(
      `SELECT outil, MAX(dureedeviepointeur) AS dureedeviepointeur, MAX(dureedevie) AS dureedevie, MAX(phase) AS phase
       FROM declaration
       WHERE nom_machine = $1 AND reference = $2 AND outil = ANY($3)
       GROUP BY outil`,
      [nom_machine, old_reference, tools]
    );

    const oldToolDataMap = new Map(
      toolData.rows.map(({ outil, dureedeviepointeur, dureedevie, phase }) => 
        [outil, { dureedeviepointeur, dureedevie, phase }]
      )
    );

    // 2️⃣ Fetch new dureedevie from `outil` table for the new reference
    const newToolData = await pool.query(
      `SELECT nom_outil, dureedevie FROM outil WHERE referenceproduit = $1 AND nom_outil = ANY($2)  AND nom_machine = $3`,
      [new_reference, tools, nom_machine]
    );

    const newToolDataMap = new Map(newToolData.rows.map(({ nom_outil, dureedevie }) => [nom_outil, dureedevie]));

// Remove tools that exist in the old reference but NOT in the new reference
await pool.query(
  `DELETE FROM declaration 
   WHERE nom_machine = $1 
   AND reference = $2 
   AND outil NOT IN (SELECT unnest($3::text[]))`,
  [nom_machine, old_reference, tools]
);
console.log("🔴 Removed tools from the old reference that are not in the new reference.");

// Remove tools that exist in the old reference but do NOT exist in the new reference
await pool.query(
  `DELETE FROM declaration 
   WHERE nom_machine = $1 
   AND reference = $2 
   AND outil NOT IN (SELECT outil FROM declaration WHERE reference = $3)`,
  [nom_machine, old_reference, new_reference]
);
console.log("🔴 Removed tools from the old reference that do not exist in the new reference.");

    

    console.log("🔴 Removed tools from the old reference that are not in the new reference.");

    // 4️⃣ Insert new reference with updated dureedeviepointeur and dureedevie
    for (const tool of tools) {
      const { dureedeviepointeur: oldDVP, dureedevie: oldDDV, phase } = oldToolDataMap.get(tool) || {};
      const newDDV = newToolDataMap.get(tool) || null;

      // Maintain the highest dureedeviepointeur from both old and new
      const finalDureedeviepointeur = oldDVP ?? newDDV;
      const finalDureedevie = oldDDV ?? newDDV;

      // Check if tool exists in the table already
      const existingToolCheck = await pool.query(
        `SELECT dureedeviepointeur, dureedevie FROM declaration WHERE nom_machine = $1 AND reference = $2 AND outil = $3`,
        [nom_machine, new_reference, tool]
      );

      if (existingToolCheck.rows.length > 0) {
        // If the tool exists, update both dureedeviepointeur and dureedevie
        await pool.query(
          `UPDATE declaration 
           SET dureedeviepointeur = $4, dureedevie = $5, phase = $6
           WHERE nom_machine = $1 AND reference = $2 AND outil = $3`,
          [nom_machine, new_reference, tool, finalDureedeviepointeur, finalDureedevie, phase]
        );
        console.log(`✅ Updated tool: ${tool} with dureedeviepointeur: ${finalDureedeviepointeur}, dureedevie: ${finalDureedevie}`);
      } else {
        // Insert a new record using dureedevie from the `outil` table
        await pool.query(
          `INSERT INTO declaration (nom_machine, reference, outil, dureedeviepointeur, dureedevie, phase)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [nom_machine, new_reference, tool, finalDureedeviepointeur, finalDureedevie, phase]
        );
        console.log(`✅ Inserted new tool: ${tool} with dureedeviepointeur: ${finalDureedeviepointeur}, dureedevie: ${finalDureedevie}`);
      }
    }

    await pool.query('COMMIT');
    console.log("✅ Transaction committed successfully.");
    return res.json({ message: 'Declaration updated successfully' });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error updating declaration:', error.message);
    return res.status(500).json({ message: 'Error updating declaration', error: error.message });
  }
});


router.post('/ajouterdeclaration', authenticate, async (req, res) => {
  const { nom_machine, reference, outil, dureedevie, phase } = req.body;

  try {
    // Execute the query, setting dureedeviepointeur to dureedevie
    const result = await pool.query(
      'INSERT INTO declaration (nom_machine, reference, outil, dureedeviepointeur, dureedevie, phase) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nom_machine, reference, outil, dureedevie, dureedevie, phase] // dureedeviepointeur is set to dureedevie
    );

    // Debugging: Log the query result
    console.log('Query result:', result.rows);

    // Ensure rows exist before returning success
    if (!result.rows.length) {
      return res.status(500).json({ success: false, message: 'Outil was not inserted into the database' });
    }

    // Return success response with the inserted row
    return res.status(201).json({
      success: true,
      message: 'Outil created successfully',
      data: result.rows[0], // Return inserted record
    });

  } catch (error) {
    console.error('Error creating outil:', error.message);
    
    // Return a meaningful error response
    return res.status(500).json({
      success: false,
      message: 'An error occurred while inserting the outil',
      error: error.message,
    });
  }
});

router.delete('/plannification/delete-last', authenticate, async (req, res) => {
  try {
    // Log request params and query to debug unexpected values
    console.log("Params:", req.params);
    console.log("Query:", req.query);

    // Ensure no unexpected parameters are interfering with the request
    if (Object.keys(req.query).length > 0 || Object.keys(req.params).length > 0) {
      return res.status(400).json({ message: "Invalid parameters in request" });
    }

    // Delete the last row in the plannification table
    const result = await pool.query(`
      DELETE FROM plannification 
      WHERE id = (SELECT id FROM plannification ORDER BY date_creation DESC LIMIT 1) 
      RETURNING *;
    `);

    if (result.rowCount > 0) {
      res.status(200).json({ message: 'Last row deleted successfully', deletedRow: result.rows[0] });
    } else {
      res.status(404).json({ message: 'No rows found to delete' });
    }
  } catch (err) {
    console.error('Error deleting last row:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/get/toolss/:reference/:nom_machine', async (req, res) => {
  const { reference, nom_machine } = req.params;

  try {
    // Fetch tools and dureedevie for the given reference and machine
    const result = await pool.query(
      `SELECT DISTINCT nom_outil, dureedevie 
       FROM outil 
       WHERE referenceproduit = $1 AND nom_machine = $2`,
      [reference, nom_machine]
    );

    // Return the fetched data as JSON
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tools:', error.message);
    return res.status(500).json({ message: 'Error fetching tools' });
  }
});


module.exports = router;
