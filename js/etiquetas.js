let tagsGlobal = [];
let tareasGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    actualizarNavPorRol();
    document.getElementById("btn-logout").addEventListener("click", logout);
    await cargarEtiquetas();
    await cargarTareasParaAsignar();

    document.getElementById("form-etiqueta").addEventListener("submit", async (e) => {
        e.preventDefault();
        await crearEtiqueta();
    });

    document.getElementById("form-asignar").addEventListener("submit", async (e) => {
        e.preventDefault();
        await asignarEtiqueta();
    });

    document.getElementById("form-quitar").addEventListener("submit", async (e) => {
        e.preventDefault();
        await quitarEtiqueta();
    });

    // Al seleccionar tarea en "quitar", mostrar solo sus etiquetas
    document.getElementById("sel-tarea-quitar").addEventListener("change", actualizarTagsQuitar);
});

async function cargarEtiquetas() {
    const lista = document.getElementById("lista-etiquetas");
    lista.innerHTML = "<li class='cargando'>Cargando...</li>";
    try {
        const res = await apiFetch(API_TAG);
        if (!res.ok) throw new Error("Error al cargar etiquetas");
        tagsGlobal = await res.json();

        const selAsignar = document.getElementById("sel-tag-asignar");
        if (selAsignar) {
            selAsignar.innerHTML = '<option value="">-- Etiqueta --</option>';
            tagsGlobal.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.id;
                opt.textContent = t.name;
                selAsignar.appendChild(opt);
            });
        }

        if (tagsGlobal.length === 0) {
            lista.innerHTML = "<li class='sin-tareas'>No hay etiquetas todavía.</li>";
            return;
        }
        lista.innerHTML = tagsGlobal.map(t => `
            <li class="tag-item" data-id="${t.id}">
                <span class="tag-badge">${escHtml(t.name)}</span>
                <div class="tag-acciones">
                    <input type="text" class="input-edit-tag oculto" id="edit-tag-${t.id}" value="${escHtml(t.name)}">
                    <button class="btn-sm btn-editar" onclick="activarEdicionTag(${t.id})">Editar</button>
                    <button class="btn-sm btn-guardar-tag oculto" onclick="guardarEdicionTag(${t.id})">Guardar</button>
                    <button class="btn-sm btn-cancelar-tag oculto" onclick="cancelarEdicionTag(${t.id})">Cancelar</button>
                    <button class="btn-sm btn-eliminar" onclick="eliminarEtiqueta(${t.id}, '${escHtml(t.name)}')">Eliminar</button>
                </div>
            </li>`).join("");
    } catch (err) {
        lista.innerHTML = `<li class='error-msg'>${err.message}</li>`;
    }
}

async function cargarTareasParaAsignar() {
    const selTareaA = document.getElementById("sel-tarea-asignar");
    const selTareaQ = document.getElementById("sel-tarea-quitar");
    try {
        const res = await apiFetch(API_TASK);
        if (!res.ok) return;
        tareasGlobal = await res.json();
        const opts = '<option value="">-- Tarea --</option>' +
            tareasGlobal.map(t => `<option value="${t.id}">${escHtml(t.title)}</option>`).join("");
        if (selTareaA) selTareaA.innerHTML = opts;
        if (selTareaQ) selTareaQ.innerHTML = opts;
        // Inicializar el select de etiquetas quitar vacío
        actualizarTagsQuitar();
    } catch {}
}

function actualizarTagsQuitar() {
    const selTareaQ = document.getElementById("sel-tarea-quitar");
    const selTagQ = document.getElementById("sel-tag-quitar");
    if (!selTareaQ || !selTagQ) return;

    const tareaId = Number(selTareaQ.value);
    if (!tareaId) {
        selTagQ.innerHTML = '<option value="">-- Selecciona una tarea primero --</option>';
        selTagQ.disabled = true;
        return;
    }

    const tarea = tareasGlobal.find(t => t.id === tareaId);
    const tagNombres = tarea && tarea.tags ? [...tarea.tags] : [];

    if (tagNombres.length === 0) {
        selTagQ.innerHTML = '<option value="">Esta tarea no tiene etiquetas</option>';
        selTagQ.disabled = true;
        return;
    }

    // Cruzar nombres con tagsGlobal para obtener los IDs
    const tagsDeEstaTarea = tagsGlobal.filter(tg => tagNombres.includes(tg.name));

    selTagQ.disabled = false;
    selTagQ.innerHTML = '<option value="">-- Etiqueta a quitar --</option>' +
        tagsDeEstaTarea.map(tg => `<option value="${tg.id}">${escHtml(tg.name)}</option>`).join("");
}

