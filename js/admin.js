document.addEventListener("DOMContentLoaded", async () => {
    requireAuth();
    if (getRole() !== "ADMIN") {
        showToast("Acceso restringido a administradores.", "error");
        setTimeout(() => window.location.href = "tareas.html", 1500);
        return;
    }
    document.getElementById("btn-logout").addEventListener("click", logout);
    const userSpan = document.getElementById("nav-usuario");
    if (userSpan) userSpan.textContent = `Hola, ${localStorage.getItem("username") || ""}`;
    await cargarUsuarios();
});

async function cargarUsuarios() {
    const tbody = document.getElementById("lista-usuarios");
    tbody.innerHTML = '<tr><td colspan="4" class="cargando">Cargando usuarios...</td></tr>';
    try {
        const res = await apiFetch(API_ADMIN + "/users");
        if (res.status === 403) {
            tbody.innerHTML = '<tr><td colspan="4" class="error-msg">Sin permisos de administrador.</td></tr>';
            return;
        }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const users = await res.json();
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="sin-tareas">No hay usuarios.</td></tr>';
            return;
        }
        const miUsername = localStorage.getItem("username");
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${escHtml(u.username)}</td>
                <td><span class="badge rol-${(u.role || "USER").toLowerCase()}">${u.role || "USER"}</span></td>
                <td class="acciones-col">
                    ${u.username !== miUsername ? `
                    ${(u.role === "USER") ? `<button class="btn-sm btn-editar" onclick="promoverUsuario(${u.id})">Promover a GESTOR</button>` : ""}
                    ${(u.role === "GESTOR") ? `<button class="btn-sm btn-eliminar" onclick="degradarUsuario(${u.id})">Degradar a USER</button>` : ""}
                    ` : '<span class="muted">(tú)</span>'}
                </td>
            </tr>`).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="error-msg">${err.message}</td></tr>`;
    }
}

async function promoverUsuario(id) {
    if (!confirm("¿Promover este usuario a GESTOR?")) return;
    try {
        const res = await apiFetch(API_ADMIN + "/promote/" + id, { method: "PUT" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast("Usuario promovido a GESTOR.", "ok");
        await cargarUsuarios();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

async function degradarUsuario(id) {
    if (!confirm("¿Degradar este usuario a USER?")) return;
    try {
        const res = await apiFetch(API_ADMIN + "/demote/" + id, { method: "PUT" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast("Usuario degradado a USER.", "ok");
        await cargarUsuarios();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    }
}

function escHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
