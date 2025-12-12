// Variables globales
let currentSchema = null;
let currentRDF = null;
const API_BASE = 'http://localhost:3000/api';

// Navegación entre tabs
function showTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar tab seleccionado
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');
}

// Manejar formulario de conexión
document.getElementById('connectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const connectionData = {
        host: document.getElementById('dbHost').value,
        port: parseInt(document.getElementById('dbPort').value),
        database: document.getElementById('dbName').value,
        user: document.getElementById('dbUser').value,
        password: document.getElementById('dbPassword').value
    };
    
    const statusBox = document.getElementById('connectionStatus');
    statusBox.style.display = 'block';
    statusBox.className = 'status-box info';
    statusBox.innerHTML = '🔄 Conectando a la base de datos...';
    
    try {
        const response = await fetch(`${API_BASE}/db/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(connectionData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            statusBox.className = 'status-box success';
            statusBox.innerHTML = `${result.message}<br>
                <strong>Base de datos:</strong> ${result.database}<br>
                <strong>Total de tablas:</strong> ${result.totalTables}`;
            
            // Guardar configuración en localStorage para usar después
            localStorage.setItem('dbConnection', JSON.stringify(connectionData));
        } else {
            throw new Error(result.error || 'Error de conexión');
        }
    } catch (error) {
        statusBox.className = 'status-box error';
        statusBox.innerHTML = `Error: ${error.message}`;
    }
});

// Cargar esquema d
// e la base de datos
async function loadSchema() {
    const schemaViewer = document.getElementById('schemaViewer');
    schemaViewer.innerHTML = '<div class="progress-box"><div class="spinner"></div><p>Cargando esquema...</p></div>';
    
    try {
        const response = await fetch(`${API_BASE}/db/schema`);
        const schema = await response.json();
        
        if (!response.ok) {
            throw new Error(schema.error || 'Error al cargar esquema');
        }
        
        currentSchema = schema;
        
        // Renderizar esquema
        let html = `<h3> Base de datos: ${schema.database}</h3>`;
        html += `<p><strong>Total de tablas:</strong> ${schema.totalTables}</p>`;
        
        schema.tables.forEach(table => {
            html += `
                <div class="table-card">
                    <h3> ${table.name}</h3>
                    <p><strong>Columnas:</strong> ${table.columns.length}</p>
                    <ul class="column-list">
            `;
            
            table.columns.forEach(column => {
                const isPK = table.primaryKeys.includes(column.column_name);
                const fk = table.foreignKeys.find(fk => fk.column_name === column.column_name);
                
                html += `
                    <li>
                        <div>
                            <span class="column-name">${column.column_name}</span>
                            <span class="column-type">${column.data_type}</span>
                        </div>
                        <div>
                            ${isPK ? '<span class="pk-badge">PK</span>' : ''}
                            ${fk ? `<span class="fk-badge">FK → ${fk.foreign_table_name}</span>` : ''}
                        </div>
                    </li>
                `;
            });
            
            html += `</ul></div>`;
        });
        
        schemaViewer.innerHTML = html;
        
    } catch (error) {
        schemaViewer.innerHTML = `
            <div class="status-box error">
                 Error: ${error.message}
            </div>
        `;
    }
}

// Generar Direct Mapping
async function generateDirectMapping() {
    const progressBox = document.getElementById('mappingProgress');
    const resultBox = document.getElementById('mappingResult');
    const baseNamespace = document.getElementById('baseNamespace').value;
    
    progressBox.style.display = 'block';
    resultBox.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/mapping/direct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseNamespace })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al generar mapeo');
        }
        
        currentRDF = result.rdf;
        
        progressBox.style.display = 'none';
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
            <div class="status-box success">
                 Direct Mapping generado exitosamente
            </div>
            <h3> Estadísticas:</h3>
            <div class="stat-item">
                <span class="stat-label">Tripletas generadas:</span>
                <span class="stat-value">${result.stats.totalTriples}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tablas procesadas:</span>
                <span class="stat-value">${result.stats.tablesProcessed}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tiempo de procesamiento:</span>
                <span class="stat-value">${result.stats.processingTime}</span>
            </div>
            <h3>🔍 Vista previa (primeras 50 líneas):</h3>
            <pre>${result.rdf.split('\n').slice(0, 50).join('\n')}</pre>
        `;
        
        
        updateExportStats(result.stats);
        
    } catch (error) {
        progressBox.style.display = 'none';
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
            <div class="status-box error">
                 Error: ${error.message}
            </div>
        `;
    }
}


function updateExportStats(stats) {
    const statsBox = document.getElementById('statsBox');
    const statsContent = document.getElementById('statsContent');
    
    statsBox.style.display = 'block';
    statsContent.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Tripletas RDF generadas:</span>
            <span class="stat-value">${stats.totalTriples}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Tablas procesadas:</span>
            <span class="stat-value">${stats.tablesProcessed}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Tiempo de procesamiento:</span>
            <span class="stat-value">${stats.processingTime}</span>
        </div>
    `;
}


function customizeMapping() {
    alert(' Funcionalidad en desarrollo\n\nEsta opción permitirá:\n• Editar nombres de clases\n• Personalizar propiedades\n• Agregar vocabularios estándar\n• Crear reglas R2RML personalizadas');
}


async function downloadRDF() {
    if (!currentRDF) {
        alert(' Primero debes generar el mapeo RDF');
        return;
    }
    
    const format = document.getElementById('exportFormat').value;
    const statusBox = document.getElementById('exportStatus');
    
    statusBox.style.display = 'block';
    statusBox.className = 'status-box info';
    statusBox.innerHTML = ' Preparando descarga...';
    
    try {
        const response = await fetch(`${API_BASE}/rdf/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                rdf: currentRDF,
                format: format 
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al convertir RDF');
        }
        
       
        const blob = new Blob([result.converted], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datos_enlazados.${getFileExtension(format)}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        statusBox.className = 'status-box success';
        statusBox.innerHTML = ` Archivo descargado: datos_enlazados.${getFileExtension(format)}`;
        
    } catch (error) {
        statusBox.className = 'status-box error';
        statusBox.innerHTML = ` Error: ${error.message}`;
    }
}


function getFileExtension(format) {
    const extensions = {
        'turtle': 'ttl',
        'rdfxml': 'rdf',
        'jsonld': 'jsonld',
        'ntriples': 'nt'
    };
    return extensions[format] || 'txt';
}

// Publicar en Fuseki
async function publishToFuseki() {
    if (!currentRDF) {
        alert(' Primero debes generar el mapeo RDF');
        return;
    }
    
    const statusBox = document.getElementById('exportStatus');
    statusBox.style.display = 'block';
    statusBox.className = 'status-box info';
    statusBox.innerHTML = ' Publicando en Apache Jena Fuseki...';
    
    try {
        const response = await fetch(`${API_BASE}/rdf/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rdf: currentRDF })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al publicar en Fuseki');
        }
        
        statusBox.className = 'status-box success';
        statusBox.innerHTML = `
             Datos publicados exitosamente en Fuseki<br>
            <strong>Endpoint SPARQL:</strong> <a href="${result.endpoint}" target="_blank">${result.endpoint}</a><br>
            <strong>Tripletas cargadas:</strong> ${result.triplesLoaded}
        `;
        
    } catch (error) {
        statusBox.className = 'status-box error';
        statusBox.innerHTML = ` Error: ${error.message}<br><small>Asegúrate de que Fuseki esté ejecutándose en http://localhost:3030</small>`;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log(' DB2LinkedData cargado correctamente');
    
    
    const savedConnection = localStorage.getItem('dbConnection');
    if (savedConnection) {
        const conn = JSON.parse(savedConnection);
        document.getElementById('dbHost').value = conn.host;
        document.getElementById('dbPort').value = conn.port;
        document.getElementById('dbName').value = conn.database;
        document.getElementById('dbUser').value = conn.user;
    }
});