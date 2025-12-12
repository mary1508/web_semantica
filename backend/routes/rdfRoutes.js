const express = require('express');
const router = express.Router();
const { Parser, Writer } = require('n3');
const axios = require('axios');

// Convertir a otros formatos
router.post('/convert', async (req, res) => {
  try {
    const { rdf, format } = req.body;
    

    res.json({
      success: true,
      converted: rdf,
      format: format
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pa publicar en Fuseki
router.post('/publish', async (req, res) => {
  try {
    const { rdf } = req.body;
    const fusekiUrl = process.env.FUSEKI_URL || 'http://localhost:3030';
    const dataset = process.env.FUSEKI_DATASET || 'dataset';
    
    
    const response = await axios.post(
      `${fusekiUrl}/${dataset}/data`,
      rdf,
      {
        headers: {
          'Content-Type': 'text/turtle'
        }
      }
    );
    
    const triplesCount = rdf.split('\n').filter(line => line.trim().endsWith('.')).length;
    
    res.json({
      success: true,
      endpoint: `${fusekiUrl}/${dataset}/query`,
      triplesLoaded: triplesCount,
      message: 'Datos publicados exitosamente'
    });
    
  } catch (error) {
    console.error('Error publicando en Fuseki:', error.message);
    res.status(500).json({ 
      error: 'No se pudo conectar con Fuseki. Asegúrate de que esté ejecutándose.',
      details: error.message 
    });
  }
});

module.exports = router;