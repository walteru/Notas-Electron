const projectList = document.getElementById('project-list');
const viewer = document.getElementById('viewer');
const editor = document.getElementById('editor');
const lineNumbers = document.getElementById('line-numbers');
const lineMirror = document.getElementById('line-mirror');
const currentFileSpan = document.getElementById('current-file');
const searchModal = document.getElementById('search-modal');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const promptModal = document.getElementById('prompt-modal');
const promptInput = document.getElementById('prompt-input');
const promptTitle = document.getElementById('prompt-title');

let state = {
    projects: [],
    selectedProject: null, // { name: string, path: string }
    isEditing: false,
    originalContent: '',
    dirty: false,
    autoSaveTimer: null
};

// --- Initialization ---

async function init() {
    await refreshProjects();
    setupEventListeners();
}

async function refreshProjects(selectName = null) {
    state.projects = await window.api.getProjects();
    renderProjectList(selectName);
}

function renderProjectList(selectName = null) {
    projectList.innerHTML = '';
    state.projects.forEach(project => {
        const li = document.createElement('li');
        li.textContent = project.name;
        li.dataset.path = project.path;
        if (state.selectedProject && state.selectedProject.name === project.name) {
            li.classList.add('selected');
        } else if (selectName && project.name === selectName) {
            li.classList.add('selected');
            state.selectedProject = project;
        }
        li.onclick = () => selectProject(project);
        projectList.appendChild(li);
    });

    if (!state.selectedProject && state.projects.length > 0) {
        selectProject(state.projects[0]);
    }
}

async function selectProject(project, highlightOpts = null) {
    // Si estábamos editando y había un guardado pendiente, lo forzamos
    if (state.autoSaveTimer) {
        clearTimeout(state.autoSaveTimer);
        await saveNote();
    }

    state.selectedProject = project;
    state.isEditing = false;
    state.dirty = false;

    document.querySelectorAll('#project-list li').forEach(li => {
        li.classList.toggle('selected', li.textContent === project.name);
    });

    const content = await window.api.readNote(project.path);
    state.originalContent = content;

    currentFileSpan.textContent = `> ${project.name}.md`;
    viewer.classList.remove('hidden');
    editor.classList.add('hidden');
    editor.value = content;

    if (highlightOpts) {
        renderViewerWithHighlight(content, highlightOpts.line, highlightOpts.query);
        // Limpiar el highlight tras la animación para no dejar HTML residual
        setTimeout(() => {
            if (!state.isEditing && state.selectedProject && state.selectedProject.path === project.path) {
                viewer.textContent = content;
            }
        }, 2500);
    } else {
        viewer.textContent = content;
    }
    updateLineNumbers();
}

// --- Search highlighting helpers ---

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

function highlightMatch(text, query) {
    const escapedText = escapeHtml(text);
    if (!query) return escapedText;
    const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escapedText.replace(new RegExp(escapedQuery, 'gi'), m => `<mark class="search-match">${m}</mark>`);
}

function renderViewerWithHighlight(content, lineNumber, query) {
    const lines = content.split('\n');
    const html = lines.map((line, idx) => {
        if (idx === lineNumber - 1) {
            return `<span class="line-highlight" id="search-highlight-line">${highlightMatch(line, query)}</span>`;
        }
        return escapeHtml(line);
    }).join('\n');
    viewer.innerHTML = html;
    const target = document.getElementById('search-highlight-line');
    if (target) target.scrollIntoView({ block: 'center' });
}

// --- Actions ---

function enterEditMode(atEnd = false, caretOffset = null) {
    if (!state.selectedProject) return;
    state.isEditing = true;
    const viewerScrollTop = viewer.scrollTop;
    viewer.classList.add('hidden');
    editor.classList.remove('hidden');
    editor.value = state.originalContent;
    editor.focus();

    if (atEnd) {
        editor.setSelectionRange(editor.value.length, editor.value.length);
        editor.scrollTop = editor.scrollHeight;
    } else {
        const offset = caretOffset !== null ? caretOffset : 0;
        editor.setSelectionRange(offset, offset);
        editor.scrollTop = viewerScrollTop;
    }
    updateLineNumbers();
}

function enterEditModeFromClick(e) {
    let offset = 0;
    if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos && pos.offsetNode) offset = pos.offset;
    } else if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) offset = range.startOffset;
    }
    enterEditMode(false, offset);
}

