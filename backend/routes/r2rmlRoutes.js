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