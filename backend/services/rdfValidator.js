const { Parser, Store } = require('n3');
const db = require('../config/database');

/**
 * Validador de calidad de datos RDF enlazados
 */
class RDFValidator {
  constructor() {
    this.validationResults = {
      passed: [],
      warnings: [],
      errors: [],
      metrics: {}
    };
  }

  /**
   * Ejecutar validación completa de RDF generado
   */
  async validateRDF(rdfContent, mappingConfig = null, schema = null) {
    this.reset();
    const startTime = Date.now();

    try {
      // 1. Validar sintaxis RDF
      const store = await this.validateSyntax(rdfContent);
      
      // 2. Analizar estructura de triples
      await this.analyzeTriples(store);
      
      // 3. Validar URIs
      await this.validateURIs(store);
      
      // 4. Validar integridad referencial
      await this.validateReferentialIntegrity(store);
      
      // 5. Validar tipos de datos
      await this.validateDatatypes(store);
      
      // 6. Detectar inconsistencias
      await this.detectInconsistencies(store);
      
      // 7. Validar contra esquema de BD (si está disponible)
      if (schema && mappingConfig) {
        await this.validateAgainstSchema(store, schema, mappingConfig);
      }
      
      // 8. Calcular métricas de calidad
      this.calculateQualityMetrics(store);
      
      const endTime = Date.now();
      this.validationResults.metrics.validationTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;
      
      return {
        valid: this.validationResults.errors.length === 0,
        results: this.validationResults,
        score: this.calculateQualityScore()
      };
      
    } catch (error) {
      this.addError('SYNTAX_ERROR', `Error de validación: ${error.message}`);
      return {
        valid: false,
        results: this.validationResults,
        score: 0
      };
    }
  }

