const API_BASE = "https://todo-rest-api-0n1m.onrender.com";
const API_TASK = `${API_BASE}/task`;
const API_CATEGORY = `${API_BASE}/category`;
const API_TAG = `${API_BASE}/tag`;
const API_AUTH = `${API_BASE}/auth`;
const API_ADMIN = `${API_BASE}/admin`;
const API_PROFILE = `${API_BASE}/profile`;

function getAuthHeader() {
    const u = localStorage.getItem("username") || "";
    const p = localStorage.getItem("password") || "";
    return "Basic " + btoa(u + ":" + p);
}

function isLoggedIn() {
    return !!localStorage.getItem("username");
}

function getRole() {
    return localStorage.getItem("role") || "USER";
}

function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = "index.html";
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

async function apiFetch(url, options = {}) {
    const headers = {
        "Authorization": getAuthHeader(),
        "Content-Type": "application/json",
        ...options.headers
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        logout();
        throw new Error("No autorizado. Sesión cerrada.");
    }
    return res;
}

function showToast(msg, tipo = "ok") {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show " + tipo;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}

function deadlineToIso(val) {
    if (!val) return null;
    if (Array.isArray(val)) {
        const pad = n => String(n).padStart(2, "0");
        return `${val[0]}-${pad(val[1])}-${pad(val[2])}T${pad(val[3] || 0)}:${pad(val[4] || 0)}:${pad(val[5] || 0)}`;
    }
    return typeof val === "string" ? val : null;
}

function parseFecha(val) {
    if (!val) return null;
    if (Array.isArray(val)) {
        // Jackson array format: [year, month, day, hour, minute, second, nano]
        return new Date(val[0], val[1] - 1, val[2], val[3] || 0, val[4] || 0, val[5] || 0);
    }
    return new Date(val);
}

function formatFecha(val) {
    if (!val) return "—";
    const d = parseFecha(val);
    if (!d || isNaN(d)) return "—";
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function estadoDeadline(val) {
    if (!val) return "sin-fecha";
    const dl = parseFecha(val);
    if (!dl || isNaN(dl)) return "sin-fecha";
    const now = new Date();
    const diff = dl - now;
    if (diff < 0) return "vencida";
    if (diff < 86400000 * 3) return "proxima";
    return "ok";
}

function prioridadTexto(p) {
    return { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" }[p] || p || "—";
}

function prioridadClase(p) {
    return { ALTA: "prio-alta", MEDIA: "prio-media", BAJA: "prio-baja" }[p] || "";
}
