const { Writer, DataFactory } = require('n3');
const { namedNode, literal } = DataFactory;

/**
 * Generador de reglas R2RML personalizadas
 */
class R2RMLGenerator {
  constructor(baseNamespace = 'http://ejemplo.org/') {
    this.baseNamespace = baseNamespace;
    this.mappingNamespace = `${baseNamespace}mapping/`;
    this.writer = new Writer({
      prefixes: {
        rr: 'http://www.w3.org/ns/r2rml#',
        ex: baseNamespace,
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#'
      }
    });
  }

  /**
   * Generar documento R2RML completo desde configuración
   */
  async generateR2RML(mappingConfig) {
    const quads = [];

    for (const triplesMap of mappingConfig.triplesMaps) {
      quads.push(...this.generateTriplesMap(triplesMap));
    }

    return new Promise((resolve, reject) => {
      this.writer.addQuads(quads);
      this.writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Generar un TriplesMap completo
   */
  generateTriplesMap(config) {
    const quads = [];
    const tmURI = namedNode(`${this.mappingNamespace}${config.id}`);

    // TriplesMap declaration
    quads.push({
      subject: tmURI,
      predicate: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      object: namedNode('http://www.w3.org/ns/r2rml#TriplesMap')
    });

    // Logical Table
    const logicalTableNode = namedNode(`${this.mappingNamespace}${config.id}_LogicalTable`);
    quads.push({
      subject: tmURI,
      predicate: namedNode('http://www.w3.org/ns/r2rml#logicalTable'),
      object: logicalTableNode
    });

    if (config.logicalTable.type === 'table') {
      quads.push({
        subject: logicalTableNode,
        predicate: namedNode('http://www.w3.org/ns/r2rml#tableName'),
        object: literal(config.logicalTable.tableName)
      });
    } else if (config.logicalTable.type === 'query') {
      quads.push({
        subject: logicalTableNode,
        predicate: namedNode('http://www.w3.org/ns/r2rml#sqlQuery'),
        object: literal(config.logicalTable.sqlQuery)
      });
    }

    // Subject Map
    const subjectMapNode = namedNode(`${this.mappingNamespace}${config.id}_SubjectMap`);
    quads.push({
      subject: tmURI,
      predicate: namedNode('http://www.w3.org/ns/r2rml#subjectMap'),
      object: subjectMapNode
    });

    // Subject template o column
    if (config.subjectMap.template) {
      quads.push({
        subject: subjectMapNode,
        predicate: namedNode('http://www.w3.org/ns/r2rml#template'),
        object: literal(config.subjectMap.template)
      });
    } else if (config.subjectMap.column) {
      quads.push({
        subject: subjectMapNode,
        predicate: namedNode('http://www.w3.org/ns/r2rml#column'),
        object: literal(config.subjectMap.column)
      });
    }

    // Subject classes
    if (config.subjectMap.classes && config.subjectMap.classes.length > 0) {
      config.subjectMap.classes.forEach(cls => {
        quads.push({
          subject: subjectMapNode,
          predicate: namedNode('http://www.w3.org/ns/r2rml#class'),
          object: namedNode(cls)
        });
      });
    }

    // Predicate-Object Maps
    config.predicateObjectMaps.forEach((pom, index) => {
      const pomNode = namedNode(`${this.mappingNamespace}${config.id}_POM_${index}`);
      
      quads.push({
        subject: tmURI,
        predicate: namedNode('http://www.w3.org/ns/r2rml#predicateObjectMap'),
        object: pomNode
      });

      // Predicate Map
      const predicateMapNode = namedNode(`${this.mappingNamespace}${config.id}_PredicateMap_${index}`);
      quads.push({
        subject: pomNode,
        predicate: namedNode('http://www.w3.org/ns/r2rml#predicateMap'),
        object: predicateMapNode
      });

      quads.push({
        subject: predicateMapNode,
        predicate: namedNode('http://www.w3.org/ns/r2rml#constant'),
        object: namedNode(pom.predicate)
      });

      // Object Map
      const objectMapNode = namedNode(`${this.mappingNamespace}${config.id}_ObjectMap_${index}`);
      quads.push({
        subject: pomNode,
        predicate: namedNode('http://www.w3.org/ns/r2rml#objectMap'),
        object: objectMapNode
      });

      if (pom.objectMap.column) {
        quads.push({
          subject: objectMapNode,
          predicate: namedNode('http://www.w3.org/ns/r2rml#column'),
          object: literal(pom.objectMap.column)
        });

        // Datatype
        if (pom.objectMap.datatype) {
          quads.push({
            subject: objectMapNode,
            predicate: namedNode('http://www.w3.org/ns/r2rml#datatype'),
            object: namedNode(pom.objectMap.datatype)
          });
        }

        // Language
        if (pom.objectMap.language) {
          quads.push({
            subject: objectMapNode,
            predicate: namedNode('http://www.w3.org/ns/r2rml#language'),
            object: literal(pom.objectMap.language)
          });
        }
      } else if (pom.objectMap.template) {
        quads.push({
          subject: objectMapNode,
          predicate: namedNode('http://www.w3.org/ns/r2rml#template'),
          object: literal(pom.objectMap.template)
        });
      } else if (pom.objectMap.constant) {
        quads.push({
          subject: objectMapNode,
          predicate: namedNode('http://www.w3.org/ns/r2rml#constant'),
          object: literal(pom.objectMap.constant)
        });
      } else if (pom.objectMap.parentTriplesMap) {
        // Reference Object Map (para relaciones)
        quads.push({
          subject: objectMapNode,
          predicate: namedNode('http://www.w3.org/ns/r2rml#parentTriplesMap'),
          object: namedNode(`${this.mappingNamespace}${pom.objectMap.parentTriplesMap}`)
        });

        if (pom.objectMap.joinCondition) {
          const joinNode = namedNode(`${this.mappingNamespace}${config.id}_Join_${index}`);
          quads.push({
            subject: objectMapNode,
            predicate: namedNode('http://www.w3.org/ns/r2rml#joinCondition'),
            object: joinNode
          });

          quads.push({
            subject: joinNode,
            predicate: namedNode('http://www.w3.org/ns/r2rml#child'),
            object: literal(pom.objectMap.joinCondition.child)
          });

          quads.push({
            subject: joinNode,
            predicate: namedNode('http://www.w3.org/ns/r2rml#parent'),
            object: literal(pom.objectMap.joinCondition.parent)
          });
        }
      }
    });

    return quads;
  }

  /**
   * Validar configuración R2RML
   */
  validateMapping(mappingConfig) {
    const errors = [];

    if (!mappingConfig.triplesMaps || mappingConfig.triplesMaps.length === 0) {
      errors.push('Debe haber al menos un TriplesMap');
    }

    mappingConfig.triplesMaps.forEach((tm, idx) => {
      // Validar ID único
      if (!tm.id || tm.id.trim() === '') {
        errors.push(`TriplesMap ${idx}: ID requerido`);
      }

      // Validar Logical Table
      if (!tm.logicalTable) {
        errors.push(`TriplesMap ${tm.id}: Logical Table requerida`);
      } else if (tm.logicalTable.type === 'table' && !tm.logicalTable.tableName) {
        errors.push(`TriplesMap ${tm.id}: Table Name requerido`);
      } else if (tm.logicalTable.type === 'query' && !tm.logicalTable.sqlQuery) {
        errors.push(`TriplesMap ${tm.id}: SQL Query requerida`);
      }

      // Validar Subject Map
      if (!tm.subjectMap) {
        errors.push(`TriplesMap ${tm.id}: Subject Map requerido`);
      } else if (!tm.subjectMap.template && !tm.subjectMap.column) {
        errors.push(`TriplesMap ${tm.id}: Subject Map debe tener template o column`);
      }

      // Validar Predicate-Object Maps
      if (!tm.predicateObjectMaps || tm.predicateObjectMaps.length === 0) {
        errors.push(`TriplesMap ${tm.id}: Debe tener al menos un Predicate-Object Map`);
      }

      tm.predicateObjectMaps.forEach((pom, pomIdx) => {
        if (!pom.predicate) {
          errors.push(`TriplesMap ${tm.id} POM ${pomIdx}: Predicate requerido`);
        }
        if (!pom.objectMap) {
          errors.push(`TriplesMap ${tm.id} POM ${pomIdx}: Object Map requerido`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generar plantilla base para una tabla
   */
  generateTemplate(tableName, columns, primaryKey) {
    return {
      id: `TriplesMap_${tableName}`,
      logicalTable: {
        type: 'table',
        tableName: tableName
      },
      subjectMap: {
        template: `${this.baseNamespace}${tableName}/{${primaryKey}}`,
        classes: [`${this.baseNamespace}${this.capitalize(tableName)}`]
      },
      predicateObjectMaps: columns
        .filter(col => col.column_name !== primaryKey)
        .map(col => ({
          predicate: `${this.baseNamespace}${tableName}#${col.column_name}`,
          objectMap: {
            column: col.column_name,
            datatype: this.sqlToXSDType(col.data_type)
          }
        }))
    };
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  sqlToXSDType(sqlType) {
    const typeMap = {
      'integer': 'http://www.w3.org/2001/XMLSchema#integer',
      'bigint': 'http://www.w3.org/2001/XMLSchema#integer',
      'smallint': 'http://www.w3.org/2001/XMLSchema#integer',
      'numeric': 'http://www.w3.org/2001/XMLSchema#decimal',
      'real': 'http://www.w3.org/2001/XMLSchema#float',
      'double precision': 'http://www.w3.org/2001/XMLSchema#double',
      'character varying': 'http://www.w3.org/2001/XMLSchema#string',
      'varchar': 'http://www.w3.org/2001/XMLSchema#string',
      'text': 'http://www.w3.org/2001/XMLSchema#string',
      'boolean': 'http://www.w3.org/2001/XMLSchema#boolean',
      'date': 'http://www.w3.org/2001/XMLSchema#date',
      'timestamp': 'http://www.w3.org/2001/XMLSchema#dateTime'
    };
    return typeMap[sqlType.toLowerCase()] || 'http://www.w3.org/2001/XMLSchema#string';
  }
}

module.exports = R2RMLGenerator;