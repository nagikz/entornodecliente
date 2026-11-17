document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("suscripcionForm");
    const nombre = document.getElementById("nombre");
    const dni = document.getElementById("dni");
    const contenedor = document.getElementById("temasContainer");
    const precio = document.getElementById("precio");
    const errTipo = document.querySelector("#fsTipo .error");
    const errTemas = document.querySelector("#fsTemas .error");

    // Precios y nº de temas exigidos por tipo (Élite = todos)
    const PRECIOS = { basico: 5, estandar: 10, premium: 15, elite: 20 };
    const NUM_TEMAS = {
        basico: 1,
        estandar: 3,
        premium: 6,
        elite: TEMAS.length
    };
    const NOMBRES = {
        basico: "Básico",
        estandar: "Estándar",
        premium: "Premium",
        elite: "Élite"
    };

    //  Utilidades 
    const tipoActual = () =>
        document.querySelector('input[name="tipo"]:checked');
    const checksTemas = () =>
        contenedor.querySelectorAll('input[type="checkbox"]');
    const marcados = () =>
        contenedor.querySelectorAll('input[type="checkbox"]:checked');
    const setError = (elemento, msg) => { elemento.textContent = msg; };
    const errorDe = (input) => input.parentElement.querySelector(".error");

    //  4. Insertar los temas de temas.js 
    function crearTemas() {
        TEMAS.forEach((tema, i) => {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.name = "tema[]";
            input.id = "tema" + i;
            input.value = tema;

            const label = document.createElement("label");
            label.htmlFor = input.id;
            label.textContent = tema;

            contenedor.append(input, label, " ");
        });
    }

    //  3. Precio según el tipo 
    function actualizarPrecio() {
        const t = tipoActual();
        precio.textContent = t ? PRECIOS[t.value] + " €" : "";
    }

    // Élite: todos marcados por defecto. Otros tipos: se desmarcan para elegir.
    function ajustarTemasPorTipo() {
        const esElite = tipoActual().value === "elite";
        checksTemas().forEach(c => (c.checked = esElite));
        setError(errTemas, "");
    }

    //  1. Nombre en mayúsculas 
    nombre.addEventListener("input", () => {
        nombre.value = nombre.value.toUpperCase();
    });

    //  Validaciones 
    function validarNombre() {
        nombre.value = nombre.value.trim().toUpperCase();
        if (nombre.value.length < 3) {
            setError(errorDe(nombre),
                nombre.value === ""
                    ? "El nombre es obligatorio."
                    : "El nombre debe tener al menos 3 caracteres.");
            return false;
        }
        setError(errorDe(nombre), "");
        return true;
    }

    function validarDni() {
        const valor = dni.value.trim();
        if (valor === "") {
            setError(errorDe(dni), "El DNI es obligatorio.");
            return false;
        }
        if (!/^\d{8}-[A-Z]$/.test(valor) && !/^\d{8}[A-Z]$/.test(valor)) {
            setError(errorDe(dni),
                "Formato de DNI incorrecto. Debe ser 12345678A (8 números, guión y letra mayúscula).");
            return false;
        }
        setError(errorDe(dni), "");
        return true;
    }

    function validarTipo() {
        if (!tipoActual()) {
            setError(errTipo, "Debes seleccionar un tipo de suscripción.");
            return false;
        }
        setError(errTipo, "");
        return true;
    }

    function validarTemas() {
        const t = tipoActual();
        if (!t) return false;
        const requeridos = NUM_TEMAS[t.value];
        const n = marcados().length;
        if (n !== requeridos) {
            const msg = t.value === "elite"
                ? `La suscripción Élite requiere todos los temas (${requeridos}). Has marcado ${n}.`
                : `La suscripción ${NOMBRES[t.value]} requiere exactamente ${requeridos} tema${requeridos > 1 ? "s" : ""}. Has marcado ${n}.`;
            setError(errTemas, msg);
            return false;
        }
        setError(errTemas, "");
        return true;
    }

    //  Eventos 
    document.querySelectorAll('input[name="tipo"]').forEach(r =>
        r.addEventListener("change", () => {
            actualizarPrecio();
            ajustarTemasPorTipo();
        })
    );

    contenedor.addEventListener("change", validarTemas);

/*     form.addEventListener("submit", (e) => {
        // Evalua todo para mostrar los errores a la vez
        const resultados = [validarNombre(), validarDni(), validarTipo(), validarTemas()];
        if (resultados.includes(false)) {
            e.preventDefault();
        }
    }); */
    form.addEventListener("submit", (e) => {
    const resultados = [validarNombre(), validarDni(), validarTipo(), validarTemas()];
        if (resultados.includes(false)) {
            e.preventDefault();
        } else {
            e.preventDefault(); // SOLO PARA PRUEBAS: quitar al entregar
            console.log(Object.fromEntries(new FormData(form)));
            alert("Formulario válido");
        }
        });

    form.addEventListener("reset", () => {
        // El reset restaura los valores tras este evento, por eso el setTimeout
        setTimeout(() => {
            document.querySelectorAll(".error").forEach(s => (s.textContent = ""));
            actualizarPrecio();
            ajustarTemasPorTipo();
        }, 0);
    });

    // ---------- Inicialización ----------
    crearTemas();
    actualizarPrecio();   // Básico por defecto (checked en el HTML)
    ajustarTemasPorTipo();
});