async function saveNote() {
    if (!state.selectedProject) return;
    const content = editor.value;
    await window.api.saveNote({
        fileName: state.selectedProject.path,
        content: content
    });
    state.originalContent = content;
    state.dirty = false;
    viewer.textContent = content;
    updateLineNumbers();
    // No salimos del modo edición automáticamente en autoguardado para no romper el flujo
}

function cancelEdit() {
    if (state.autoSaveTimer) {
        clearTimeout(state.autoSaveTimer);
        saveNote(); // Guardamos lo último antes de salir
    }
    state.isEditing = false;
    state.dirty = false;
    editor.classList.add('hidden');
    viewer.classList.remove('hidden');
    updateLineNumbers();
}

async function newProject() {
    showPrompt('Nuevo Proyecto', 'Nombre del proyecto...', async (name) => {
        if (!name) return;
        const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
        const fileName = `${slug}.md`;
        const initialContent = `# ${name}\n\n## ${new Date().toLocaleDateString('es-ES')}\n\n`;

        await window.api.saveNote({ fileName, content: initialContent });
        await refreshProjects();
        const newProj = state.projects.find(p => p.name === slug);
        if (newProj) {
            await selectProject(newProj);
            enterEditMode(true);
        }
    });
}

async function deleteProject() {
    if (!state.selectedProject) return;
    const choice = await window.api.confirmDialog({
        title: 'Eliminar Proyecto',
        message: `¿Estás seguro de que quieres eliminar "${state.selectedProject.name}"? Esta acción no se puede deshacer.`,
        buttons: ['Cancelar', 'Eliminar']
    });

    if (choice === 1) {
        await window.api.deleteNote(state.selectedProject.path);
        state.selectedProject = null;
        await refreshProjects();
    }
}

async function newNote() {
    if (!state.selectedProject) return;
    let content = state.originalContent;
    if (!content.endsWith('\n')) content += '\n';
    if (!content.endsWith('\n\n')) content += '\n';
    content += `## ${new Date().toLocaleDateString('es-ES')}\n\n`;
    
    editor.value = content;
    enterEditMode(true);
    state.dirty = true;
    triggerAutoSave(); // Guardar la cabecera de la nueva nota inmediatamente
}

// --- Modals Logic ---

function showPrompt(title, placeholder, callback) {
    promptTitle.textContent = title;
    promptInput.placeholder = placeholder;
    promptInput.value = '';
    promptModal.classList.remove('hidden');
    promptInput.focus();

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            promptModal.classList.add('hidden');
            window.removeEventListener('keydown', onKeyDown);
            callback(promptInput.value);
        } else if (e.key === 'Escape') {
            promptModal.classList.add('hidden');
            window.removeEventListener('keydown', onKeyDown);
            callback(null);
        }
    };
    promptInput.onkeydown = onKeyDown;
}

function showSearch() {
    searchModal.classList.remove('hidden');
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchInput.focus();
}

async function performSearch() {
    const query = searchInput.value;
    if (query.length < 2) {
        searchResults.innerHTML = '';
        return;
    }
    const results = await window.api.searchNotes(query);
    renderSearchResults(results);
}

