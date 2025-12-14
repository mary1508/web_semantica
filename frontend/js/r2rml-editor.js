// Estado global del editor
const editorState = {
    triplesMaps: [],
    currentTriplesMapIndex: null,
    generatedR2RML: null,
    baseNamespace: 'http://ejemplo.org/'
};

const API_BASE = 'http://localhost:3000/api';

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Editor R2RML cargado');
    renderTriplesMapslist();
});

// ===== MANEJO DE TRIPLESMAPS =====

function addTriplesMap() {
    const newTM = {
        id: `TriplesMap_${Date.now()}`,
        logicalTable: {
            type: 'table',
            tableName: ''
        },
        subjectMap: {
            template: '',
            classes: []
        },
        predicateObjectMaps: []
    };
    
    editorState.triplesMaps.push(newTM);
    editorState.currentTriplesMapIndex = editorState.triplesMaps.length - 1;
    
    renderTriplesMapslist();
    renderEditor();
}

function selectTriplesMap(index) {
    editorState.currentTriplesMapIndex = index;
    renderTriplesMapslist();
    renderEditor();
}

function deleteTriplesMap() {
    if (editorState.currentTriplesMapIndex === null) return;
    
    if (!confirm('¿Eliminar este TriplesMap?')) return;
    
    editorState.triplesMaps.splice(editorState.currentTriplesMapIndex, 1);
    editorState.currentTriplesMapIndex = editorState.triplesMaps.length > 0 ? 0 : null;
    
    renderTriplesMapslist();
    renderEditor();
}

function duplicateTriplesMap() {
    if (editorState.currentTriplesMapIndex === null) return;
    
    const current = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    const duplicate = JSON.parse(JSON.stringify(current));
    duplicate.id = `${current.id}_copy`;
    
    editorState.triplesMaps.push(duplicate);
    editorState.currentTriplesMapIndex = editorState.triplesMaps.length - 1;
    
    renderTriplesMapslist();
    renderEditor();
}

function saveTriplesMap() {
    if (editorState.currentTriplesMapIndex === null) return;
    
    const tm = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    
    // Guardar datos del formulario
    tm.id = document.getElementById('tmId').value;
    
    // Logical Table
    const ltType = document.getElementById('logicalTableType').value;
    tm.logicalTable.type = ltType;
    if (ltType === 'table') {
        tm.logicalTable.tableName = document.getElementById('tableName').value;
        delete tm.logicalTable.sqlQuery;
    } else {
        tm.logicalTable.sqlQuery = document.getElementById('sqlQuery').value;
        delete tm.logicalTable.tableName;
    }
    
    // Subject Map
    const subjectType = document.getElementById('subjectType').value;
    if (subjectType === 'template') {
        tm.subjectMap.template = document.getElementById('subjectTemplate').value;
        delete tm.subjectMap.column;
    } else {
        tm.subjectMap.column = document.getElementById('subjectColumn').value;
        delete tm.subjectMap.template;
    }
    
    // Clases
    const classesText = document.getElementById('subjectClasses').value;
    tm.subjectMap.classes = classesText
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);
    
    renderTriplesMapslist();
    updateVisualPreview();
    
    showNotification('✅ Cambios guardados', 'success');
}

// ===== PREDICATE-OBJECT MAPS =====

function addPredicateObjectMap() {
    if (editorState.currentTriplesMapIndex === null) return;
    
    const tm = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    tm.predicateObjectMaps.push({
        predicate: '',
        objectMap: {
            column: ''
        }
    });
    
    renderPredicateObjectMaps();
}

function removePredicateObjectMap(index) {
    if (editorState.currentTriplesMapIndex === null) return;
    
    const tm = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    tm.predicateObjectMaps.splice(index, 1);
    
    renderPredicateObjectMaps();
}

function updatePOMValue(pomIndex, field, value) {
    if (editorState.currentTriplesMapIndex === null) return;
    
    const tm = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    const pom = tm.predicateObjectMaps[pomIndex];
    
    if (field === 'predicate') {
        pom.predicate = value;
    } else if (field.startsWith('objectMap.')) {
        const omField = field.replace('objectMap.', '');
        pom.objectMap[omField] = value;
    }
}