async function crearEtiqueta() {
    const input = document.getElementById("input-nueva-tag");
    const nombre = input.value.trim();
    if (!nombre) { showToast("El nombre no puede estar vacío.", "error"); return; }
    const btn = document.getElementById("btn-crear-tag");
    btn.disabled = true;
    try {
        const res = await apiFetch(API_TAG, {
            method: "POST",
            body: JSON.stringify({ name: nombre })
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        input.value = "";
        showToast("Etiqueta creada.", "ok");
        await cargarEtiquetas();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    } finally {
        btn.disabled = false;
    }
}

async function asignarEtiqueta() {
    const tareaId = document.getElementById("sel-tarea-asignar").value;
    const tagId = document.getElementById("sel-tag-asignar").value;
    if (!tareaId || !tagId) { showToast("Selecciona tarea y etiqueta.", "error"); return; }
    try {
        const res = await apiFetch(`${API_TAG}/assign/${tareaId}/${tagId}`, { method: "PUT" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast("Etiqueta asignada correctamente.", "ok");
        // Recargar tareas para que el select de quitar se actualice
        await cargarTareasParaAsignar();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

async function quitarEtiqueta() {
    const tareaId = document.getElementById("sel-tarea-quitar").value;
    const tagId = document.getElementById("sel-tag-quitar").value;
    if (!tareaId || !tagId) { showToast("Selecciona tarea y etiqueta.", "error"); return; }
    try {
        const res = await apiFetch(`${API_TAG}/remove/${tareaId}/${tagId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast("Etiqueta quitada correctamente.", "ok");
        // Recargar tareas y actualizar el select de quitar
        await cargarTareasParaAsignar();
        // Mantener la tarea seleccionada y refrescar sus tags
        document.getElementById("sel-tarea-quitar").value = tareaId;
        actualizarTagsQuitar();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

function activarEdicionTag(id) {
    document.querySelector(`[data-id="${id}"] .tag-badge`).classList.add("oculto");
    document.getElementById("edit-tag-" + id).classList.remove("oculto");
    const item = document.querySelector(`[data-id="${id}"]`);
    item.querySelector(".btn-editar").classList.add("oculto");
    item.querySelector(".btn-guardar-tag").classList.remove("oculto");
    item.querySelector(".btn-cancelar-tag").classList.remove("oculto");
}

function cancelarEdicionTag(id) {
    document.querySelector(`[data-id="${id}"] .tag-badge`).classList.remove("oculto");
    document.getElementById("edit-tag-" + id).classList.add("oculto");
    const item = document.querySelector(`[data-id="${id}"]`);
    item.querySelector(".btn-editar").classList.remove("oculto");
    item.querySelector(".btn-guardar-tag").classList.add("oculto");
    item.querySelector(".btn-cancelar-tag").classList.add("oculto");
}

async function guardarEdicionTag(id) {
    const nuevoNombre = document.getElementById("edit-tag-" + id).value.trim();
    if (!nuevoNombre) { showToast("El nombre no puede estar vacío.", "error"); return; }
    try {
        const res = await apiFetch(API_TAG + "/" + id, {
            method: "PUT",
            body: JSON.stringify({ name: nuevoNombre })
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast("Etiqueta actualizada.", "ok");
        await cargarEtiquetas();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

async function eliminarEtiqueta(id, nombre) {
    if (!confirm(`¿Eliminar la etiqueta "${nombre}"?`)) return;
    try {
        const res = await apiFetch(API_TAG + "/" + id, { method: "DELETE" });
        if (!res.ok && res.status !== 204) throw new Error(`Error ${res.status}`);
        showToast(`Etiqueta "${nombre}" eliminada.`);
        await cargarEtiquetas();
        await cargarTareasParaAsignar();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

function actualizarNavPorRol() {
    const role = getRole();
    const linkAdmin = document.getElementById("link-admin");
    if (linkAdmin) linkAdmin.style.display = (role === "ADMIN") ? "inline" : "none";
    const userSpan = document.getElementById("nav-usuario");
    if (userSpan) userSpan.textContent = `Hola, ${localStorage.getItem("username") || ""}`;
}

function escHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
