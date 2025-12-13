/**
 * Generador de reglas R2RML personalizadas con formato compacto
 */
class R2RMLGenerator {
  constructor(baseNamespace = 'http://ejemplo.org/') {
    this.baseNamespace = baseNamespace;
    this.mappingNamespace = `${baseNamespace}mapping/`;
  }

  /**
   * Generar documento R2RML completo desde configuración
   */
  async generateR2RML(mappingConfig) {
    let turtle = this.generatePrefixes();
    
    for (const triplesMap of mappingConfig.triplesMaps) {
      turtle += '\n' + this.generateTriplesMapTurtle(triplesMap);
    }
    
    return turtle;
  }

  /**
   * Generar prefijos
   */
  generatePrefixes() {
    return `@prefix : <${this.mappingNamespace}>.
@prefix rr: <http://www.w3.org/ns/r2rml#>.
@prefix ex: <${this.baseNamespace}>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

`;
  }

  /**
   * Generar un TriplesMap completo en formato Turtle compacto
   */
  generateTriplesMapTurtle(config) {
    const tmId = `:${config.id}`;
    let turtle = `${tmId} a rr:TriplesMap;\n`;
    
    // Logical Table
    turtle += `    rr:logicalTable [\n`;
    if (config.logicalTable.type === 'table') {
      turtle += `        rr:tableName "${this.escapeLiteral(config.logicalTable.tableName)}"\n`;
    } else if (config.logicalTable.type === 'query') {
      turtle += `        rr:sqlQuery """${this.escapeLiteral(config.logicalTable.sqlQuery)}"""\n`;
    }
    turtle += `    ];\n`;
    
    // Subject Map
    turtle += `    rr:subjectMap [\n`;
    if (config.subjectMap.template) {
      turtle += `        rr:template "${this.escapeLiteral(config.subjectMap.template)}"`;
    } else if (config.subjectMap.column) {
      turtle += `        rr:column "${this.escapeLiteral(config.subjectMap.column)}"`;
    }
    
    // Classes
    if (config.subjectMap.classes && config.subjectMap.classes.length > 0) {
      config.subjectMap.classes.forEach(cls => {
        turtle += `;\n        rr:class ${this.formatURI(cls)}`;
      });
    }
    turtle += `\n    ]`;
    
    // Predicate-Object Maps
    if (config.predicateObjectMaps && config.predicateObjectMaps.length > 0) {
      config.predicateObjectMaps.forEach((pom, index) => {
        turtle += `;\n    rr:predicateObjectMap [\n`;
        turtle += `        rr:predicate ${this.formatURI(pom.predicate)};\n`;
        turtle += `        rr:objectMap [\n`;
        
        if (pom.objectMap.column) {
          turtle += `            rr:column "${this.escapeLiteral(pom.objectMap.column)}"`;
          
          if (pom.objectMap.datatype) {
            turtle += `;\n            rr:datatype ${this.formatURI(pom.objectMap.datatype)}`;
          }
          
          if (pom.objectMap.language) {
            turtle += `;\n            rr:language "${this.escapeLiteral(pom.objectMap.language)}"`;
          }
        } else if (pom.objectMap.template) {
          turtle += `            rr:template "${this.escapeLiteral(pom.objectMap.template)}"`;
        } else if (pom.objectMap.constant) {
          turtle += `            rr:constant "${this.escapeLiteral(pom.objectMap.constant)}"`;
        } else if (pom.objectMap.parentTriplesMap) {
          turtle += `            rr:parentTriplesMap :${pom.objectMap.parentTriplesMap}`;
          
          if (pom.objectMap.joinCondition) {
            turtle += `;\n            rr:joinCondition [\n`;
            turtle += `                rr:child "${this.escapeLiteral(pom.objectMap.joinCondition.child)}";\n`;
            turtle += `                rr:parent "${this.escapeLiteral(pom.objectMap.joinCondition.parent)}"\n`;
            turtle += `            ]`;
          }
        }
        
        turtle += `\n        ]\n`;
        turtle += `    ]`;
      });
    }
    
    turtle += `.\n`;
    return turtle;
  }

  /**
   * Formatear URI (usar prefijo si aplica)
   */
  formatURI(uri) {
    if (uri.startsWith(this.baseNamespace)) {
      const localPart = uri.substring(this.baseNamespace.length);
      return `ex:${localPart}`;
    } else if (uri.startsWith('http://www.w3.org/2001/XMLSchema#')) {
      const localPart = uri.substring('http://www.w3.org/2001/XMLSchema#'.length);
      return `xsd:${localPart}`;
    } else if (uri.startsWith(this.mappingNamespace)) {
      const localPart = uri.substring(this.mappingNamespace.length);
      return `:${localPart}`;
    }
    return `<${uri}>`;
  }

  /**
   * Escapar caracteres especiales en literales
   */
  escapeLiteral(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
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
          predicate: `${this.baseNamespace}${col.column_name}`,
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