function changePOMObjectType(pomIndex, type) {
    if (editorState.currentTriplesMapIndex === null) return;
    
    const tm = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    const pom = tm.predicateObjectMaps[pomIndex];
    
    // Limpiar objectMap y establecer nuevo tipo
    pom.objectMap = {};
    
    if (type === 'column') {
        pom.objectMap.column = '';
        pom.objectMap.datatype = 'http://www.w3.org/2001/XMLSchema#string';
    } else if (type === 'template') {
        pom.objectMap.template = '';
    } else if (type === 'constant') {
        pom.objectMap.constant = '';
    } else if (type === 'reference') {
        pom.objectMap.parentTriplesMap = '';
        pom.objectMap.joinCondition = { child: '', parent: '' };
    }
    
    renderPredicateObjectMaps();
}

// ===== RENDERIZADO =====

function renderTriplesMapslist() {
    const list = document.getElementById('triplesMapsList');
    
    if (editorState.triplesMaps.length === 0) {
        list.innerHTML = '<p class="text-muted" style="padding: 15px; text-align: center;">No hay TriplesMaps aún</p>';
        return;
    }
    
    list.innerHTML = editorState.triplesMaps.map((tm, index) => `
        <div class="triplesMap-item ${index === editorState.currentTriplesMapIndex ? 'active' : ''}" 
             onclick="selectTriplesMap(${index})">
            <div class="tm-name">${tm.id || 'Sin nombre'}</div>
            <div class="tm-info">
                📊 ${tm.predicateObjectMaps?.length || 0} propiedades
            </div>
        </div>
    `).join('');
}

function renderEditor() {
    const placeholder = document.getElementById('editorPlaceholder');
    const editor = document.getElementById('triplesMapEditor');
    
    if (editorState.currentTriplesMapIndex === null) {
        placeholder.style.display = 'flex';
        editor.style.display = 'none';
        return;
    }
    
    placeholder.style.display = 'none';
    editor.style.display = 'block';
    
    const tm = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    
    // Cargar datos en el formulario
    document.getElementById('tmId').value = tm.id || '';
    
    // Logical Table
    document.getElementById('logicalTableType').value = tm.logicalTable.type;
    toggleLogicalTableInputs();
    if (tm.logicalTable.type === 'table') {
        document.getElementById('tableName').value = tm.logicalTable.tableName || '';
    } else {
        document.getElementById('sqlQuery').value = tm.logicalTable.sqlQuery || '';
    }
    
    // Subject Map
    if (tm.subjectMap.template) {
        document.getElementById('subjectType').value = 'template';
        document.getElementById('subjectTemplate').value = tm.subjectMap.template;
    } else if (tm.subjectMap.column) {
        document.getElementById('subjectType').value = 'column';
        document.getElementById('subjectColumn').value = tm.subjectMap.column;
    }
    toggleSubjectInputs();
    
    document.getElementById('subjectClasses').value = (tm.subjectMap.classes || []).join('\n');
    
    // Predicate-Object Maps
    renderPredicateObjectMaps();
    
    // Actualizar vista previa
    updateVisualPreview();
}

function renderPredicateObjectMaps() {
    if (editorState.currentTriplesMapIndex === null) return;
    
    const tm = editorState.triplesMaps[editorState.currentTriplesMapIndex];
    const container = document.getElementById('predicateObjectMapsList');
    
    if (!tm.predicateObjectMaps || tm.predicateObjectMaps.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay propiedades aún. Haz clic en "Agregar Propiedad"</p>';
        return;
    }
    
    container.innerHTML = tm.predicateObjectMaps.map((pom, index) => {
        const objectType = pom.objectMap.column ? 'column' : 
                          pom.objectMap.template ? 'template' :
                          pom.objectMap.constant ? 'constant' :
                          pom.objectMap.parentTriplesMap ? 'reference' : 'column';
        
        return `
            <div class="pom-item">
                <div class="pom-item-header">
                    <span class="pom-item-title">Propiedad #${index + 1}</span>
                    <button class="pom-item-remove" onclick="removePredicateObjectMap(${index})">
                        🗑️ Eliminar
                    </button>
                </div>
                
                <div class="form-group">
                    <label>Predicado (URI):</label>
                    <input type="text" class="form-control" 
                           value="${pom.predicate || ''}"
                           onchange="updatePOMValue(${index}, 'predicate', this.value)"
                           placeholder="http://ejemplo.org/propiedad">
                </div>
                
                <div class="object-type-selector">
                    <label>
                        <input type="radio" name="objectType${index}" value="column" 
                               ${objectType === 'column' ? 'checked' : ''}
                               onchange="changePOMObjectType(${index}, 'column')">
                        Columna
                    </label>
                    <label>
                        <input type="radio" name="objectType${index}" value="template"
                               ${objectType === 'template' ? 'checked' : ''}
                               onchange="changePOMObjectType(${index}, 'template')">
                        Template
                    </label>
                    <label>
                        <input type="radio" name="objectType${index}" value="constant"
                               ${objectType === 'constant' ? 'checked' : ''}
                               onchange="changePOMObjectType(${index}, 'constant')">
                        Constante
                    </label>
                    <label>
                        <input type="radio" name="objectType${index}" value="reference"
                               ${objectType === 'reference' ? 'checked' : ''}
                               onchange="changePOMObjectType(${index}, 'reference')">
                        Referencia
                    </label>
                </div>
                
                ${renderObjectMapInputs(pom, index, objectType)}
            </div>
        `;
    }).join('');
}

