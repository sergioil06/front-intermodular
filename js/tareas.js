let tareaEditando = null;
let todasLasTareas = [];
let categorias = [];
let etiquetasDisponibles = [];

document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    actualizarNavPorRol();

    await Promise.all([cargarCategorias(), cargarEtiquetasForm()]);
    await cargarTareas();

    document.getElementById("btn-cargar").addEventListener("click", cargarTareas);
    document.getElementById("btn-nueva-tarea").addEventListener("click", abrirFormulario);
    document.getElementById("btn-cerrar-panel").addEventListener("click", cerrarFormulario);
    document.getElementById("form-overlay").addEventListener("click", (e) => {
        if (e.target === document.getElementById("form-overlay")) cerrarFormulario();
    });

    document.getElementById("form-tarea").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (tareaEditando) {
            await editarTarea(tareaEditando);
        } else {
            await crearTarea();
        }
    });

    document.getElementById("btn-cancelar").addEventListener("click", cancelarEdicion);

    document.getElementById("filtro-busqueda").addEventListener("input", filtrarTareas);
    document.getElementById("filtro-estado").addEventListener("change", filtrarTareas);
    document.getElementById("filtro-prioridad").addEventListener("change", filtrarTareas);
    document.getElementById("ordenar-por").addEventListener("change", filtrarTareas);

    document.getElementById("btn-logout").addEventListener("click", logout);
});

function abrirFormulario() {
    document.getElementById("form-overlay").classList.remove("oculto");
    document.getElementById("input-titulo").focus();
}

function cerrarFormulario() {
    document.getElementById("form-overlay").classList.add("oculto");
    cancelarEdicion();
}

// ===== FASE 1 y 2: GET tareas y pintar DOM =====
async function cargarTareas() {
    const lista = document.getElementById("lista-tareas");
    const contador = document.getElementById("contador-tareas");
    lista.innerHTML = '<tr><td colspan="7" class="cargando">Cargando tareas...</td></tr>';

    try {
        const res = await apiFetch(API_TASK);
        if (!res.ok) throw new Error("Error al cargar tareas");
        todasLasTareas = await res.json();
        filtrarTareas();
        actualizarDashboard();
        if (contador) contador.textContent = todasLasTareas.length;
    } catch (err) {
        lista.innerHTML = `<tr><td colspan="7" class="error-msg">${err.message}</td></tr>`;
    }
}

