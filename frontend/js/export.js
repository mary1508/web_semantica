const API_BASE = 'http://localhost:3000/api';
let selectedFormats = ['turtle'];

// Manejar selección de formatos
document.querySelectorAll('.format-card').forEach(card => {
    card.addEventListener('click', () => {
        const format = card.dataset.format;
        
        if (selectedFormats.includes(format)) {
            selectedFormats = selectedFormats.filter(f => f !== format);
            card.classList.remove('selected');
            card.querySelector('.check-badge')?.remove();
        } else {
            selectedFormats.push(format);
            card.classList.add('selected');
            if (!card.querySelector('.check-badge')) {
                const badge = document.createElement('span');
                badge.className = 'check-badge';
                badge.textContent = '✓';
                card.appendChild(badge);
            }
        }
        
        updatePreview();
    });
});

function updatePreview() {
    const files = [];
    
    if (selectedFormats.includes('turtle')) files.push('├── mapping.ttl');
    if (selectedFormats.includes('rdfxml')) files.push('├── mapping.rdf');
    if (selectedFormats.includes('ntriples')) files.push('├── mapping.nt');
    if (selectedFormats.includes('json')) files.push('├── mapping_config.json');
    
    if (document.getElementById('includeMetadata').checked) {
        files.push('├── metadata.json');
    }
    if (document.getElementById('includeStatistics').checked) {
        files.push('├── statistics.json');
    }
    if (document.getElementById('includeReadme').checked) {
        files.push('└── README.md');
    }
    
    document.getElementById('packagePreview').innerHTML = 
        `mapping_export_${new Date().toISOString().split('T')[0]}/<br>` + 
        files.join('<br>');
}

async function exportSchemas() {
    // Obtener configuración del localStorage
    const savedMappings = localStorage.getItem('r2rmlMappings');
    if (!savedMappings) {
        alert('⚠️ No hay mapeos guardados. Primero crea un mapeo en el Editor R2RML.');
        return;
    }
    
    const mappingConfig = JSON.parse(savedMappings);
    
    const statusBox = document.getElementById('exportStatus');
    statusBox.style.display = 'block';
    statusBox.className = 'status-box info';
    statusBox.innerHTML = '⏳ Generando exportación...';
    
    try {
        const response = await fetch(`${API_BASE}/r2rml/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mappingConfig: mappingConfig,
                formats: selectedFormats,
                includeMetadata: document.getElementById('includeMetadata').checked,
                includeStatistics: document.getElementById('includeStatistics').checked
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al exportar');
        }
        
        // Descargar cada archivo
        for (const [key, file] of Object.entries(result.exports)) {
            downloadFile(file.content, file.filename, file.mimeType);
        }
        
        statusBox.className = 'status-box success';
        statusBox.innerHTML = `
            ✅ Exportación completada<br>
            <strong>Archivos descargados:</strong> ${result.summary.totalFiles}
        `;
        
    } catch (error) {
        statusBox.className = 'status-box error';
        statusBox.innerHTML = `❌ Error: ${error.message}`;
    }
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

async function copyToClipboard() {
    const savedMappings = localStorage.getItem('r2rmlGenerated');
    if (!savedMappings) {
        alert('⚠️ No hay R2RML generado para copiar');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(savedMappings);
        alert('✅ R2RML copiado al portapapeles');
    } catch (error) {
        alert('❌ Error al copiar: ' + error.message);
    }
}

// Inicializar
updatePreview();