function renderSearchResults(results) {
    const query = searchInput.value;
    searchResults.innerHTML = '';
    results.forEach(res => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="result-header">${escapeHtml(res.file)} (Línea ${res.line})</div>
            <div class="result-text">${highlightMatch(res.text, query)}</div>
        `;
        li.onclick = () => {
            const project = state.projects.find(p => p.name === res.file);
            if (project) {
                searchModal.classList.add('hidden');
                selectProject(project, { line: res.line, query });
            }
        };
        searchResults.appendChild(li);
    });
}

// --- Line Numbers ---

function updateLineNumbers() {
    const target = state.isEditing ? editor : viewer;
    const content = state.isEditing ? editor.value : (viewer.textContent || '');

    const targetStyle = window.getComputedStyle(target);
    const paddingLeft = parseFloat(targetStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(targetStyle.paddingRight) || 0;
    const contentWidth = target.clientWidth - paddingLeft - paddingRight;
    const lineHeight = parseFloat(targetStyle.lineHeight) || 20;

    if (contentWidth <= 0) return;

    lineMirror.style.fontFamily = targetStyle.fontFamily;
    lineMirror.style.fontSize = targetStyle.fontSize;
    lineMirror.style.fontWeight = targetStyle.fontWeight;
    lineMirror.style.lineHeight = targetStyle.lineHeight;
    lineMirror.style.letterSpacing = targetStyle.letterSpacing;
    lineMirror.style.width = contentWidth + 'px';
    lineMirror.style.whiteSpace = 'pre-wrap';
    lineMirror.style.wordWrap = 'break-word';
    lineMirror.style.overflowWrap = 'break-word';

    const lines = content.split('\n');
    let html = '';
    for (let i = 0; i < lines.length; i++) {
        lineMirror.textContent = lines[i].length === 0 ? ' ' : lines[i];
        const rows = Math.max(1, Math.round(lineMirror.offsetHeight / lineHeight));
        html += `<div class="ln" style="height:${rows * lineHeight}px">${i + 1}</div>`;
    }
    lineNumbers.innerHTML = html;
    syncLineNumbersScroll();
}

function syncLineNumbersScroll() {
    const target = state.isEditing ? editor : viewer;
    lineNumbers.scrollTop = target.scrollTop;
}

// --- Auto Save Logic ---

function triggerAutoSave() {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(async () => {
        await saveNote();
        state.autoSaveTimer = null;
    }, 1000); // Guardar después de 1 segundo de inactividad
}

// --- Event Listeners ---

function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        // Zoom global (funciona siempre, también dentro del editor y modales)
        if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            window.api.zoomIn();
            updateLineNumbers();
            return;
        }
        if (e.ctrlKey && e.key === '-') {
            e.preventDefault();
            window.api.zoomOut();
            updateLineNumbers();
            return;
        }
        if (e.ctrlKey && e.key === '0') {
            e.preventDefault();
            window.api.zoomReset();
            updateLineNumbers();
            return;
        }

        // Ignorar si hay un modal abierto o si estamos editando (salvo atajos específicos)
        const modalOpen = !searchModal.classList.contains('hidden') || !promptModal.classList.contains('hidden');

        if (modalOpen) {
            if (e.key === 'Escape') {
                searchModal.classList.add('hidden');
                promptModal.classList.add('hidden');
            }
            return;
        }

        if (state.isEditing) {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
                saveNote();
            } else if (e.key === 'Escape') {
                cancelEdit();
            } else if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                // Ajustamos el cálculo para ser más conservadores y evitar el salto de línea
                const editorWidth = editor.clientWidth - 40; 
                const charWidth = 10.6; // Aumentamos un poco el ancho estimado por caracter
                const count = Math.floor(editorWidth / charWidth) - 1; // Restamos 1 extra por seguridad
                const separator = '\n' + '-'.repeat(count) + '\n';
                
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + separator + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + separator.length;
                triggerAutoSave();
            }
            return;
        }

        // Atajos en modo Vista
        switch(e.key.toLowerCase()) {
            case 'q': e.preventDefault(); window.api.quitApp(); break;
            case 'n': e.preventDefault(); newNote(); break;
            case 'p': e.preventDefault(); newProject(); break;
            case 'd': e.preventDefault(); deleteProject(); break;
            case '/': e.preventDefault(); showSearch(); break;
            case 'r': e.preventDefault(); refreshProjects(); break;
            case 'arrowdown':
                e.preventDefault();
                navigateSidebar(1);
                break;
            case 'arrowup':
                e.preventDefault();
                navigateSidebar(-1);
                break;
        }
    });

    editor.oninput = () => {
        state.dirty = editor.value !== state.originalContent;
        updateLineNumbers();
        if (state.dirty) {
            triggerAutoSave();
        }
    };

    editor.addEventListener('scroll', syncLineNumbersScroll);
    viewer.addEventListener('scroll', syncLineNumbersScroll);
    viewer.addEventListener('click', enterEditModeFromClick);
    window.addEventListener('resize', updateLineNumbers);

    searchInput.oninput = performSearch;
    searchInput.onkeydown = (e) => {
        if (e.key === 'ArrowDown') {
            searchResults.firstChild?.focus();
        }
    };
}

function navigateSidebar(direction) {
    const currentIndex = state.projects.findIndex(p => p.name === state.selectedProject?.name);
    let nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < state.projects.length) {
        selectProject(state.projects[nextIndex]);
    }
}

init();
