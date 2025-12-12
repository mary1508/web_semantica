const express = require('express');
const router = express.Router();
const DirectMapper = require('../services/directMapper');
const db = require('../config/database');

// Generar Direct Mapping
router.post('/direct', async (req, res) => {
  try {
    const { baseNamespace } = req.body;
    const startTime = Date.now();
    
    // Obtener esquema
    const schema = await db.getDatabaseSchema();
    
    // Crear mapper
    const mapper = new DirectMapper(baseNamespace || process.env.BASE_NAMESPACE);
    
    // Ejecutar mapeo
    const rdf = await mapper.executeDirectMapping(schema);
    
    // Calcularstadísticas
    const stats = await mapper.generateStatistics(schema);
    const endTime = Date.now();
    
    res.json({
      success: true,
      rdf: rdf,
      stats: {
        totalTriples: rdf.split('\n').filter(line => line.trim().endsWith('.')).length,
        tablesProcessed: schema.totalTables,
        processingTime: `${((endTime - startTime) / 1000).toFixed(2)} segundos`
      }
    });
    
  } catch (error) {
    console.error('Error en Direct Mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;