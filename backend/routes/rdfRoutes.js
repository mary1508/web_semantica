const express = require('express');
const router = express.Router();
const { Parser, Writer } = require('n3');
const SPARQLPublisher = require('../services/sparqlPublisher');

/**
 * GET /api/rdf/fuseki/health
 * Verificar estado de Fuseki
 */
router.get('/fuseki/health', async (req, res) => {
  try {
    const publisher = new SPARQLPublisher();
    const health = await publisher.checkHealth();
    
    res.json({
      success: true,
      health: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rdf/fuseki/datasets
 * Listar datasets disponibles
 */
router.get('/fuseki/datasets', async (req, res) => {
  try {
    const publisher = new SPARQLPublisher();
    const result = await publisher.listDatasets();
    
    res.json({
      success: result.success,
      datasets: result.datasets,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rdf/fuseki/dataset
 * Crear nuevo dataset
 */
router.post('/fuseki/dataset', async (req, res) => {
  try {
    const { name, type } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del dataset es requerido'
      });
    }
    
    const publisher = new SPARQLPublisher();
    const result = await publisher.createDataset(name, type || 'mem');
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/rdf/fuseki/dataset/:name
 * Limpiar dataset
 */
router.delete('/fuseki/dataset/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const publisher = new SPARQLPublisher();
    const result = await publisher.clearDataset(name);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rdf/fuseki/stats/:dataset
 * Obtener estadísticas de un dataset
 */
router.get('/fuseki/stats/:dataset', async (req, res) => {
  try {
    const { dataset } = req.params;
    const publisher = new SPARQLPublisher();
    const result = await publisher.getDatasetStats(dataset);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rdf/publish
 * Publicar RDF en Fuseki (endpoint mejorado)
 */
router.post('/publish', async (req, res) => {
  try {
    const { 
      rdf, 
      dataset, 
      graph, 
      clearBefore,
      createIfNotExists,
      fusekiUrl,
      username,
      password
    } = req.body;
    
    if (!rdf) {
      return res.status(400).json({
        success: false,
        error: 'El contenido RDF es requerido'
      });
    }
    
    // Crear publisher con configuración personalizada si se proporciona
    const config = {};
    if (fusekiUrl) config.fusekiUrl = fusekiUrl;
    if (dataset) config.dataset = dataset;
    if (username) config.username = username;
    if (password) config.password = password;
    
    const publisher = new SPARQLPublisher(config);
    
    const result = await publisher.publish(rdf, {
      datasetName: dataset,
      graph: graph || 'default',
      clearBefore: clearBefore || false,
      createIfNotExists: createIfNotExists !== false // true por defecto
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Datos publicados exitosamente',
        endpoint: result.endpoint,
        sparqlEndpoint: result.sparqlEndpoint,
        datasetUrl: result.datasetUrl,
        triplesPublished: result.triplesPublished,
        steps: result.steps
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        steps: result.steps
      });
    }
    
  } catch (error) {
    console.error('Error publicando en Fuseki:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rdf/query
 * Ejecutar consulta SPARQL
 */
router.post('/query', async (req, res) => {
  try {
    const { query, dataset, format } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'La consulta SPARQL es requerida'
      });
    }
    
    const publisher = new SPARQLPublisher({ dataset });
    const result = await publisher.query(query, dataset, format || 'json');
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rdf/convert
 * Convertir RDF a otros formatos
 */
router.post('/convert', async (req, res) => {
  try {
    const { rdf, format } = req.body;
    
    if (!rdf) {
      return res.status(400).json({
        success: false,
        error: 'El contenido RDF es requerido'
      });
    }
    
    // Parsear el RDF de entrada
    const parser = new Parser();
    const quads = parser.parse(rdf);
    
    // Configurar writer según el formato solicitado
    let contentType = 'text/turtle';
    let writerFormat = 'turtle';
    
    switch (format) {
      case 'ntriples':
      case 'nt':
        writerFormat = 'N-Triples';
        contentType = 'application/n-triples';
        break;
      case 'nquads':
      case 'nq':
        writerFormat = 'N-Quads';
        contentType = 'application/n-quads';
        break;
      case 'trig':
        writerFormat = 'TriG';
        contentType = 'application/trig';
        break;
      case 'turtle':
      case 'ttl':
      default:
        writerFormat = 'Turtle';
        contentType = 'text/turtle';
    }
    
    // Convertir
    const writer = new Writer({ format: writerFormat });
    writer.addQuads(quads);
    
    writer.end((error, result) => {
      if (error) {
        return res.status(500).json({
          success: false,
          error: `Error convirtiendo: ${error.message}`
        });
      }
      
      res.json({
        success: true,
        converted: result,
        format: format,
        contentType: contentType,
        tripleCount: quads.length
      });
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;