function renderObjectMapInputs(pom, index, objectType) {
    if (objectType === 'column') {
        return `
            <div class="pom-grid">
                <div class="form-group">
                    <label>Columna:</label>
                    <input type="text" class="form-control" 
                           value="${pom.objectMap.column || ''}"
                           onchange="updatePOMValue(${index}, 'objectMap.column', this.value)"
                           placeholder="nombre_columna">
                </div>
                <div class="form-group">
                    <label>Datatype (XSD):</label>
                    <select class="form-control" 
                            onchange="updatePOMValue(${index}, 'objectMap.datatype', this.value)">
                        <option value="http://www.w3.org/2001/XMLSchema#string" 
                                ${pom.objectMap.datatype === 'http://www.w3.org/2001/XMLSchema#string' ? 'selected' : ''}>
                            string
                        </option>
                        <option value="http://www.w3.org/2001/XMLSchema#integer"
                                ${pom.objectMap.datatype === 'http://www.w3.org/2001/XMLSchema#integer' ? 'selected' : ''}>
                            integer
                        </option>
                        <option value="http://www.w3.org/2001/XMLSchema#decimal"
                                ${pom.objectMap.datatype === 'http://www.w3.org/2001/XMLSchema#decimal' ? 'selected' : ''}>
                            decimal
                        </option>
                        <option value="http://www.w3.org/2001/XMLSchema#boolean"
                                ${pom.objectMap.datatype === 'http://www.w3.org/2001/XMLSchema#boolean' ? 'selected' : ''}>
                            boolean
                        </option>
                        <option value="http://www.w3.org/2001/XMLSchema#date"
                                ${pom.objectMap.datatype === 'http://www.w3.org/2001/XMLSchema#date' ? 'selected' : ''}>
                            date
                        </option>
                        <option value="http://www.w3.org/2001/XMLSchema#dateTime"
                                ${pom.objectMap.datatype === 'http://www.w3.org/2001/XMLSchema#dateTime' ? 'selected' : ''}>
                            dateTime
                        </option>
                    </select>
                </div>
            </div>
        `;
    } else if (objectType === 'template') {
        return `
            <div class="form-group">
                <label>Template:</label>
                <input type="text" class="form-control" 
                       value="${pom.objectMap.template || ''}"
                       onchange="updatePOMValue(${index}, 'objectMap.template', this.value)"
                       placeholder="http://ejemplo.org/recurso/{id}">
            </div>
        `;
    } else if (objectType === 'constant') {
        return `
            <div class="form-group">
                <label>Valor Constante:</label>
                <input type="text" class="form-control" 
                       value="${pom.objectMap.constant || ''}"
                       onchange="updatePOMValue(${index}, 'objectMap.constant', this.value)"
                       placeholder="Valor fijo">
            </div>
        `;
    } else if (objectType === 'reference') {
        return `
            <div class="form-group">
                <label>Parent TriplesMap:</label>
                <input type="text" class="form-control" 
                       value="${pom.objectMap.parentTriplesMap || ''}"
                       onchange="updatePOMValue(${index}, 'objectMap.parentTriplesMap', this.value)"
                       placeholder="ID del TriplesMap padre">
            </div>
            <div class="pom-grid">
                <div class="form-group">
                    <label>Join Child:</label>
                    <input type="text" class="form-control" 
                           value="${pom.objectMap.joinCondition?.child || ''}"
                           onchange="updatePOMValue(${index}, 'objectMap.joinCondition.child', this.value)"
                           placeholder="columna_local">
                </div>
                <div class="form-group">
                    <label>Join Parent:</label>
                    <input type="text" class="form-control" 
                           value="${pom.objectMap.joinCondition?.parent || ''}"
                           onchange="updatePOMValue(${index}, 'objectMap.joinCondition.parent', this.value)"
                           placeholder="columna_padre">
                </div>
            </div>
        `;
    }
    return '';
}