function filtrarTareas() {
    const busqueda = document.getElementById("filtro-busqueda").value.toLowerCase();
    const estado = document.getElementById("filtro-estado").value;
    const prioridad = document.getElementById("filtro-prioridad").value;
    const orden = document.getElementById("ordenar-por").value;

    let filtradas = [...todasLasTareas];

    if (busqueda) {
        filtradas = filtradas.filter(t =>
            t.title.toLowerCase().includes(busqueda) ||
            (t.description || "").toLowerCase().includes(busqueda)
        );
    }
    if (estado === "pendiente") filtradas = filtradas.filter(t => !t.completed);
    if (estado === "completada") filtradas = filtradas.filter(t => t.completed);
    if (prioridad) filtradas = filtradas.filter(t => t.priority === prioridad);

    filtradas.sort((a, b) => {
        if (orden === "deadline") {
            const da = a.deadline ? new Date(a.deadline) : new Date("9999");
            const db = b.deadline ? new Date(b.deadline) : new Date("9999");
            return da - db;
        }
        if (orden === "prioridad") {
            const ord = { ALTA: 0, MEDIA: 1, BAJA: 2 };
            return (ord[a.priority] ?? 3) - (ord[b.priority] ?? 3);
        }
        if (orden === "titulo") return a.title.localeCompare(b.title);
        // Por defecto: createdAt desc
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    pintarTareas(filtradas);
}

function pintarTareas(tareas) {
    const lista = document.getElementById("lista-tareas");
    const contador = document.getElementById("contador-filtradas");

    if (contador) contador.textContent = tareas.length;

    if (tareas.length === 0) {
        lista.innerHTML = '<tr><td colspan="7" class="sin-tareas">No hay tareas que mostrar.</td></tr>';
        return;
    }

    lista.innerHTML = tareas.map(t => {
        const estadoDl = estadoDeadline(t.deadline);
        const claseEstado = `estado-dl-${estadoDl}`;
        const etiquetas = t.tags && t.tags.size > 0 ? [...t.tags].join(", ") : (t.tags ? [...t.tags].join(", ") : "—");
        const tagsStr = t.tags ? (Array.isArray(t.tags) ? t.tags : [...t.tags]).join(", ") || "—" : "—";

        return `
        <tr class="${t.completed ? "completada-fila" : ""} ${claseEstado}" data-id="${t.id}">
            <td>
                <label class="check-wrap">
                    <input type="checkbox" class="check-completada" data-id="${t.id}" ${t.completed ? "checked" : ""}>
                    <span class="titulo-tarea ${t.completed ? "tachado" : ""}">${escHtml(t.title)}</span>
                </label>
            </td>
            <td class="desc-col">${escHtml(t.description || "—")}</td>
            <td><span class="badge ${prioridadClase(t.priority)}">${prioridadTexto(t.priority)}</span></td>
            <td class="fecha-col ${estadoDl}">${formatFecha(t.deadline)}</td>
            <td>${escHtml(t.categoryName || "—")}</td>
            <td class="tags-col">${escHtml(tagsStr)}</td>
            <td class="acciones-col">
                <button class="btn-editar btn-sm" data-id="${t.id}">Editar</button>
                <button class="btn-eliminar btn-sm" data-id="${t.id}">Eliminar</button>
            </td>
        </tr>`;
    }).join("");

    // Eventos checkboxes (toggle completada)
    lista.querySelectorAll(".check-completada").forEach(cb => {
        cb.addEventListener("change", () => toggleCompletada(Number(cb.dataset.id), cb.checked));
    });

    // Botones editar
    lista.querySelectorAll(".btn-editar").forEach(btn => {
        btn.addEventListener("click", () => abrirEdicion(Number(btn.dataset.id)));
    });

    // Botones eliminar (Fase 5 del PDF)
    lista.querySelectorAll(".btn-eliminar").forEach(btn => {
        btn.addEventListener("click", () => confirmarEliminar(Number(btn.dataset.id)));
    });
}

// ===== FASE 3: POST crear tarea =====
async function crearTarea() {
    const titulo = document.getElementById("input-titulo").value.trim();
    const descripcion = document.getElementById("input-descripcion").value.trim();
    const fecha = document.getElementById("input-fecha").value;
    const prioridad = document.getElementById("input-prioridad").value;
    const categoriaId = document.getElementById("input-categoria").value;

    if (!titulo) {
        mostrarErrorForm("El título no puede estar vacío.");
        return;
    }
    if (!fecha) {
        mostrarErrorForm("La fecha límite es obligatoria.");
        return;
    }
    const deadlineFecha = new Date(fecha);
    if (deadlineFecha < new Date()) {
        mostrarErrorForm("La fecha no puede ser anterior a la actual.");
        return;
    }

    const tarea = {
        title: titulo,
        description: descripcion,
        deadline: fecha + ":00",
        priority: prioridad || null,
        categoryId: categoriaId ? Number(categoriaId) : null,
        completed: false
    };

    const btn = document.getElementById("btn-guardar");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    // Etiquetas seleccionadas en el multi-select
    const selTags = document.getElementById("input-tags");
    const tagIdsSeleccionados = selTags
        ? [...selTags.selectedOptions].map(o => o.value).filter(Boolean)
        : [];

    try {
        const res = await apiFetch(API_TASK, {
            method: "POST",
            body: JSON.stringify(tarea)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Error ${res.status}`);
        }
        const data = await res.json();

        // Asignar etiquetas seleccionadas una a una
        for (const tagId of tagIdsSeleccionados) {
            await apiFetch(`${API_TAG}/assign/${data.id}/${tagId}`, { method: "PUT" }).catch(() => {});
        }

        showToast(`Tarea "${data.title}" creada correctamente.`);
        cerrarFormulario();
        await cargarTareas();
        actualizarDashboard();
    } catch (err) {
        mostrarErrorForm(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Crear tarea";
    }
}

// ===== FASE 5: DELETE borrar tarea =====
async function confirmarEliminar(id) {
    const tarea = todasLasTareas.find(t => t.id === id);
    const nombre = tarea ? tarea.title : `#${id}`;
    if (!confirm(`¿Eliminar la tarea "${nombre}"?`)) return;

    try {
        const res = await apiFetch(API_TASK + "/" + id, { method: "DELETE" });
        if (!res.ok && res.status !== 204) throw new Error(`Error ${res.status}`);
        showToast(`Tarea "${nombre}" eliminada.`, "ok");
        await cargarTareas(); // Fase 4: recargar automáticamente
        actualizarDashboard();
    } catch (err) {
        showToast("Error al eliminar: " + err.message, "error");
    }
}

// ===== Editar tarea (PUT) =====
function abrirEdicion(id) {
    const tarea = todasLasTareas.find(t => t.id === id);
    if (!tarea) return;
    tareaEditando = id;

    document.getElementById("input-titulo").value = tarea.title;
    document.getElementById("input-descripcion").value = tarea.description || "";
    if (tarea.deadline) {
        const dl = parseFecha(tarea.deadline);
        if (dl && !isNaN(dl)) {
            const local = new Date(dl.getTime() - dl.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            document.getElementById("input-fecha").value = local;
        }
    }
    document.getElementById("input-prioridad").value = tarea.priority || "";

    const tituloForm = document.getElementById("titulo-formulario");
    tituloForm.textContent = "Editar tarea";
    document.getElementById("btn-guardar").textContent = "Guardar cambios";
    const grupoTags = document.getElementById("grupo-tags-form");
    if (grupoTags) grupoTags.style.display = "none";
    abrirFormulario();
}

async function editarTarea(id) {
    const titulo = document.getElementById("input-titulo").value.trim();
    const descripcion = document.getElementById("input-descripcion").value.trim();
    const fecha = document.getElementById("input-fecha").value;
    const prioridad = document.getElementById("input-prioridad").value;
    const categoriaId = document.getElementById("input-categoria").value;

    if (!titulo) { mostrarErrorForm("El título no puede estar vacío."); return; }
    if (!fecha) { mostrarErrorForm("La fecha límite es obligatoria."); return; }

    const tarea = {
        title: titulo,
        description: descripcion,
        deadline: fecha + ":00",
        priority: prioridad || null,
        categoryId: categoriaId ? Number(categoriaId) : null,
        completed: todasLasTareas.find(t => t.id === id)?.completed || false
    };

    const btn = document.getElementById("btn-guardar");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        const res = await apiFetch(API_TASK + "/" + id, {
            method: "PUT",
            body: JSON.stringify(tarea)
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast("Tarea actualizada correctamente.");
        cerrarFormulario();
        await cargarTareas();
        actualizarDashboard();
    } catch (err) {
        mostrarErrorForm(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Guardar cambios";
    }
}

async function toggleCompletada(id, completada) {
    const tarea = todasLasTareas.find(t => t.id === id);
    if (!tarea) return;
    const cat = categorias.find(c => c.title === tarea.categoryName);
    const categoryId = cat ? cat.id : null;
    const deadline = deadlineToIso(tarea.deadline);
    try {
        const res = await apiFetch(API_TASK + "/" + id, {
            method: "PUT",
            body: JSON.stringify({
                title: tarea.title,
                description: tarea.description,
                deadline: deadline,
                priority: tarea.priority,
                completed: completada,
                categoryId: categoryId
            })
        });
        if (!res.ok) throw new Error();
        await cargarTareas();
        actualizarDashboard();
    } catch {
        showToast("Error al actualizar el estado.", "error");
        await cargarTareas();
    }
}

function cancelarEdicion() {
    tareaEditando = null;
    limpiarFormulario();
    document.getElementById("titulo-formulario").textContent = "Nueva tarea";
    document.getElementById("btn-guardar").textContent = "Crear tarea";
    const grupoTags = document.getElementById("grupo-tags-form");
    if (grupoTags) grupoTags.style.display = "";
}

function limpiarFormulario() {
    document.getElementById("form-tarea").reset();
    document.getElementById("error-form").textContent = "";
}

function mostrarErrorForm(msg) {
    const el = document.getElementById("error-form");
    if (el) el.textContent = msg;
}

// ===== Dashboard =====
function actualizarDashboard() {
    const el = id => document.getElementById(id);
    if (el("dash-total")) el("dash-total").textContent = todasLasTareas.length;
    if (el("dash-completadas")) el("dash-completadas").textContent = todasLasTareas.filter(t => t.completed).length;
    if (el("dash-pendientes")) el("dash-pendientes").textContent = todasLasTareas.filter(t => !t.completed).length;
    if (el("dash-alta")) el("dash-alta").textContent = todasLasTareas.filter(t => t.priority === "ALTA").length;
}

// ===== Etiquetas en el formulario de nueva tarea =====
async function cargarEtiquetasForm() {
    try {
        const res = await apiFetch(API_TAG);
        if (!res.ok) return;
        etiquetasDisponibles = await res.json();
        const sel = document.getElementById("input-tags");
        if (!sel) return;
        sel.innerHTML = "";
        etiquetasDisponibles.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name;
            sel.appendChild(opt);
        });
        if (etiquetasDisponibles.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.disabled = true;
            opt.textContent = "No hay etiquetas creadas";
            sel.appendChild(opt);
        }
    } catch {}
}

// ===== Categorías en select del formulario =====
async function cargarCategorias() {
    try {
        const res = await apiFetch(API_CATEGORY);
        if (!res.ok) return;
        categorias = await res.json();
        const sel = document.getElementById("input-categoria");
        if (!sel) return;
        categorias.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.title;
            sel.appendChild(opt);
        });
    } catch {}
}

// ===== Rol en la navegación =====
function actualizarNavPorRol() {
    const role = getRole();
    const linkAdmin = document.getElementById("link-admin");
    if (linkAdmin) {
        linkAdmin.style.display = (role === "ADMIN") ? "inline" : "none";
    }
    const userSpan = document.getElementById("nav-usuario");
    if (userSpan) {
        const u = localStorage.getItem("username");
        userSpan.textContent = u ? `Hola, ${u}` : "";
    }
}

function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
