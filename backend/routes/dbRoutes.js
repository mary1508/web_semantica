const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Conectar a la base de datos
router.post('/connect', async (req, res) => {
  try {
    const connected = await db.testConnection();
    if (connected) {
      const schema = await db.getDatabaseSchema();
      res.json({
        success: true,
        message: 'Conexión exitosa',
        database: schema.database,
        totalTables: schema.totalTables
      });
    } else {
      res.status(500).json({ error: 'No se pudo conectar' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener esquema
router.get('/schema', async (req, res) => {
  try {
    const schema = await db.getDatabaseSchema();
    res.json(schema);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;