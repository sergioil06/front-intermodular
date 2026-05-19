document.addEventListener("DOMContentLoaded", () => {
    if (isLoggedIn()) {
        window.location.href = "tareas.html";
        return;
    }

    const formLogin = document.getElementById("form-login");
    const formReg = document.getElementById("form-registro");
    const tabLogin = document.getElementById("tab-login");
    const tabReg = document.getElementById("tab-registro");
    const errorLogin = document.getElementById("error-login");
    const errorReg = document.getElementById("error-registro");

    tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("activo");
        tabReg.classList.remove("activo");
        formLogin.classList.remove("oculto");
        formReg.classList.add("oculto");
    });

    tabReg.addEventListener("click", () => {
        tabReg.classList.add("activo");
        tabLogin.classList.remove("activo");
        formReg.classList.remove("oculto");
        formLogin.classList.add("oculto");
    });

    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorLogin.textContent = "";
        const username = document.getElementById("login-user").value.trim();
        const password = document.getElementById("login-pass").value;
        if (!username || !password) {
            errorLogin.textContent = "Introduce usuario y contraseña.";
            return;
        }
        const btnLogin = formLogin.querySelector("button");
        btnLogin.disabled = true;
        btnLogin.textContent = "Verificando...";
        try {
            const creds = btoa(username + ":" + password);
            const res = await fetch(API_TASK, {
                method: "GET",
                headers: { "Authorization": "Basic " + creds }
            });
            if (res.status === 401) {
                errorLogin.textContent = "Usuario o contraseña incorrectos.";
                return;
            }
            localStorage.setItem("username", username);
            localStorage.setItem("password", password);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && data[0].author) {
                // Intentar detectar rol usando admin endpoint
            }
            await detectarRol(username, password);
            window.location.href = "tareas.html";
        } catch (err) {
            errorLogin.textContent = "Error de conexión. ¿Está el backend arrancado?";
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = "Iniciar sesión";
        }
    });

    formReg.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorReg.textContent = "";
        const username = document.getElementById("reg-user").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-pass").value;
        const password2 = document.getElementById("reg-pass2").value;
        if (!username || !email || !password) {
            errorReg.textContent = "Rellena todos los campos.";
            return;
        }
        if (password !== password2) {
            errorReg.textContent = "Las contraseñas no coinciden.";
            return;
        }
        if (password.length < 4) {
            errorReg.textContent = "La contraseña debe tener al menos 4 caracteres.";
            return;
        }
        const btnReg = formReg.querySelector("button");
        btnReg.disabled = true;
        btnReg.textContent = "Registrando...";
        try {
            const res = await fetch(API_AUTH + "/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });
            if (res.status === 201 || res.status === 200) {
                localStorage.setItem("username", username);
                localStorage.setItem("password", password);
                localStorage.setItem("role", "USER");
                window.location.href = "tareas.html";
            } else {
                const err = await res.json().catch(() => ({}));
                errorReg.textContent = err.detail || "Error al registrar. El usuario puede ya existir.";
            }
        } catch {
            errorReg.textContent = "Error de conexión.";
        } finally {
            btnReg.disabled = false;
            btnReg.textContent = "Registrarse";
        }
    });
});

async function detectarRol(username, password) {
    try {
        const creds = btoa(username + ":" + password);
        const res = await fetch(API_ADMIN + "/users", {
            headers: { "Authorization": "Basic " + creds }
        });
        if (res.ok) {
            const users = await res.json();
            const me = users.find(u => u.username === username);
            if (me) {
                localStorage.setItem("role", me.role || "USER");
                return;
            }
        }
    } catch {}
    localStorage.setItem("role", "USER");
}
