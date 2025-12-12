const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Obtener logs recientes
router.get('/recent', (req, res) => {
  try {
    const count = parseInt(req.query.count) || 100;
    const logs = logger.getRecentLogs(count);
    res.json({
      success: true,
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener logs por nivel
router.get('/level/:level', (req, res) => {
  try {
    const level = req.params.level.toUpperCase();
    const logs = logger.getLogsByLevel(level);
    res.json({
      success: true,
      level: level,
      count: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas
router.get('/stats', (req, res) => {
  try {
    const stats = logger.getStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener contenido del archivo de log actual
router.get('/file', (req, res) => {
  try {
    const content = logger.readLogFile();
    res.json({
      success: true,
      content: content,
      lines: content.split('\n').length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar archivos de log disponibles
router.get('/files', (req, res) => {
  try {
    const files = logger.listLogFiles();
    res.json({
      success: true,
      files: files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Limpiar logs en memoria
router.post('/clear', (req, res) => {
  try {
    logger.clearMemory();
    res.json({
      success: true,
      message: 'Logs en memoria limpiados'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;