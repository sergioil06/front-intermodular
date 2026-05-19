document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    actualizarNavPorRol();
    document.getElementById("btn-logout").addEventListener("click", logout);

    const role = getRole();
    if (role === "USER") {
        const cardNueva = document.getElementById("card-nueva-cat");
        if (cardNueva) cardNueva.style.display = "none";
    }

    await cargarCategorias();

    document.getElementById("form-categoria").addEventListener("submit", async (e) => {
        e.preventDefault();
        await crearCategoria();
    });
});

async function cargarCategorias() {
    const lista = document.getElementById("lista-categorias");
    lista.innerHTML = "<li class='cargando'>Cargando...</li>";
    const role = getRole();
    const puedeEditar = role === "ADMIN" || role === "GESTOR";
    try {
        const res = await apiFetch(API_CATEGORY);
        if (!res.ok) throw new Error("Error al cargar categorías");
        const cats = await res.json();
        if (cats.length === 0) {
            lista.innerHTML = "<li class='sin-tareas'>No hay categorías todavía.</li>";
            return;
        }
        lista.innerHTML = cats.map(c => `
            <li class="cat-item" data-id="${c.id}">
                <span class="cat-nombre" id="nombre-${c.id}">${escHtml(c.title)}</span>
                <div class="cat-acciones">
                    ${puedeEditar ? `
                    <input type="text" class="input-edit-cat oculto" id="edit-${c.id}" value="${escHtml(c.title)}">
                    <button class="btn-sm btn-editar" onclick="activarEdicionCat(${c.id})">Editar</button>
                    <button class="btn-sm btn-guardar-cat oculto" onclick="guardarEdicionCat(${c.id})">Guardar</button>
                    <button class="btn-sm btn-cancelar-cat oculto" onclick="cancelarEdicionCat(${c.id})">Cancelar</button>
                    <button class="btn-sm btn-eliminar" onclick="eliminarCategoria(${c.id}, '${escHtml(c.title)}')">Eliminar</button>
                    ` : ""}
                </div>
            </li>`).join("");
    } catch (err) {
        lista.innerHTML = `<li class='error-msg'>${err.message}</li>`;
    }
}

async function crearCategoria() {
    const input = document.getElementById("input-nueva-cat");
    const titulo = input.value.trim();
    if (!titulo) { showToast("El nombre no puede estar vacío.", "error"); return; }
    const btn = document.getElementById("btn-crear-cat");
    btn.disabled = true;
    try {
        const res = await apiFetch(API_CATEGORY, {
            method: "POST",
            body: JSON.stringify({ title: titulo })
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        input.value = "";
        showToast("Categoría creada.", "ok");
        await cargarCategorias();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    } finally {
        btn.disabled = false;
    }
}

function activarEdicionCat(id) {
    document.getElementById("nombre-" + id).classList.add("oculto");
    document.getElementById("edit-" + id).classList.remove("oculto");
    const item = document.querySelector(`[data-id="${id}"]`);
    item.querySelector(".btn-editar").classList.add("oculto");
    item.querySelector(".btn-guardar-cat").classList.remove("oculto");
    item.querySelector(".btn-cancelar-cat").classList.remove("oculto");
}

function cancelarEdicionCat(id) {
    document.getElementById("nombre-" + id).classList.remove("oculto");
    document.getElementById("edit-" + id).classList.add("oculto");
    const item = document.querySelector(`[data-id="${id}"]`);
    item.querySelector(".btn-editar").classList.remove("oculto");
    item.querySelector(".btn-guardar-cat").classList.add("oculto");
    item.querySelector(".btn-cancelar-cat").classList.add("oculto");
}

async function guardarEdicionCat(id) {
    const nuevoNombre = document.getElementById("edit-" + id).value.trim();
    if (!nuevoNombre) { showToast("El nombre no puede estar vacío.", "error"); return; }
    try {
        const res = await apiFetch(API_CATEGORY + "/" + id, {
            method: "PUT",
            body: JSON.stringify({ title: nuevoNombre })
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast("Categoría actualizada.", "ok");
        await cargarCategorias();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

async function eliminarCategoria(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"? Las tareas de esta categoría quedarán sin categoría.`)) return;
    try {
        const res = await apiFetch(API_CATEGORY + "/" + id, { method: "DELETE" });
        if (!res.ok && res.status !== 204) throw new Error(`Error ${res.status}`);
        showToast(`Categoría "${nombre}" eliminada.`);
        await cargarCategorias();
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
