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
    referenceproduit, date, shift, phase, totalplanifie,
    commentaires, totalrealise, machine_id, defaut, typedefautproduction,
    totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction,
    dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl
  } = req.body;

  try {
   
 

    // Step 3: Insert production record, including totalplanifie
    const productionResult = await pool.query(
      `INSERT INTO production (referenceproduit, date, shift, phase, totalplanifie, commentaires, totalrealise, machine_id, defaut, typedefautproduction, totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction, dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING *`,
      [referenceproduit, date, shift, phase, totalplanifie, commentaires, totalrealise, machine_id, defaut, typedefautproduction, totaldefautproduction, typedefautcf, totaldefautcf, typedefautcsl, totaldefautcsl, typedeproblemeproduction, dureedeproblemeproduction, typedeproblemecf, dureedeproblemecf, typedeproblemecsl, dureedeproblemecsl, totalproduitcf, totalproduitcsl]
    );

    const production = productionResult.rows[0];
    // Step 2: Retrieve the current dureedeviepointeur based on outil_id
    const outilResult = await pool.query(
      `SELECT * FROM outil `
    );
  

    if (outilResult.rows.length === 0) {
      return res.status(404).json({ message: 'No matching outil found for the provided id' });
    }

  // Prepare an array of promises to update all outils
const updatePromises = outilResult.rows.map(async (outil) => {
  const currentDureeDeviePointeur = outil.dureedeviepointeur;
  const updatedDureeDeviePointeur = Math.max(0, currentDureeDeviePointeur - totalrealise);  // Assuming `totalrealise` is the same for all rows

  console.log('Current DureeDeviePointeur:', currentDureeDeviePointeur);
  console.log('Updated DureeDeviePointeur:', updatedDureeDeviePointeur);

  // Update each outil
  return pool.query(
    `UPDATE outil 
     SET dureedeviepointeur = $1 
     WHERE id = $2 
     RETURNING *`,
    [updatedDureeDeviePointeur, outil.id]
  );
});

// Wait for all the update operations to finish
const updatedOutils = await Promise.all(updatePromises);




    res.status(201).json({
      message: 'Production created successfully with the totalplanifie value',
      production,
      updatedOutil: updatedOutils
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
    // Log input values for debugging
    console.log('Received data:', {
      nom, referenceproduit, date, userId, cadence_horaire, 
      nombre_operateur_chargement, cadence_horaire_cf, cadence_horaire_csl, 
      nombre_operateur_cf, nombre_operateur_csl, tools
    });

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

    console.log('Machine inserted, generated ID:', machineId); // Debugging line

     if (tools.length > 0) {
      // Insert each tool into the 'outil' table
      for (const tool of tools) {
        console.log('Inserting tool:', tool); // Debugging line
        const dureedeviepointeur = tool.dureedeviepointeur ?? tool.dureedevie;
        await pool.query(
          'INSERT INTO outil (phase, nom_outil, dureedevie, machine_id, referenceproduit, dureedeviepointeur) VALUES ($1, $2, $3, $4, $5, $6)',
          [tool.phase, tool.nom_outil, tool.dureedevie, machineId, tool.referenceproduit, dureedeviepointeur] // Use machineId instead of id
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
  const { phase, shift, date_creation, id_machine } = req.query;

  try {
    const result = await pool.query(
      'SELECT * FROM plannification WHERE phase = $1 AND shift = $2 AND date_creation = $3 AND id_machine = $4 ',
      [phase, shift, date_creation, id_machine]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching plannifications:', err);
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
    const result = await pool.query('SELECT * FROM outil');

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

router.get('/tools', authenticate, async (req, res) => {
  try {
    const tools = await pool.query('SELECT id, nom_outil, dureedevie FROM outil');
    res.status(200).json(tools.rows);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ message: 'Failed to fetch tools' });
  }
});
router.put('/resetdureedevie/:id', async (req, res) => {
  const { id } = req.params; // Extract the outil ID from the request parameters

  try {
    // Fetch the dureedevie from the specified outil
    const outildureedevie = await pool.query('SELECT dureedevie FROM outil WHERE id = $1', [id]);

    // Check if the outil exists and retrieve the dureedevie
    if (outildureedevie.rows.length === 0) {
      return res.status(404).json({ message: `No outil found with id: ${id}` });
    }

    const dureedevie = outildureedevie.rows[0].dureedevie; // Access the 'dureedevie' field
    console.log('Dureedevie:', dureedevie); // Optional debugging line

    // Update the dureedeviepointeur column with the value of dureedevie
    const result = await pool.query(
      'UPDATE outil SET dureedeviepointeur = $1 WHERE id = $2 RETURNING *',
      [dureedevie, id]
    );

    // Check if the outil was updated
    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'Outil not found or could not be updated',
      });
    }

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





module.exports = router;
