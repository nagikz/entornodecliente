/*
 * SIMULACRO: INSCRIPCIÓN AL GIMNASIO
 * Requiere en el HTML: actividades.js cargado ANTES que este script
 * (de ahí sale el array global "actividades").
 */

// PUNTO 1: Esperar a que el HTML esté cargado.
// Si buscamos elementos antes de que existan, getElementById devuelve null y todo falla.
// TODO el código va dentro de esta función.
document.addEventListener("DOMContentLoaded", () => {

    // =====================================================
    // PUNTO 2: Localizar los elementos del DOM (una sola vez, al principio)
    // =====================================================
    // getElementById solo existe en "document" y recibe solo el id (sin #).
    const formulario = document.getElementById("formulario");
    const nombre = document.getElementById("nombre");
    const errorNombre = document.getElementById("error-nombre");
    const codigo = document.getElementById("codigo");
    const errorCodigo = document.getElementById("error-codigo");
    // querySelectorAll devuelve una LISTA de radios (por eso el nombre en plural).
    const planes = formulario.querySelectorAll('input[name="plan"]');
    const precio = document.getElementById("precio");
    // Se llama "contenedorActividades" para no chocar con el array global "actividades".
    const contenedorActividades = document.getElementById("actividades");
    const errorAct = document.getElementById("error-actividades");
    const infoAct = document.getElementById("info-actividades");
    // "historial" es el <ul>. Dentro de funciones, el array de datos se llama "lista"
    // para no tapar esta constante.
    const historial = document.getElementById("historial");
    const botonBorrarHistorial = document.getElementById("borrar-historial");

    // =====================================================
    // PUNTO 3: Objetos de búsqueda (evitan muchos if/else)
    // =====================================================
    // Clave = value del radio. Se usan así: precios[plan]
    // (corchetes porque la clave está en una variable).
    const precios = {
        mensual: 30,
        trimestral: 80,
        semestral: 150,
        anual: 270
    };
    // Número EXACTO de actividades que exige cada plan.
    // En anual son todas, así que usamos la longitud del array de actividades.js.
    const numActividades = {
        mensual: 2,
        trimestral: 4,
        semestral: 6,
        anual: actividades.length
    };

    // =====================================================
    // PUNTO 4: Claves de almacenamiento como constantes
    // =====================================================
    // Constantes = no te equivocas al escribir el texto a mano cada vez.
    // El prefijo "gimnasio_" evita chocar con otros datos del mismo origen.
    const CLAVE_BORRADOR = "gimnasio_borrador";   // sessionStorage (se pierde al cerrar pestaña)
    const CLAVE_PLAN = "gimnasio_plan";           // localStorage (permanente)
    const CLAVE_HISTORIAL = "gimnasio_historial"; // localStorage (permanente)

    // =====================================================
    // PUNTO 5: Expresión regular del código de socio (AB-1234)
    // =====================================================
    // ^        inicio del texto (sin nada antes)
    // [A-Z]{2} dos letras mayúsculas
    // -        un guion
    // \d{4}    cuatro dígitos
    // $        final del texto (sin nada después)
    const regexCodigo = /^[A-Z]{2}-\d{4}$/;

    // =====================================================
    // VALIDACIONES
    // Patrón: devuelven true (correcto) o false (incorrecto)
    // y escriben/borran el mensaje de error.
    // =====================================================

    // PUNTO 6: Nombre, mínimo 4 caracteres.
    function validarNombre() {
        // trim() quita espacios de los extremos, SOLO para contar.
        // No lo asignamos al input o el usuario no podría escribir espacios.
        const texto = nombre.value.trim();
        if (texto.length < 4) {
            errorNombre.textContent = "El nombre debe tener al menos 4 caracteres";
            return false; // el return corta la función: no se llega a las líneas de abajo
        }
        errorNombre.textContent = ""; // todo bien: borramos el error
        return true;
    }

    // PUNTO 7: Código, obligatorio y con formato correcto.
    function validarCodigo() {
        const texto = codigo.value.trim();
        // Primero "vacío" y después "formato": si no, un campo vacío
        // mostraría "formato incorrecto" en vez de "obligatorio".
        if (texto === "") {
            errorCodigo.textContent = "El código es obligatorio";
            return false;
        }
        // .test() devuelve true si cumple la regex; con ! comprobamos que NO cumple.
        if (!regexCodigo.test(texto)) {
            errorCodigo.textContent = "Formato incorrecto (ejemplo: AB-1234)";
            return false;
        }
        errorCodigo.textContent = "";
        return true;
    }

    // PUNTO 8: Número exacto de actividades según el plan.
    function validarActividades() {
        const plan = obtenerPlan();
        const marcadas = obtenerActividadesMarcadas();
        // !== es comparación estricta (sin conversión de tipos).
        if (marcadas !== numActividades[plan]) {
            errorAct.textContent = "Debes marcar exactamente " + numActividades[plan] + " actividades";
            return false;
        }
        errorAct.textContent = "";
        return true;
    }

    // =====================================================
    // PLAN Y PRECIO
    // =====================================================

    // PUNTO 9: Devuelve el value del radio marcado ("mensual", "anual"...).
    // :checked selecciona solo el radio marcado y .value saca su texto.
    // Sin .value devolverías el elemento <input> entero.
    function obtenerPlan() {
        return document.querySelector('input[name="plan"]:checked').value;
    }

    // PUNTO 10: Escribe el precio del plan marcado.
    function actualizarPrecio() {
        const plan = obtenerPlan();
        precio.textContent = precios[plan] + " €";
    }

    // =====================================================
    // ACTIVIDADES
    // =====================================================

    // PUNTO 11: Generar los checkboxes desde el array de actividades.js.
    // El HTML NO debe tener el <label> de Yoga de ejemplo o saldría duplicado.
    function pintarActividades() {
        contenedorActividades.innerHTML = ""; // vaciar (un <div> se vacía con innerHTML, no con value)
        actividades.forEach(act => {
            // "act" es un objeto del array: { id: "yoga", nombre: "Yoga" }
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.name = "actividades";
            input.value = act.id;               // value = identificador interno
            label.append(input, " " + act.nombre); // texto visible = nombre
            label.style.display = "block";      // uno por línea (solo estética)
            contenedorActividades.append(label);
        });
    }

    // PUNTO 12: Cuenta (devuelve un NÚMERO) cuántos checkboxes están marcados.
    function obtenerActividadesMarcadas() {
        return contenedorActividades.querySelectorAll('input[type="checkbox"]:checked').length;
    }

    // PUNTO 13: Al cambiar de plan, marcar todas (anual) o ninguna (resto)
    // y actualizar el mensaje de cuántas hay que elegir.
    function actualizarActividades() {
        const plan = obtenerPlan();
        const checkboxes = contenedorActividades.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            // (plan === "anual") da true o false: marca o desmarca sin necesidad de if/else
            cb.checked = (plan === "anual");
        });
        infoAct.textContent = "Debes elegir exactamente " + numActividades[plan] + " actividades";
    }

    // =====================================================
    // BORRADOR (sessionStorage)
    // =====================================================

    // PUNTO 14: Guardar lo que el usuario va escribiendo.
    function guardarBorrador() {
        const marcadas = contenedorActividades.querySelectorAll('input[type="checkbox"]:checked');
        // Array.from convierte la lista en array; map se queda solo con el value de cada uno.
        const ids = Array.from(marcadas).map(cb => cb.value);
        const borrador = {
            nombre: nombre.value,
            codigo: codigo.value,
            plan: obtenerPlan(),
            actividades: ids
        };
        // try...catch: el almacenamiento puede fallar (por ejemplo, cuota llena).
        try {
            // El storage solo guarda TEXTO, por eso JSON.stringify.
            sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
        } catch (error) {
            console.error("Error al guardar el borrador:", error);
        }
    }

    // PUNTO 15: Restaurar el borrador al recargar la página.
    function restaurarBorrador() {
        try {
            const raw = sessionStorage.getItem(CLAVE_BORRADOR);
            // getItem devuelve null si la clave no existe: comprobar antes de JSON.parse.
            if (raw === null) return; // no hay borrador: salimos

            const datos = JSON.parse(raw); // de texto a objeto
            nombre.value = datos.nombre;
            codigo.value = datos.codigo;
            planes.forEach(radio => {
                radio.checked = (radio.value === datos.plan);
            });
            actualizarPrecio(); // el precio debe coincidir con el plan restaurado
            const checkboxes = contenedorActividades.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                // includes: ¿está el value de este checkbox en el array guardado?
                cb.checked = datos.actividades.includes(cb.value);
            });
            // OJO: aquí NO llamamos a actualizarActividades(), porque desmarcaría todo salvo en anual.
            infoAct.textContent = "Debes elegir exactamente " + numActividades[datos.plan] + " actividades";
        } catch (error) {
            console.error("Error al restaurar el borrador:", error);
        }
    }

    // =====================================================
    // PLAN PREFERIDO (localStorage)
    // =====================================================

    // PUNTO 16: Marcar al cargar el último plan enviado con éxito.
    // Es un texto simple: no hace falta JSON.
    function cargarPlanPreferido() {
        try {
            const planGuardado = localStorage.getItem(CLAVE_PLAN); // getItem solo recibe la clave
            if (planGuardado !== null) {
                planes.forEach(radio => {
                    radio.checked = (radio.value === planGuardado);
                });
            }
        } catch (error) {
            console.error("No se ha podido leer el plan preferido:", error);
        }
    }

    // =====================================================
    // HISTORIAL (localStorage, array de objetos)
    // =====================================================

    // PUNTO 17: Leer el historial. SIEMPRE devuelve un array
    // (si no devolviera nada, luego lista.push() daría error).
    function leerHistorial() {
        try {
            const raw = localStorage.getItem(CLAVE_HISTORIAL);
            if (raw === null) {
                return []; // primera vez: no hay historial
            }
            return JSON.parse(raw);
        } catch (error) {
            console.error("Error al cargar el historial:", error);
            return []; // si el JSON está corrupto, empezamos de cero
        }
    }

    // PUNTO 18: Añadir una inscripción al historial.
    function guardarEnHistorial() {
        // Primero LEER lo anterior y después AÑADIR: si guardaras solo la nueva,
        // machacarías las inscripciones anteriores.
        const lista = leerHistorial();
        const marcadas = contenedorActividades.querySelectorAll('input[type="checkbox"]:checked');
        const inscripcion = {
            nombre: nombre.value,
            codigo: codigo.value,
            plan: obtenerPlan(),
            actividades: Array.from(marcadas).map(cb => cb.value), // ids, no elementos del DOM
            fecha: new Date().toLocaleString() // fecha y hora en texto
        };
        lista.push(inscripcion);
        try {
            // Se guarda el array ENTERO (lista), no solo la inscripción nueva.
            localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(lista));
        } catch (error) {
            console.error("No se ha podido guardar el historial:", error);
        }
    }

    // PUNTO 19: Dibujar el historial en el <ul>.
    function pintarHistorial() {
        const lista = leerHistorial();
        historial.innerHTML = ""; // vaciar para no duplicar al repintar
        lista.forEach(ins => {
            const li = document.createElement("li");
            li.textContent = ins.nombre + " (" + ins.codigo + ") - " + ins.plan +
                " - " + ins.actividades.length + " actividades - " + ins.fecha;
            historial.append(li);
        });
    }

    // =====================================================
    // EVENTOS
    // =====================================================

    // PUNTO 20: Nombre en mayúsculas mientras se escribe + validación en vivo.
    // Evento "input": salta con cada tecla. "() =>" sin parámetro porque ya tenemos la constante "nombre".
    nombre.addEventListener("input", () => {
        // toUpperCase() NO modifica el texto, devuelve uno nuevo: hay que reasignarlo.
        nombre.value = nombre.value.toUpperCase();
        validarNombre();
    });

    // PUNTO 21: Código en mayúsculas + validación en vivo.
    codigo.addEventListener("input", () => {
        codigo.value = codigo.value.toUpperCase();
        validarCodigo();
    });

    // PUNTO 22: Cambio de plan.
    // "planes" es una lista: hay que recorrerla y poner el listener a CADA radio.
    // El evento de los radios es "change", no "input".
    planes.forEach(radio => {
        radio.addEventListener("change", () => {
            actualizarPrecio();
            actualizarActividades();
            validarActividades(); // refresca el error según las nuevas marcadas
        });
    });

    // PUNTO 23: DELEGACIÓN DE EVENTOS.
    // Un solo listener en el contenedor sirve para todos los checkboxes
    // (el evento "change" sube desde cada checkbox hasta el contenedor).
    contenedorActividades.addEventListener("change", validarActividades);

    // PUNTO 24: Autoguardado del borrador.
    // También delegación: input y change suben hasta el formulario,
    // así que no hace falta un listener por campo.
    formulario.addEventListener("input", guardarBorrador);
    formulario.addEventListener("change", guardarBorrador);

    // PUNTO 25: Botón "Borrar historial".
    botonBorrarHistorial.addEventListener("click", () => {
        try {
            // removeItem borra SOLO esta clave (clear() borraría todo el origen).
            localStorage.removeItem(CLAVE_HISTORIAL);
        } catch (error) {
            console.error("Error al borrar el historial:", error);
        }
        pintarHistorial(); // repintar para que la lista quede vacía
    });

    // PUNTO 26: Envío del formulario. Aquí se bloquea o se permite.
    // Aquí SÍ necesitamos el evento "e" para poder cancelar el envío.
    formulario.addEventListener("submit", (e) => {
        // Llamamos a las tres SIEMPRE, antes del if, para que salgan todos los errores a la vez.
        // (con && directo, la primera que fallara cortaría y las demás no se ejecutarían).
        const nombreOk = validarNombre();
        const codigoOk = validarCodigo();
        const actividadesOk = validarActividades();

        if (!(nombreOk && codigoOk && actividadesOk)) {
            // Hay errores: cancelamos el envío. El borrador se queda para no perder lo escrito.
            e.preventDefault();
        } else {
            // Todo correcto. Cancelamos el envío real para no recargar la página
            // (así el historial se actualiza al instante y evitamos el error 405 de Live Server).
            e.preventDefault();

            guardarEnHistorial(); // PRIMERO guardar, antes del reset (si no, guardaría datos vacíos)

            try {
                sessionStorage.removeItem(CLAVE_BORRADOR);     // el borrador ya no hace falta
                localStorage.setItem(CLAVE_PLAN, obtenerPlan()); // recordar el plan para la próxima vez
            } catch (error) {
                console.error("Error al guardar/borrar en el almacenamiento:", error);
            }

            pintarHistorial(); // mostrar la nueva inscripción

            // Dejar el formulario limpio y coherente:
            formulario.reset();       // vacía los campos y vuelve al "checked" del HTML (Mensual)
            cargarPlanPreferido();    // marcamos el plan recién guardado
            actualizarPrecio();       // el precio debe coincidir con el plan marcado
            actualizarActividades();  // las casillas y el mensaje deben coincidir con el plan
        }
    });

    // =====================================================
    // PUNTO 27: CARGA INICIAL (el ORDEN IMPORTA)
    // =====================================================
    pintarHistorial();       // mostrar lo guardado de sesiones anteriores
    cargarPlanPreferido();   // 1º marcar el plan preferido...
    actualizarPrecio();      // 2º ...para que el precio sea coherente con él
    pintarActividades();     // 3º crear los checkboxes (antes de marcarlos)
    actualizarActividades(); // 4º marcar/desmarcar según el plan y escribir el mensaje
    restaurarBorrador();     // 5º el borrador va el último: lo que el usuario estaba escribiendo gana

});