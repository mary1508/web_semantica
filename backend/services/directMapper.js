const { Writer, DataFactory } = require('n3');
const { namedNode, literal, quad } = DataFactory;
const db = require('../config/database');

// Implementar direct mapping
class DirectMapper {
  constructor(baseNamespace = 'http://ejemplo.org/') {
    this.baseNamespace = baseNamespace;
    this.writer = new Writer({ 
      prefixes: { 
        ex: baseNamespace,
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#'
      } 
    });
  }

  //genera uri para una tabla
  generateTableURI(tableName) {
    return `${this.baseNamespace}${this.capitalize(tableName)}`;
  }

  //para instancia
  generateInstanceURI(tableName, primaryKeyValue) {
    return `${this.baseNamespace}${tableName}/${primaryKeyValue}`;
  }

  //URI para una propiedad
  
  generatePropertyURI(tableName, columnName) {
    return `${this.baseNamespace}${tableName}#${columnName}`;
  }


  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Convertir tipo SQL a tipo XSD
   
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
      'timestamp': 'http://www.w3.org/2001/XMLSchema#dateTime',
      'time': 'http://www.w3.org/2001/XMLSchema#time'
    };
    
    return typeMap[sqlType.toLowerCase()] || 'http://www.w3.org/2001/XMLSchema#string';
  }

  // Ejecutar Direct Mapping completo
   
  async executeDirectMapping(schema) {
    const quads = [];
    
    console.log(` Iniciando Direct Mapping de ${schema.tables.length} tablas...`);

    for (const table of schema.tables) {
      try {
        console.log(`   Procesando tabla: ${table.name}`);
        
    
        const tableClass = namedNode(this.generateTableURI(table.name));
        quads.push(
          quad(
            tableClass,
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode('http://www.w3.org/2000/01/rdf-schema#Class')
          )
        );
        quads.push(
          quad(
            tableClass,
            namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
            literal(this.capitalize(table.name))
          )
        );

     
        const dataQuery = `SELECT * FROM "${table.name}" LIMIT 1000`; // Limitar por rendimiento
        const result = await db.query(dataQuery);
        
        console.log(`    ✓ ${result.rows.length} filas encontradas`);

       
        for (const row of result.rows) {
        
          const pkColumn = table.primaryKeys[0]; // Asumir primera PK
          if (!pkColumn) {
            console.warn(`      Tabla ${table.name} sin clave primaria, omitiendo...`);
            continue;
          }

          const pkValue = row[pkColumn];
          if (!pkValue) continue;

          const instanceURI = namedNode(this.generateInstanceURI(table.name, pkValue));

          
          quads.push(
            quad(
              instanceURI,
              namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              tableClass
            )
          );

          
          for (const column of table.columns) {
            const columnName = column.column_name;
            const value = row[columnName];

            if (value === null || value === undefined) continue;

            const propertyURI = namedNode(this.generatePropertyURI(table.name, columnName));
            const dataType = this.sqlToXSDType(column.data_type);

            
            const fk = table.foreignKeys.find(fk => fk.column_name === columnName);
            
            if (fk) {
              
              const foreignInstanceURI = namedNode(
                this.generateInstanceURI(fk.foreign_table_name, value)
              );
              quads.push(
                quad(instanceURI, propertyURI, foreignInstanceURI)
              );
            } else {
             
              quads.push(
                quad(
                  instanceURI,
                  propertyURI,
                  literal(value.toString(), namedNode(dataType))
                )
              );
            }
          }
        }
      } catch (error) {
        console.error(`     Error procesando tabla ${table.name}:`, error.message);
      }
    }

  
    return new Promise((resolve, reject) => {
      this.writer.addQuads(quads);
      this.writer.end((error, result) => {
        if (error) {
          reject(error);
        } else {
          console.log(` Direct Mapping completado: ${quads.length} tripletas generadas`);
          resolve(result);
        }
      });
    });
  }


  async generateStatistics(schema) {
    let totalRows = 0;
    const tableStats = [];

    for (const table of schema.tables) {
      const countQuery = `SELECT COUNT(*) as total FROM "${table.name}"`;
      const result = await db.query(countQuery);
      const count = parseInt(result.rows[0].total);
      totalRows += count;

      tableStats.push({
        table: table.name,
        rows: count,
        columns: table.columns.length,
        estimatedTriples: count * table.columns.length
      });
    }

    return {
      totalTables: schema.tables.length,
      totalRows: totalRows,
      tables: tableStats
    };
  }
}

module.exports = DirectMapper;