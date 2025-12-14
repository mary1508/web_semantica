const axios = require('axios');
const { Parser } = require('n3');

/**
 * Servicio de publicación en endpoints SPARQL
 */
class SPARQLPublisher {
  constructor(config = {}) {
    this.fusekiUrl = config.fusekiUrl || process.env.FUSEKI_URL || 'http://localhost:3030';
    this.dataset = config.dataset || process.env.FUSEKI_DATASET || 'dataset';
    this.username = config.username || process.env.FUSEKI_USERNAME;
    this.password = config.password || process.env.FUSEKI_PASSWORD;
    this.timeout = config.timeout || 30000; // 30 segundos
  }

  /**
   * Verificar si Fuseki está disponible
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.fusekiUrl}/$/ping`, {
        timeout: 5000
      });
      return {
        available: true,
        status: 'OK',
        message: 'Fuseki está disponible'
      };
    } catch (error) {
      return {
        available: false,
        status: 'ERROR',
        message: error.code === 'ECONNREFUSED' 
          ? 'No se puede conectar con Fuseki. Asegúrate de que esté ejecutándose.'
          : `Error de conexión: ${error.message}`
      };
    }
  }

  /**
   * Listar datasets disponibles
   */
  async listDatasets() {
    try {
      const response = await axios.get(`${this.fusekiUrl}/$/datasets`, {
        timeout: 5000,
        auth: this.username ? {
          username: this.username,
          password: this.password
        } : undefined
      });

      // Fuseki devuelve formato JSON con lista de datasets
      const datasets = response.data.datasets || [];
      return {
        success: true,
        datasets: datasets.map(ds => ({
          name: ds['ds.name'],
          services: ds['ds.services'] || []
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        datasets: []
      };
    }
  }

  /**
   * Crear un nuevo dataset
   */
  async createDataset(datasetName, type = 'mem') {
    try {
      const response = await axios.post(
        `${this.fusekiUrl}/$/datasets`,
        {
          dbName: datasetName,
          dbType: type // 'mem' (en memoria) o 'tdb2' (persistente)
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          auth: this.username ? {
            username: this.username,
            password: this.password
          } : undefined,
          timeout: this.timeout
        }
      );

      return {
        success: true,
        message: `Dataset '${datasetName}' creado exitosamente`,
        dataset: datasetName
      };
    } catch (error) {
      if (error.response?.status === 409) {
        return {
          success: false,
          error: `El dataset '${datasetName}' ya existe`
        };
      }
      return {
        success: false,
        error: `Error creando dataset: ${error.message}`
      };
    }
  }

  /**
   * Verificar si un dataset existe
   */
  async datasetExists(datasetName) {
    const result = await this.listDatasets();
    if (!result.success) return false;
    
    return result.datasets.some(ds => ds.name === `/${datasetName}`);
  }

  /**
   * Contar triples en un dataset
   */
  async countTriples(datasetName) {
    try {
      const query = 'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }';
      const response = await axios.post(
        `${this.fusekiUrl}/${datasetName}/query`,
        `query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/sparql-results+json'
          },
          auth: this.username ? {
            username: this.username,
            password: this.password
          } : undefined,
          timeout: this.timeout
        }
      );

      const count = parseInt(response.data.results.bindings[0].count.value);
      return {
        success: true,
        count: count
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Limpiar todos los datos de un dataset
   */
  async clearDataset(datasetName, graph = 'default') {
    try {
      const graphUri = graph === 'default' ? 'default' : graph;
      const updateQuery = graphUri === 'default' 
        ? 'CLEAR DEFAULT'
        : `CLEAR GRAPH <${graphUri}>`;

      const response = await axios.post(
        `${this.fusekiUrl}/${datasetName}/update`,
        `update=${encodeURIComponent(updateQuery)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: this.username ? {
            username: this.username,
            password: this.password
          } : undefined,
          timeout: this.timeout
        }
      );

      return {
        success: true,
        message: `Dataset '${datasetName}' limpiado`
      };
    } catch (error) {
      return {
        success: false,
        error: `Error limpiando dataset: ${error.message}`
      };
    }
  }

  /**
   * Publicar datos RDF en Fuseki
   */
  async publish(rdfContent, options = {}) {
    const {
      datasetName = this.dataset,
      graph = 'default',
      clearBefore = false,
      createIfNotExists = true
    } = options;

    const results = {
      steps: [],
      success: false,
      endpoint: null,
      triplesPublished: 0
    };

    try {
      // 1. Verificar salud de Fuseki
      results.steps.push({ step: 'health_check', status: 'running' });
      const health = await this.checkHealth();
      
      if (!health.available) {
        results.steps[0].status = 'failed';
        results.steps[0].error = health.message;
        throw new Error(health.message);
      }
      results.steps[0].status = 'completed';

      // 2. Verificar/crear dataset
      results.steps.push({ step: 'dataset_check', status: 'running' });
      const exists = await this.datasetExists(datasetName);
      
      if (!exists && createIfNotExists) {
        const created = await this.createDataset(datasetName);
        if (!created.success) {
          results.steps[1].status = 'failed';
          results.steps[1].error = created.error;
          throw new Error(created.error);
        }
        results.steps[1].message = 'Dataset creado';
      } else if (!exists) {
        results.steps[1].status = 'failed';
        results.steps[1].error = `Dataset '${datasetName}' no existe`;
        throw new Error(`Dataset '${datasetName}' no existe`);
      }
      results.steps[1].status = 'completed';

      // 3. Limpiar dataset si se solicita
      if (clearBefore) {
        results.steps.push({ step: 'clear_dataset', status: 'running' });
        const cleared = await this.clearDataset(datasetName, graph);
        if (!cleared.success) {
          results.steps[2].status = 'warning';
          results.steps[2].error = cleared.error;
        } else {
          results.steps[2].status = 'completed';
        }
      }

      // 4. Contar triples a publicar
      results.steps.push({ step: 'count_triples', status: 'running' });
      const tripleCount = this.countTriplesInRDF(rdfContent);
      results.triplesPublished = tripleCount;
      results.steps[results.steps.length - 1].status = 'completed';
      results.steps[results.steps.length - 1].count = tripleCount;

      // 5. Publicar datos
      results.steps.push({ step: 'upload_data', status: 'running' });
      
      const graphParam = graph === 'default' ? 'default' : graph;
      const uploadUrl = graphParam === 'default'
        ? `${this.fusekiUrl}/${datasetName}/data`
        : `${this.fusekiUrl}/${datasetName}/data?graph=${encodeURIComponent(graphParam)}`;

      const response = await axios.post(
        uploadUrl,
        rdfContent,
        {
          headers: {
            'Content-Type': 'text/turtle'
          },
          auth: this.username ? {
            username: this.username,
            password: this.password
          } : undefined,
          timeout: this.timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      results.steps[results.steps.length - 1].status = 'completed';

      // 6. Verificar publicación
      results.steps.push({ step: 'verify_upload', status: 'running' });
      const countResult = await this.countTriples(datasetName);
      
      if (countResult.success) {
        results.steps[results.steps.length - 1].status = 'completed';
        results.steps[results.steps.length - 1].finalCount = countResult.count;
      } else {
        results.steps[results.steps.length - 1].status = 'warning';
        results.steps[results.steps.length - 1].error = 'No se pudo verificar la carga';
      }

      // Éxito
      results.success = true;
      results.endpoint = `${this.fusekiUrl}/${datasetName}/query`;
      results.sparqlEndpoint = `${this.fusekiUrl}/${datasetName}/sparql`;
      results.datasetUrl = `${this.fusekiUrl}/#/dataset/${datasetName}`;

      return results;

    } catch (error) {
      results.error = error.message;
      return results;
    }
  }

  /**
   * Contar triples en contenido RDF
   */
  countTriplesInRDF(rdfContent) {
    try {
      const parser = new Parser();
      const quads = parser.parse(rdfContent);
      return quads.length;
    } catch (error) {
      // Estimación básica si falla el parser
      return rdfContent.split('\n').filter(line => line.trim().endsWith('.')).length;
    }
  }

  /**
   * Ejecutar consulta SPARQL
   */
  async query(sparqlQuery, datasetName = this.dataset, format = 'json') {
    try {
      const acceptHeader = format === 'json' 
        ? 'application/sparql-results+json'
        : 'text/turtle';

      const response = await axios.post(
        `${this.fusekiUrl}/${datasetName}/query`,
        `query=${encodeURIComponent(sparqlQuery)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': acceptHeader
          },
          auth: this.username ? {
            username: this.username,
            password: this.password
          } : undefined,
          timeout: this.timeout
        }
      );

      return {
        success: true,
        results: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener estadísticas del dataset
   */
  async getDatasetStats(datasetName = this.dataset) {
    try {
      const queries = {
        totalTriples: 'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }',
        totalSubjects: 'SELECT (COUNT(DISTINCT ?s) as ?count) WHERE { ?s ?p ?o }',
        totalPredicates: 'SELECT (COUNT(DISTINCT ?p) as ?count) WHERE { ?s ?p ?o }',
        classes: 'SELECT ?class (COUNT(?s) as ?count) WHERE { ?s a ?class } GROUP BY ?class ORDER BY DESC(?count)',
        properties: 'SELECT ?p (COUNT(*) as ?count) WHERE { ?s ?p ?o } GROUP BY ?p ORDER BY DESC(?count) LIMIT 20'
      };

      const stats = {};

      // Obtener conteos básicos
      for (const [key, query] of Object.entries(queries)) {
        if (key !== 'classes' && key !== 'properties') {
          const result = await this.query(query, datasetName);
          if (result.success) {
            stats[key] = parseInt(result.results.results.bindings[0].count.value);
          }
        }
      }

      // Obtener clases
      const classesResult = await this.query(queries.classes, datasetName);
      if (classesResult.success) {
        stats.classes = classesResult.results.results.bindings.map(b => ({
          class: b.class.value,
          count: parseInt(b.count.value)
        }));
      }

      // Obtener propiedades
      const propsResult = await this.query(queries.properties, datasetName);
      if (propsResult.success) {
        stats.topProperties = propsResult.results.results.bindings.map(b => ({
          property: b.p.value,
          count: parseInt(b.count.value)
        }));
      }

      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SPARQLPublisher;