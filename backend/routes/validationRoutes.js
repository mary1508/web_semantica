const express = require('express');
const router = express.Router();
const RDFValidator = require('../services/rdfValidator');
const db = require('../config/database');

/**
 * POST /api/validation/rdf
 * Validar datos RDF generados
 */
router.post('/rdf', async (req, res) => {
  try {
    const { rdf, mappingConfig, includeSchemaValidation } = req.body;
    
    if (!rdf) {
      return res.status(400).json({
        success: false,
        error: 'RDF content es requerido'
      });
    }
    
    const validator = new RDFValidator();
    let schema = null;
    
    // Obtener esquema si se solicita validación contra BD
    if (includeSchemaValidation) {
      try {
        schema = await db.getDatabaseSchema();
      } catch (error) {
        console.warn('No se pudo obtener esquema de BD:', error.message);
      }
    }
    
    const result = await validator.validateRDF(rdf, mappingConfig, schema);
    
    res.json({
      success: true,
      validation: result
    });
    
  } catch (error) {
    console.error('Error en validación:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/validation/quick
 * Validación rápida (solo sintaxis y estructura básica)
 */
router.post('/quick', async (req, res) => {
  try {
    const { rdf } = req.body;
    
    if (!rdf) {
      return res.status(400).json({
        success: false,
        error: 'RDF content es requerido'
      });
    }
    
    const validator = new RDFValidator();
    
    // Solo validar sintaxis y estructura
    const store = await validator.validateSyntax(rdf);
    await validator.analyzeTriples(store);
    
    res.json({
      success: true,
      validation: {
        valid: validator.validationResults.errors.length === 0,
        results: validator.validationResults,
        score: validator.calculateQualityScore()
      }
    });
    
  } catch (error) {
    console.error('Error en validación rápida:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/validation/completeness
 * Verificar completitud de datos contra BD
 */
router.post('/completeness', async (req, res) => {
  try {
    const { rdf } = req.body;
    
    if (!rdf) {
      return res.status(400).json({
        success: false,
        error: 'RDF content es requerido'
      });
    }
    
    const validator = new RDFValidator();
    const schema = await db.getDatabaseSchema();
    const store = await validator.validateSyntax(rdf);
    
    await validator.validateAgainstSchema(store, schema, null);
    
    res.json({
      success: true,
      completeness: validator.validationResults.metrics.completeness,
      metrics: validator.validationResults.metrics
    });
    
  } catch (error) {
    console.error('Error verificando completitud:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;