  /**
   * Validar sintaxis RDF
   */
  async validateSyntax(rdfContent) {
    return new Promise((resolve, reject) => {
      const parser = new Parser();
      const store = new Store();
      
      try {
        const quads = parser.parse(rdfContent);
        store.addQuads(quads);
        
        this.addPassed('SYNTAX', `Sintaxis RDF válida: ${quads.length} triples parseados`);
        resolve(store);
      } catch (error) {
        this.addError('SYNTAX', `Error de sintaxis: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Analizar estructura de triples
   */
  async analyzeTriples(store) {
    const quads = store.getQuads();
    const subjects = new Set();
    const predicates = new Set();
    const objects = new Set();
    
    quads.forEach(quad => {
      subjects.add(quad.subject.value);
      predicates.add(quad.predicate.value);
      if (quad.object.termType === 'NamedNode') {
        objects.add(quad.object.value);
      }
    });
    
    this.validationResults.metrics.totalTriples = quads.length;
    this.validationResults.metrics.uniqueSubjects = subjects.size;
    this.validationResults.metrics.uniquePredicates = predicates.size;
    this.validationResults.metrics.uniqueObjects = objects.size;
    
    // Validar que hay datos
    if (quads.length === 0) {
      this.addError('NO_DATA', 'No se encontraron triples RDF');
      return;
    }
    
    // Validar proporción sujetos/triples (detectar datos muy repetitivos)
    const ratio = subjects.size / quads.length;
    if (ratio < 0.1) {
      this.addWarning('LOW_DIVERSITY', 
        `Baja diversidad de sujetos (${(ratio * 100).toFixed(1)}%). Posibles datos duplicados.`);
    }
    
    this.addPassed('STRUCTURE', `Estructura analizada: ${subjects.size} recursos únicos`);
  }

  /**
   * Validar URIs
   */
  async validateURIs(store) {
    const quads = store.getQuads();
    const invalidURIs = [];
    const suspiciousURIs = [];
    const uriPattern = /^https?:\/\/.+/;
    
    quads.forEach(quad => {
      // Validar URIs de sujetos
      if (quad.subject.termType === 'NamedNode') {
        const uri = quad.subject.value;
        if (!uriPattern.test(uri)) {
          invalidURIs.push(uri);
        }
        // Detectar URIs sospechosas (espacios, caracteres especiales sin encoding)
        if (uri.includes(' ') || /[<>{}|\\^`]/.test(uri)) {
          suspiciousURIs.push(uri);
        }
      }
      
      // Validar URIs de objetos
      if (quad.object.termType === 'NamedNode') {
        const uri = quad.object.value;
        if (!uriPattern.test(uri)) {
          invalidURIs.push(uri);
        }
        if (uri.includes(' ') || /[<>{}|\\^`]/.test(uri)) {
          suspiciousURIs.push(uri);
        }
      }
    });
    
    if (invalidURIs.length > 0) {
      this.addError('INVALID_URI', 
        `${invalidURIs.length} URIs inválidas encontradas. Ejemplos: ${invalidURIs.slice(0, 3).join(', ')}`);
    }
    
    if (suspiciousURIs.length > 0) {
      this.addWarning('SUSPICIOUS_URI', 
        `${suspiciousURIs.length} URIs sospechosas (caracteres no codificados). Ejemplos: ${suspiciousURIs.slice(0, 3).join(', ')}`);
    }
    
    if (invalidURIs.length === 0 && suspiciousURIs.length === 0) {
      this.addPassed('URI_VALIDATION', 'Todas las URIs son válidas');
    }
  }

  /**
   * Validar integridad referencial
   */
  async validateReferentialIntegrity(store) {
    const quads = store.getQuads();
    const definedSubjects = new Set();
    const referencedObjects = new Set();
    
    // Recopilar todos los sujetos definidos y objetos referenciados
    quads.forEach(quad => {
      if (quad.subject.termType === 'NamedNode') {
        definedSubjects.add(quad.subject.value);
      }
      if (quad.object.termType === 'NamedNode') {
        // Solo considerar referencias si no son ontologías conocidas
        const uri = quad.object.value;
        if (!uri.startsWith('http://www.w3.org/') && 
            !uri.startsWith('http://xmlns.com/')) {
          referencedObjects.add(uri);
        }
      }
    });
    
    // Encontrar referencias rotas (objetos referenciados que no existen como sujetos)
    const brokenReferences = [];
    referencedObjects.forEach(obj => {
      if (!definedSubjects.has(obj)) {
        brokenReferences.push(obj);
      }
    });
    
    this.validationResults.metrics.definedResources = definedSubjects.size;
    this.validationResults.metrics.externalReferences = referencedObjects.size;
    this.validationResults.metrics.brokenReferences = brokenReferences.length;
    
    if (brokenReferences.length > 0) {
      this.addWarning('BROKEN_REFERENCE', 
        `${brokenReferences.length} referencias rotas encontradas. Ejemplos: ${brokenReferences.slice(0, 3).join(', ')}`);
    } else {
      this.addPassed('REFERENTIAL_INTEGRITY', 'Integridad referencial correcta');
    }
  }

  /**
   * Validar tipos de datos (datatypes)
   */
  async validateDatatypes(store) {
    const quads = store.getQuads();
    const invalidDatatypes = [];
    const xsdNamespace = 'http://www.w3.org/2001/XMLSchema#';
    
    const validXSDTypes = [
      'string', 'integer', 'decimal', 'float', 'double', 'boolean',
      'date', 'dateTime', 'time', 'gYear', 'gMonth', 'gDay'
    ];
    
    quads.forEach(quad => {
      if (quad.object.termType === 'Literal' && quad.object.datatype) {
        const datatype = quad.object.datatype.value;
        
        // Validar si es un tipo XSD conocido
        if (datatype.startsWith(xsdNamespace)) {
          const localType = datatype.replace(xsdNamespace, '');
          if (!validXSDTypes.includes(localType)) {
            invalidDatatypes.push(datatype);
          }
          
          // Validar coherencia de valor con tipo
          const value = quad.object.value;
          if (localType === 'integer' && !/^-?\d+$/.test(value)) {
            this.addWarning('DATATYPE_MISMATCH', 
              `Valor "${value}" no coincide con tipo integer en <${quad.subject.value}>`);
          }
          if (localType === 'boolean' && !['true', 'false', '0', '1'].includes(value)) {
            this.addWarning('DATATYPE_MISMATCH', 
              `Valor "${value}" no coincide con tipo boolean en <${quad.subject.value}>`);
          }
        }
      }
    });
    
    if (invalidDatatypes.length > 0) {
      this.addWarning('UNKNOWN_DATATYPE', 
        `${invalidDatatypes.length} datatypes no estándar encontrados`);
    } else {
      this.addPassed('DATATYPES', 'Todos los datatypes son válidos');
    }
  }

  /**
   * Detectar inconsistencias
   */
  async detectInconsistencies(store) {
    const quads = store.getQuads();
    const resourceProperties = new Map();
    
    // Agrupar propiedades por recurso
    quads.forEach(quad => {
      const subject = quad.subject.value;
      if (!resourceProperties.has(subject)) {
        resourceProperties.set(subject, []);
      }
      resourceProperties.get(subject).push({
        predicate: quad.predicate.value,
        object: quad.object.value,
        objectType: quad.object.termType
      });
    });
    
    // Detectar recursos con propiedades duplicadas
    const duplicateProperties = [];
    resourceProperties.forEach((props, subject) => {
      const predicates = props.map(p => p.predicate);
      const uniquePredicates = new Set(predicates);
      if (predicates.length !== uniquePredicates.size) {
        duplicateProperties.push(subject);
      }
    });
    
    // Detectar recursos sin tipo (rdf:type)
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const resourcesWithoutType = [];
    resourceProperties.forEach((props, subject) => {
      const hasType = props.some(p => p.predicate === rdfType);
      if (!hasType) {
        resourcesWithoutType.push(subject);
      }
    });
    
    if (duplicateProperties.length > 0) {
      this.addWarning('DUPLICATE_PROPERTIES', 
        `${duplicateProperties.length} recursos con propiedades duplicadas`);
    }
    
    if (resourcesWithoutType.length > 0) {
      this.addWarning('MISSING_TYPE', 
        `${resourcesWithoutType.length} recursos sin rdf:type definido`);
    }
    
    if (duplicateProperties.length === 0 && resourcesWithoutType.length === 0) {
      this.addPassed('CONSISTENCY', 'No se detectaron inconsistencias');
    }
  }

  /**
   * Validar contra esquema de base de datos
   */
  async validateAgainstSchema(store, schema, mappingConfig) {
    // Validar que todos los recursos esperados están presentes
    const quads = store.getQuads();
    const subjects = new Set(quads.map(q => q.subject.value));
    
    let expectedResources = 0;
    let foundResources = subjects.size;
    
    // Calcular recursos esperados según schema
    for (const table of schema.tables) {
      try {
        const countQuery = `SELECT COUNT(*) as total FROM "${table.name}"`;
        const result = await db.query(countQuery);
        expectedResources += parseInt(result.rows[0].total);
      } catch (error) {
        // Ignorar errores de tablas no accesibles
      }
    }
    
    // Comparar completitud
    const completeness = expectedResources > 0 
      ? (foundResources / expectedResources * 100).toFixed(1)
      : 100;
    
    this.validationResults.metrics.expectedResources = expectedResources;
    this.validationResults.metrics.completeness = `${completeness}%`;
    
    if (completeness < 90) {
      this.addWarning('LOW_COMPLETENESS', 
        `Completitud baja: solo ${completeness}% de los recursos esperados`);
    } else {
      this.addPassed('COMPLETENESS', `Completitud: ${completeness}%`);
    }
  }

  /**
   * Calcular métricas de calidad
   */
  calculateQualityMetrics(store) {
    const quads = store.getQuads();
    
    // Densidad de información (promedio de triples por recurso)
    const subjects = new Set(quads.map(q => q.subject.value));
    const density = quads.length / subjects.size;
    this.validationResults.metrics.informationDensity = density.toFixed(2);
    
    // Porcentaje de literales vs referencias
    let literalCount = 0;
    let referenceCount = 0;
    quads.forEach(q => {
      if (q.object.termType === 'Literal') literalCount++;
      if (q.object.termType === 'NamedNode') referenceCount++;
    });
    
    this.validationResults.metrics.literalPercentage = 
      `${(literalCount / quads.length * 100).toFixed(1)}%`;
    this.validationResults.metrics.referencePercentage = 
      `${(referenceCount / quads.length * 100).toFixed(1)}%`;
  }

  /**
   * Calcular puntuación de calidad (0-100)
   */
  calculateQualityScore() {
    let score = 100;
    
    // Penalizar por errores
    score -= this.validationResults.errors.length * 15;
    
    // Penalizar por warnings
    score -= this.validationResults.warnings.length * 5;
    
    // Bonificar por validaciones pasadas
    score += Math.min(this.validationResults.passed.length * 2, 20);
    
    // Asegurar rango 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Helpers para agregar resultados
   */
  addPassed(code, message) {
    this.validationResults.passed.push({ code, message });
  }

  addWarning(code, message) {
    this.validationResults.warnings.push({ code, message });
  }

  addError(code, message) {
    this.validationResults.errors.push({ code, message });
  }

  reset() {
    this.validationResults = {
      passed: [],
      warnings: [],
      errors: [],
      metrics: {}
    };
  }
}

module.exports = RDFValidator;