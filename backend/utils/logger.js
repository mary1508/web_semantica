const fs = require('fs');
const path = require('path');

// Crear carpeta de logs si no existe
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Archivo de log actual
const logFile = path.join(logsDir, `transformacion_${new Date().toISOString().split('T')[0]}.log`);

// Clase Logger
class Logger {
  constructor() {
    this.logs = []; // Logs en memoria para consulta rápida
    this.maxMemoryLogs = 1000; // Máximo de logs en memoria
  }

  /**
   * Formatear mensaje de log
   */
  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(metadata).length > 0 ? ` | ${JSON.stringify(metadata)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  /**
   * Escribir log en archivo
   */
  writeToFile(formattedMessage) {
    try {
      fs.appendFileSync(logFile, formattedMessage + '\n', 'utf8');
    } catch (error) {
      console.error('Error escribiendo log:', error);
    }
  }

  /**
   * Agregar log a memoria
   */
  addToMemory(level, message, metadata) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata
    };
    
    this.logs.push(logEntry);
    
    // Limitar logs en memoria
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs.shift();
    }
  }

  /**
   * Log nivel INFO
   */
  info(message, metadata = {}) {
    const formatted = this.formatMessage('INFO', message, metadata);
    console.log(formatted);
    this.writeToFile(formatted);
    this.addToMemory('INFO', message, metadata);
  }

  /**
   * Log nivel SUCCESS
   */
  success(message, metadata = {}) {
    const formatted = this.formatMessage('SUCCESS', message, metadata);
    console.log('\x1b[32m%s\x1b[0m', formatted); // Verde
    this.writeToFile(formatted);
    this.addToMemory('SUCCESS', message, metadata);
  }

  /**
   * Log nivel WARNING
   */
  warn(message, metadata = {}) {
    const formatted = this.formatMessage('WARN', message, metadata);
    console.warn('\x1b[33m%s\x1b[0m', formatted); // Amarillo
    this.writeToFile(formatted);
    this.addToMemory('WARN', message, metadata);
  }

  /**
   * Log nivel ERROR
   */
  error(message, metadata = {}) {
    const formatted = this.formatMessage('ERROR', message, metadata);
    console.error('\x1b[31m%s\x1b[0m', formatted); // Rojo
    this.writeToFile(formatted);
    this.addToMemory('ERROR', message, metadata);
  }

  /**
   * Log nivel DEBUG
   */
  debug(message, metadata = {}) {
    const formatted = this.formatMessage('DEBUG', message, metadata);
    console.log('\x1b[36m%s\x1b[0m', formatted); // Cyan
    this.writeToFile(formatted);
    this.addToMemory('DEBUG', message, metadata);
  }

  /**
   * Registrar inicio de proceso
   */
  startProcess(processName) {
    this.info(`========== INICIO: ${processName} ==========`);
    return Date.now(); // Retornar timestamp para medir duración
  }

  /**
   * Registrar fin de proceso
   */
  endProcess(processName, startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.success(`========== FIN: ${processName} (${duration}s) ==========`);
  }

  /**
   * Obtener logs recientes
   */
  getRecentLogs(count = 100) {
    return this.logs.slice(-count);
  }

  /**
   * Obtener logs por nivel
   */
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Limpiar logs en memoria
   */
  clearMemory() {
    this.logs = [];
    this.info('Logs en memoria limpiados');
  }

  /**
   * Obtener estadísticas de logs
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      info: 0,
      success: 0,
      warn: 0,
      error: 0,
      debug: 0
    };

    this.logs.forEach(log => {
      const level = log.level.toLowerCase();
      if (stats[level] !== undefined) {
        stats[level]++;
      }
    });

    return stats;
  }

  /**
   * Leer archivo de log completo
   */
  readLogFile() {
    try {
      if (fs.existsSync(logFile)) {
        return fs.readFileSync(logFile, 'utf8');
      }
      return '';
    } catch (error) {
      this.error('Error leyendo archivo de log', { error: error.message });
      return '';
    }
  }

  /**
   * Listar todos los archivos de log
   */
  listLogFiles() {
    try {
      const files = fs.readdirSync(logsDir);
      return files
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logsDir, file),
          size: fs.statSync(path.join(logsDir, file)).size,
          modified: fs.statSync(path.join(logsDir, file)).mtime
        }))
        .sort((a, b) => b.modified - a.modified);
    } catch (error) {
      this.error('Error listando archivos de log', { error: error.message });
      return [];
    }
  }
}

// Exportar instancia única (Singleton)
const logger = new Logger();

module.exports = logger;