// ===== TOGGLES =====

function toggleLogicalTableInputs() {
    const type = document.getElementById('logicalTableType').value;
    document.getElementById('tableNameGroup').style.display = type === 'table' ? 'block' : 'none';
    document.getElementById('sqlQueryGroup').style.display = type === 'query' ? 'block' : 'none';
}

function toggleSubjectInputs() {
    const type = document.getElementById('subjectType').value;
    document.getElementById('subjectTemplateGroup').style.display = type === 'template' ? 'block' : 'none';
    document.getElementById('subjectColumnGroup').style.display = type === 'column' ? 'block' : 'none';
}

// ===== VISTA PREVIA =====

function showPreviewTab(tab) {
    document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.preview-content').forEach(c => c.style.display = 'none');
    
    event.target.classList.add('active');
    
    if (tab === 'visual') {
        document.getElementById('previewVisual').style.display = 'block';
        updateVisualPreview();
    } else {
        document.getElementById('previewCode').style.display = 'block';
    }
}

function updateVisualPreview() {
    const container = document.getElementById('visualPreview');
    
    if (editorState.triplesMaps.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay TriplesMaps para visualizar</p>';
        return;
    }
    
    container.innerHTML = editorState.triplesMaps.map(tm => `
        <div class="preview-triplesmap">
            <div class="preview-triplesmap-header">${tm.id || 'Sin ID'}</div>
            
            <div class="preview-section">
                <div class="preview-section-title">📊 Logical Table</div>
                <div class="preview-item">
                    ${tm.logicalTable.type === 'table' ? 
                        `Tabla: <strong>${tm.logicalTable.tableName}</strong>` : 
                        `Query SQL`}
                </div>
            </div>
            
            <div class="preview-section">
                <div class="preview-section-title">🎯 Subject</div>
                <div class="preview-item">
                    ${tm.subjectMap.template || tm.subjectMap.column || 'No definido'}
                </div>
                ${tm.subjectMap.classes?.length > 0 ? `
                    <div class="preview-item">
                        <strong>Clases:</strong> ${tm.subjectMap.classes.join(', ')}
                    </div>
                ` : ''}
            </div>
            
            <div class="preview-section">
                <div class="preview-section-title">🔗 Propiedades (${tm.predicateObjectMaps?.length || 0})</div>
                ${(tm.predicateObjectMaps || []).map(pom => `
                    <div class="preview-item">
                        <span class="preview-predicate">${pom.predicate || '?'}</span>
                        →
                        <span class="preview-object">
                            ${pom.objectMap.column || pom.objectMap.template || pom.objectMap.constant || 'ref'}
                        </span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ===== API CALLS =====

async function generateR2RML() {
    if (editorState.triplesMaps.length === 0) {
        alert('⚠️ No hay TriplesMaps para generar');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/r2rml/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mappingConfig: { triplesMaps: editorState.triplesMaps },
                baseNamespace: editorState.baseNamespace
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al generar R2RML');
        }
        
        editorState.generatedR2RML = result.r2rml;
        document.getElementById('codePreview').textContent = result.r2rml;
        
        showNotification(`✅ R2RML generado: ${result.stats.triplesMaps} TriplesMaps, ${result.stats.totalPredicates} propiedades`, 'success');
        
    } catch (error) {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

async function validateMapping() {
    if (editorState.triplesMaps.length === 0) {
        alert('⚠️ No hay TriplesMaps para validar');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/r2rml/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mappingConfig: { triplesMaps: editorState.triplesMaps },
                baseNamespace: editorState.baseNamespace
            })
        });
        
        const result = await response.json();
        const validationResult = document.getElementById('validationResult');
        validationResult.style.display = 'block';
        
        if (result.validation.valid) {
            validationResult.className = 'validation-result success';
            validationResult.innerHTML = '✅ Configuración válida';
        } else {
            validationResult.className = 'validation-result error';
            validationResult.innerHTML = `
                <strong>❌ Errores encontrados:</strong>
                <ul>${result.validation.errors.map(e => `<li>${e}</li>`).join('')}</ul>
            `;
        }
        
    } catch (error) {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

async function saveMapping() {
    if (editorState.triplesMaps.length === 0) {
        alert('⚠️ No hay TriplesMaps para guardar');
        return;
    }
    
    const name = prompt('Nombre para esta configuración:');
    if (!name) return;
    
    try {
        const response = await fetch(`${API_BASE}/r2rml/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                mappingConfig: { triplesMaps: editorState.triplesMaps },
                r2rml: editorState.generatedR2RML
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al guardar');
        }
        
        showNotification(`✅ Configuración guardada: ${result.fileName}`, 'success');
        
    } catch (error) {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

async function loadSavedMapping() {
    try {
        const response = await fetch(`${API_BASE}/r2rml/list`);
        const result = await response.json();
        
        if (!response.ok || result.mappings.length === 0) {
            alert('No hay configuraciones guardadas');
            return;
        }
        
        const options = result.mappings.map((m, i) => 
            `${i + 1}. ${m.name} (${new Date(m.created).toLocaleString()})`
        ).join('\n');
        
        const selection = prompt(`Selecciona una configuración:\n\n${options}\n\nIngresa el número:`);
        if (!selection) return;
        
        const index = parseInt(selection) - 1;
        if (index < 0 || index >= result.mappings.length) {
            alert('Selección inválida');
            return;
        }
        
        const fileName = result.mappings[index].fileName;
        const loadResponse = await fetch(`${API_BASE}/r2rml/load/${fileName}`);
        const loadResult = await loadResponse.json();
        
        if (!loadResponse.ok) {
            throw new Error(loadResult.error);
        }
        
        editorState.triplesMaps = loadResult.data.mappingConfig.triplesMaps;
        editorState.generatedR2RML = loadResult.data.r2rml;
        editorState.currentTriplesMapIndex = 0;
        
        renderTriplesMapslist();
        renderEditor();
        
        if (editorState.generatedR2RML) {
            document.getElementById('codePreview').textContent = editorState.generatedR2RML;
        }
        
        showNotification('✅ Configuración cargada', 'success');
        
    } catch (error) {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

async function loadTemplate() {
    try {
        const response = await fetch(`${API_BASE}/db/schema`);
        const schema = await response.json();
        
        if (!response.ok || !schema.tables || schema.tables.length === 0) {
            alert('No hay tablas disponibles. Conéctate primero a la base de datos.');
            return;
        }
        
        const tableNames = schema.tables.map(t => t.name).join('\n');
        const tableName = prompt(`Selecciona una tabla:\n\n${tableNames}\n\nIngresa el nombre:`);
        
        if (!tableName) return;
        
        const templateResponse = await fetch(`${API_BASE}/r2rml/template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableName: tableName,
                baseNamespace: editorState.baseNamespace
            })
        });
        
        const templateResult = await templateResponse.json();
        
        if (!templateResponse.ok) {
            throw new Error(templateResult.error);
        }
        
        editorState.triplesMaps.push(templateResult.template);
        editorState.currentTriplesMapIndex = editorState.triplesMaps.length - 1;
        
        renderTriplesMapslist();
        renderEditor();
        
        showNotification(`✅ Plantilla cargada para tabla ${tableName}`, 'success');
        
    } catch (error) {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

function downloadR2RML() {
    if (!editorState.generatedR2RML) {
        alert('⚠️ Primero genera el R2RML');
        return;
    }
    
    const blob = new Blob([editorState.generatedR2RML], { type: 'text/turtle' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mapping.ttl';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showNotification('✅ Archivo descargado', 'success');
}

function validateGenerated() {
    if (!editorState.generatedR2RML) {
        alert('⚠️ Primero genera el R2RML');
        return;
    }
    
    localStorage.setItem('currentRDF', editorState.generatedR2RML);
    window.open('validation.html', '_blank');
}

function publishFromEditor() {
    if (!editorState.generatedR2RML) {
        alert('⚠️ Primero genera el R2RML');
        return;
    }
    
    localStorage.setItem('currentRDF', editorState.generatedR2RML);
    window.open('publish.html', '_blank');
}
// ===== UTILIDADES =====

function showNotification(message, type) {
    const color = type === 'success' ? '#27ae60' : '#e74c3c';
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 0.95em;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}