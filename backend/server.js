const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Importar rutas
const dbRoutes = require('./routes/dbRoutes');
const mappingRoutes = require('./routes/mappingRoutes');
const rdfRoutes = require('./routes/rdfRoutes');

// Usar rutas
app.use('/api/db', dbRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/rdf', rdfRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'DB2LinkedData API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Ruta principal - servir el frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: err.message 
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 API disponible en http://localhost:${PORT}/api/health`);
});

module.exports = app;