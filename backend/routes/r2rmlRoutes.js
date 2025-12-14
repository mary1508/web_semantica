const express = require('express');
const router = express.Router();
const R2RMLGenerator = require('../services/r2rmlGenerator');
const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

// Directorio para guardar configuraciones R2RML
const R2RML_DIR = path.join(__dirname, '../../r2rml_mappings');

// Asegurar que existe el directorio
(async () => {
  try {
    await fs.mkdir(R2RML_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creando directorio R2RML:', err);
  }
})();

/**
 * POST /api/r2rml/generate
 * Generar documento R2RML desde configuración visual
 */
router.post('/generate', async (req, res) => {
  try {
    const { mappingConfig, baseNamespace } = req.body;
    
    const generator = new R2RMLGenerator(baseNamespace || process.env.BASE_NAMESPACE);
    
    // Validar configuración
    const validation = generator.validateMapping(mappingConfig);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Configuración R2RML inválida',
        validationErrors: validation.errors
      });
    }
    
    // Generar R2RML
    const r2rml = await generator.generateR2RML(mappingConfig);
    
    res.json({
      success: true,
      r2rml: r2rml,
      stats: {
        triplesMaps: mappingConfig.triplesMaps.length,
        totalPredicates: mappingConfig.triplesMaps.reduce(
          (sum, tm) => sum + tm.predicateObjectMaps.length, 0
        )
      }
    });
    
  } catch (error) {
    console.error('Error generando R2RML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/r2rml/template
 * Generar plantilla R2RML automática para una tabla
 */
router.post('/template', async (req, res) => {
  try {
    const { tableName, baseNamespace } = req.body;
    
    // Obtener esquema de la tabla
    const schema = await db.getDatabaseSchema();
    const table = schema.tables.find(t => t.name === tableName);
    
    if (!table) {
      return res.status(404).json({
        success: false,
        error: `Tabla ${tableName} no encontrada`
      });
    }
    
    const generator = new R2RMLGenerator(baseNamespace || process.env.BASE_NAMESPACE);
    const primaryKey = table.primaryKeys[0] || table.columns[0].column_name;
    
    const template = generator.generateTemplate(
      tableName,
      table.columns,
      primaryKey
    );
    
    res.json({
      success: true,
      template: template,
      tableInfo: {
        name: tableName,
        columns: table.columns.length,
        primaryKey: primaryKey
      }
    });
    
  } catch (error) {
    console.error('Error generando plantilla:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/r2rml/validate
 * Validar configuración R2RML
 */
router.post('/validate', async (req, res) => {
  try {
    const { mappingConfig, baseNamespace } = req.body;
    
    const generator = new R2RMLGenerator(baseNamespace || process.env.BASE_NAMESPACE);
    const validation = generator.validateMapping(mappingConfig);
    
    res.json({
      success: true,
      validation: validation
    });
    
  } catch (error) {
    console.error('Error validando R2RML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/r2rml/save
 * Guardar configuración R2RML
 */
router.post('/save', async (req, res) => {
  try {
    const { name, mappingConfig, r2rml } = req.body;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${name || 'mapping'}_${timestamp}.json`;
    const filePath = path.join(R2RML_DIR, fileName);
    
    const saveData = {
      name: name,
      created: new Date().toISOString(),
      mappingConfig: mappingConfig,
      r2rml: r2rml
    };
    
    await fs.writeFile(filePath, JSON.stringify(saveData, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: 'Configuración guardada',
      fileName: fileName,
      path: filePath
    });
    
  } catch (error) {
    console.error('Error guardando R2RML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/r2rml/list
 * Listar configuraciones R2RML guardadas
 */
router.get('/list', async (req, res) => {
  try {
    const files = await fs.readdir(R2RML_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const mappings = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(R2RML_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        const stats = await fs.stat(filePath);
        
        return {
          fileName: file,
          name: data.name,
          created: data.created,
          size: stats.size,
          triplesMaps: data.mappingConfig?.triplesMaps?.length || 0
        };
      })
    );
    
    res.json({
      success: true,
      count: mappings.length,
      mappings: mappings.sort((a, b) => 
        new Date(b.created) - new Date(a.created)
      )
    });
    
  } catch (error) {
    console.error('Error listando R2RML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/r2rml/load/:fileName
 * Cargar configuración R2RML guardada
 */
router.get('/load/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(R2RML_DIR, fileName);
    
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    res.json({
      success: true,
      data: data
    });
    
  } catch (error) {
    console.error('Error cargando R2RML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/r2rml/delete/:fileName
 * Eliminar configuración R2RML
 */
router.delete('/delete/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(R2RML_DIR, fileName);
    
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: 'Configuración eliminada'
    });
    
  } catch (error) {
    console.error('Error eliminando R2RML:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

/**
 * POST /api/r2rml/export
 * Exportar esquema R2RML en múltiples formatos
 */
router.post('/export', async (req, res) => {
  try {
    const { 
      mappingConfig, 
      formats = ['turtle'],
      includeMetadata = true,
      includeStatistics = true,
      includeComments = true
    } = req.body;
    
    const generator = new R2RMLGenerator(process.env.BASE_NAMESPACE);
    const exports = {};
    
    // Generar R2RML en Turtle
    const r2rmlTurtle = await generator.generateR2RML(mappingConfig);
    
    // Exportar en formatos solicitados
    if (formats.includes('turtle')) {
      exports.turtle = {
        content: r2rmlTurtle,
        filename: 'mapping.ttl',
        mimeType: 'text/turtle'
      };
    }
    
    if (formats.includes('json')) {
      const jsonExport = {
        version: '1.0',
        created: new Date().toISOString(),
        mappingConfig: mappingConfig
      };
      
      exports.json = {
        content: JSON.stringify(jsonExport, null, 2),
        filename: 'mapping_config.json',
        mimeType: 'application/json'
      };
    }
    
    // Metadatos
    if (includeMetadata) {
      exports.metadata = {
        content: JSON.stringify({
          exportDate: new Date().toISOString(),
          system: 'DB2LinkedData',
          version: '1.0',
          triplesMaps: mappingConfig.triplesMaps.length,
          baseNamespace: process.env.BASE_NAMESPACE
        }, null, 2),
        filename: 'metadata.json',
        mimeType: 'application/json'
      };
    }
    
    // Estadísticas
    if (includeStatistics) {
      const stats = {
        totalTriplesMaps: mappingConfig.triplesMaps.length,
        totalPredicates: mappingConfig.triplesMaps.reduce(
          (sum, tm) => sum + tm.predicateObjectMaps.length, 0
        ),
        tables: mappingConfig.triplesMaps.map(tm => ({
          id: tm.id,
          table: tm.logicalTable.tableName || 'query',
          properties: tm.predicateObjectMaps.length
        }))
      };
      
      exports.statistics = {
        content: JSON.stringify(stats, null, 2),
        filename: 'statistics.json',
        mimeType: 'application/json'
      };
    }
    
    // README
    exports.readme = {
      content: generateReadme(mappingConfig),
      filename: 'README.md',
      mimeType: 'text/markdown'
    };
    
    res.json({
      success: true,
      exports: exports,
      summary: {
        formats: Object.keys(exports),
        totalFiles: Object.keys(exports).length
      }
    });
    
  } catch (error) {
    console.error('Error exportando esquema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/r2rml/convert-format
 * Convertir R2RML de un formato a otro
 */
router.post('/convert-format', async (req, res) => {
  try {
    const { rdf, targetFormat } = req.body;
    
    const { Parser, Writer } = require('n3');
    
    // Parsear el RDF de entrada
    const parser = new Parser();
    const quads = parser.parse(rdf);
    
    // Determinar formato de salida
    let writerFormat, contentType, extension;
    
    switch (targetFormat) {
      case 'ntriples':
        writerFormat = 'N-Triples';
        contentType = 'application/n-triples';
        extension = 'nt';
        break;
      case 'rdfxml':
        writerFormat = 'application/rdf+xml';
        contentType = 'application/rdf+xml';
        extension = 'rdf';
        break;
      case 'turtle':
      default:
        writerFormat = 'Turtle';
        contentType = 'text/turtle';
        extension = 'ttl';
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
        format: targetFormat,
        contentType: contentType,
        extension: extension,
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

// Helper: Generar README
function generateReadme(mappingConfig) {
  return `# R2RML Mapping Documentation

## Overview
This R2RML mapping was generated by DB2LinkedData on ${new Date().toISOString()}.

## Statistics
- Total TriplesMaps: ${mappingConfig.triplesMaps.length}
- Total Properties: ${mappingConfig.triplesMaps.reduce((sum, tm) => sum + tm.predicateObjectMaps.length, 0)}

## TriplesMaps

${mappingConfig.triplesMaps.map(tm => `
### ${tm.id}

**Logical Table:** ${tm.logicalTable.tableName || 'SQL Query'}

**Subject Template:** ${tm.subjectMap.template || tm.subjectMap.column}

**Classes:** ${tm.subjectMap.classes?.join(', ') || 'None'}

**Properties:** ${tm.predicateObjectMaps.length}

${tm.predicateObjectMaps.map((pom, i) => `
${i + 1}. **${pom.predicate}**
   - Object: ${pom.objectMap.column || pom.objectMap.template || pom.objectMap.constant || 'Reference'}
   ${pom.objectMap.datatype ? `- Datatype: ${pom.objectMap.datatype}` : ''}
`).join('\n')}

---
`).join('\n')}

## Usage

### With Morph-RDB
\`\`\`bash
java -jar morph-rdb.jar -c config.properties
\`\`\`

### With RML Mapper
\`\`\`bash
java -jar rmlmapper.jar -m mapping.ttl -o output.ttl
\`\`\`

## Generated by
- System: DB2LinkedData
- Date: ${new Date().toISOString()}
- Format: R2RML (W3C Recommendation)
`;
}

module.exports = router;