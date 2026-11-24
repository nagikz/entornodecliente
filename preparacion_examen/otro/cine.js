/*
 * SIMULACRO 4: RESERVA DE ENTRADAS DE CINE
 * Cada bloque lleva tres cosas: QUÉ se hace, CÓMO y POR QUÉ.
 * Requiere peliculas.js cargado ANTES (de ahí salen los arrays globales
 * "peliculas" y "extras").
 */

/* =====================================================
 * BLOQUE 0: Constantes globales (fuera de todo)
 * ===================================================== */

// QUÉ: formateador de moneda.  CÓMO: Intl.NumberFormat con locale es-ES.
// POR QUÉ: se crea UNA vez y se reutiliza; da "34,50 €" (coma decimal y símbolo).
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

// QUÉ: minutos que dura una reserva guardada.
// POR QUÉ como constante: el número queda en un solo sitio y se entiende
// (un "10" suelto dentro de una cuenta no dice nada).
const MINUTOS_CADUCIDAD = 10;

/* =====================================================
 * BLOQUE 1: Clase Entrada
 * Las clases van FUERA del DOMContentLoaded: no necesitan el DOM y así
 * se pueden probar desde la consola del navegador.
 * ===================================================== */
class Entrada {
    constructor(id, pelicula, sesion, precio) {
        this.id = id;             // identificador único (para borrar una entrada concreta)
        this.pelicula = pelicula; // título (texto, no el objeto película)
        this.sesion = sesion;     // hora, por ejemplo "18:30"
        this.precio = precio;     // precio base de la película
    }

    // QUÉ: propiedad calculada.  CÓMO: "get" (se usa sin paréntesis: e.precioFinal).
    // POR QUÉ: la entrada normal cuesta su precio base; la VIP lo sobrescribirá.
    get precioFinal() {
        return this.precio;
    }

    // Lo pide el enunciado: "Película - 18:30".
    mostrar() {
        return `${this.pelicula} - ${this.sesion}`;
    }

    // QUÉ: cómo se convierte en JSON al guardarla.
    // POR QUÉ: JSON.stringify llama a toJSON() solo. Guardamos el "tipo" para saber
    // qué clase crear al volver a leer (JSON.parse devuelve objetos SIN métodos),
    // y porque los campos privados # (el suplemento) NO se serializan solos.
    toJSON() {
        return {
            tipo: "normal",
            id: this.id,
            pelicula: this.pelicula,
            sesion: this.sesion,
            precio: this.precio
        };
    }

    // QUÉ: devolver un <li> (elemento del DOM, no texto).
    render() {
        const li = document.createElement("li");
        li.dataset.id = this.id; // data-id: así sabremos cuál es al hacer clic (delegación)

        const texto = document.createElement("span");
        texto.textContent = this.mostrar(); // el contenido sale de mostrar()

        const boton = document.createElement("button");
        boton.type = "button";               // que no actúe como submit
        boton.classList.add("eliminar");     // clase para reconocerlo en la delegación
        boton.textContent = "Eliminar";

        li.append(texto, boton);
        return li;
    }
}

/* =====================================================
 * BLOQUE 2: Clase EntradaVip (hereda de Entrada)
 * ===================================================== */
class EntradaVip extends Entrada {
    static MAX = 10;  // static: dato de la clase (EntradaVip.MAX), no de cada entrada
    #suplemento;      // campo privado: solo se toca desde dentro y pasando por el setter

    constructor(id, pelicula, sesion, precio, suplemento = 5) {
        super(id, pelicula, sesion, precio); // super SIEMPRE antes de usar this
        this.suplemento = suplemento;        // pasa por el setter -> se VALIDA al crear
    }

    // El setter valida (lo pide el enunciado: entre 0 y 10).
    set suplemento(valor) {
        const n = Number(valor);
        if (Number.isNaN(n) || n < 0 || n > EntradaVip.MAX) {
            throw new Error("El suplemento debe estar entre 0 y " + EntradaVip.MAX);
        }
        this.#suplemento = n;
    }

    // IMPORTANTE: si una propiedad tiene setter hace falta también getter;
    // sin él, leer this.suplemento devolvería undefined (y el precio sería NaN).
    get suplemento() {
        return this.#suplemento;
    }

    // Sobrescribe el getter del padre. super.precioFinal reutiliza su lógica.
    get precioFinal() {
        return super.precioFinal + this.suplemento;
    }

    // Reutiliza el mostrar() del padre y añade lo propio.
    mostrar() {
        return super.mostrar() + " (VIP)";
    }

    toJSON() {
        // ...super.toJSON() copia los campos del padre; luego pisamos el tipo y añadimos el suplemento.
        return { ...super.toJSON(), tipo: "vip", suplemento: this.suplemento };
    }

    // Reutiliza el <li> del padre y le añade la clase CSS "vip" (lo pide el enunciado).
    render() {
        const li = super.render();
        li.classList.add("vip");
        return li;
    }
}

/* =====================================================
 * BLOQUE 3: GestorReservas (localStorage + caducidad TTL)
 * Se guarda UN objeto: { expiracion: <milisegundos>, entradas: [...] }
 * ===================================================== */
class GestorReservas {
    #contenedor;                 // el <ul>
    #clave = "cine_reservas";    // clave de localStorage (con prefijo para no chocar con otras)

    // El constructor recibe SOLO el id del <ul>, como pide el enunciado.
    constructor(idContenedor) {
        this.#contenedor = document.getElementById(idContenedor);
    }

    // Método PRIVADO que guarda (lo pide el enunciado).
    // "expiracion" tiene valor por defecto: ahora + 10 minutos. Ese valor por defecto
    // se calcula en CADA llamada, así que al añadir una reserva el plazo se renueva.
    #guardar(lista, expiracion = Date.now() + MINUTOS_CADUCIDAD * 60 * 1000) {
        try {
            localStorage.setItem(this.#clave, JSON.stringify({ expiracion, entradas: lista }));
        } catch (error) {
            console.error("No se pudo guardar:", error);
        }
    }

    // Método privado que LEE y comprueba la caducidad.
    // Devuelve el objeto guardado, o null si no hay nada / ha caducado / está corrupto.
    #leer() {
        try {
            const raw = localStorage.getItem(this.#clave);
            if (raw === null) {
                return null;                    // getItem devuelve null si no existe
            }
            const datos = JSON.parse(raw);      // de texto a objeto
            if (Date.now() > datos.expiracion) {
                localStorage.removeItem(this.#clave); // caducado: se elimina SOLO esta clave
                return null;
            }
            return datos;
        } catch (error) {
            console.error("No se pudo leer:", error);
            return null;
        }
    }

    // De objeto plano a instancia. POR QUÉ: JSON.parse devuelve objetos sin métodos
    // (sin render, ni mostrar, ni precioFinal): hay que volver a crear cada clase con new.
    #reconstruir(d) {
        if (d.tipo === "vip") {
            return new EntradaVip(d.id, d.pelicula, d.sesion, d.precio, d.suplemento);
        }
        return new Entrada(d.id, d.pelicula, d.sesion, d.precio);
    }

    // Devuelve SIEMPRE un array de instancias (vacío si no hay nada).
    getAll() {
        const datos = this.#leer();
        return datos ? datos.entradas.map(d => this.#reconstruir(d)) : [];
    }

    // LEER lo anterior + AÑADIR + GUARDAR todo.
    // POR QUÉ: si guardaras solo la nueva, machacarías las que ya había.
    add(entrada) {
        const lista = this.getAll();
        lista.push(entrada);
        this.#guardar(lista); // plazo renovado: son 10 minutos desde la última reserva añadida
    }

    // Borra una entrada. Conserva la caducidad que ya tenía (el enunciado dice
    // "desde la última reserva AÑADIDA", no desde la última borrada).
    delete(id) {
        const datos = this.#leer();
        if (datos === null) return;
        const restantes = this.getAll().filter(e => e.id !== id);
        this.#guardar(restantes, datos.expiracion);
    }

    // removeItem borra SOLO nuestra clave (clear() borraría todo el origen).
    vaciar() {
        try {
            localStorage.removeItem(this.#clave);
        } catch (error) {
            console.error("No se pudo vaciar:", error);
        }
    }

    // Vacía el <ul> (para no duplicar) y dibuja cada entrada con SU propio render().
    render() {
        this.#contenedor.innerHTML = "";
        this.getAll().forEach(entrada => this.#contenedor.append(entrada.render()));
    }
}

/* =====================================================
 * BLOQUE 4: Todo lo que toca el DOM, dentro de DOMContentLoaded
 * POR QUÉ: así los elementos ya existen cuando los buscamos.
 * ===================================================== */
document.addEventListener("DOMContentLoaded", () => {

    /* ---------- 4.1 Elementos del DOM ----------
     * Nombres que NO chocan con los arrays globales: "peliculas" y "extras" ya
     * existen (vienen de peliculas.js), por eso el <select> se llama selectExtras. */
    const formulario = document.getElementById("formulario");
    const nombre = document.getElementById("nombre");
    const errorNombre = document.getElementById("error-nombre");
    const email = document.getElementById("email");
    const errorEmail = document.getElementById("error-email");
    const email2 = document.getElementById("email2");
    const errorEmail2 = document.getElementById("error-email2");
    const dni = document.getElementById("dni");
    const errorDni = document.getElementById("error-dni");
    const selectPelicula = document.getElementById("pelicula");
    const errorPelicula = document.getElementById("error-pelicula");
    const contenedorSesiones = document.getElementById("sesiones");
    const errorSesion = document.getElementById("error-sesion");
    const inputEntradas = document.getElementById("entradas");
    const errorEntradas = document.getElementById("error-entradas");
    const selectExtras = document.getElementById("extras");
    const errorExtras = document.getElementById("error-extras");
    const checkVip = document.getElementById("vip");
    const precioTotal = document.getElementById("precio-total");
    const mensaje = document.getElementById("mensaje");
    const botonVaciar = document.getElementById("vaciar");

    // El gestor solo recibe el id del <ul>.
    const gestor = new GestorReservas("reservas");

    const CLAVE_BORRADOR = "cine_borrador"; // sessionStorage (se pierde al cerrar la pestaña)
    const regexDni = /^\d{8}-[A-Z]$/;       // ^ inicio, 8 dígitos, guion, 1 mayúscula, $ final
    const MAX_EXTRAS = 3;

    /* ---------- 4.2 DATOS DINÁMICOS ---------- */

    // Películas: un <option> por cada película del array.
    // CÓMO: createElement + value + textContent + append. La opción "Elige una película"
    // del HTML NO se toca: por eso no vaciamos este <select>.
    peliculas.forEach(peli => {
        const opcion = document.createElement("option");
        opcion.value = peli.id;
        opcion.textContent = peli.titulo;     // OJO: las películas tienen "titulo", no "nombre"
        selectPelicula.append(opcion);
    });

    // Extras: aquí SÍ vaciamos antes, para quitar el "ejemplo" que trae el HTML.
    selectExtras.innerHTML = "";
    extras.forEach(extra => {
        const opcion = document.createElement("option");
        opcion.value = extra.id;
        opcion.textContent = `${extra.nombre} (+${eur.format(extra.precio)})`;
        selectExtras.append(opcion);
    });

    // Sesiones: los radios dependen de la película elegida.
    function pintarSesiones() {
        contenedorSesiones.innerHTML = "";   // vaciar (quita el ejemplo y las de la película anterior)

        const peli = peliculas.find(p => p.id === selectPelicula.value);
        if (!peli) return;                   // sin película no hay sesiones

        // El 2.º parámetro de forEach es el índice: sirve para marcar solo el primero.
        peli.sesiones.forEach((hora, i) => {
            const label = document.createElement("label");
            label.classList.add("opcion");   // misma clase que el ejemplo del HTML
            const input = document.createElement("input");
            input.type = "radio";
            input.name = "sesion";           // mismo name = solo uno marcado a la vez
            input.value = hora;
            input.checked = (i === 0);       // la primera, por defecto
            label.append(input, " " + hora);
            contenedorSesiones.append(label);
        });
    }

    /* ---------- 4.3 VALIDACIÓN ---------- */

    // Función genérica: recibe el input, su <span> de error y un objeto
    // { banderaDeValidity: "mensaje" }. Devuelve true/false.
    // POR QUÉ genérica: las validaciones de cantidad, email, película... son iguales.
    function validarCampo(input, error, mensajes) {
        if (input.validity.valid) {            // cumple todas las reglas del HTML y las custom
            error.textContent = "";
            return true;
        }
        if (input.validity.customError) {      // error puesto con setCustomValidity
            error.textContent = input.validationMessage;
            return false;
        }
        for (const bandera in mensajes) {      // primera bandera de validity activa con mensaje nuestro
            if (input.validity[bandera]) {
                error.textContent = mensajes[bandera];
                return false;
            }
        }
        error.textContent = input.validationMessage; // último recurso: el mensaje del navegador
        return false;
    }

    // Nombre: mínimo 3 caracteres (trim solo para contar, no se asigna al input).
    function validarNombre() {
        const texto = nombre.value.trim();
        if (nombre.value !== "" && texto.length < 3) {
            nombre.setCustomValidity("El nombre debe tener al menos 3 caracteres");
        } else {
            nombre.setCustomValidity("");      // IMPRESCINDIBLE: si no, queda inválido para siempre
        }
        return validarCampo(nombre, errorNombre, { valueMissing: "El nombre es obligatorio" });
    }

    // Email: el formato lo comprueba el navegador (type="email" -> typeMismatch).
    function validarEmail() {
        return validarCampo(email, errorEmail, {
            valueMissing: "El correo es obligatorio",
            typeMismatch: "El correo no tiene un formato válido"
        });
    }

    // Repetir correo: debe coincidir. Se compara en la validación, no en el HTML.
    function validarEmail2() {
        // Solo marcamos "no coinciden" si hay algo escrito; si está vacío, avisa "obligatorio".
        if (email2.value !== "" && email2.value !== email.value) {
            email2.setCustomValidity("Los correos no coinciden");
        } else {
            email2.setCustomValidity("");
        }
        return validarCampo(email2, errorEmail2, {
            valueMissing: "Repite el correo",
            typeMismatch: "El correo no tiene un formato válido"
        });
    }

    // DNI con regex, mediante setCustomValidity.
    function validarDni() {
        if (dni.value !== "" && !regexDni.test(dni.value)) {
            dni.setCustomValidity("Formato incorrecto (ejemplo: 12345678-A)");
        } else {
            dni.setCustomValidity("");
        }
        return validarCampo(dni, errorDni, { valueMissing: "El DNI es obligatorio" });
    }

    // Película: el <select required> con la opción vacía marcada da valueMissing.
    function validarPelicula() {
        return validarCampo(selectPelicula, errorPelicula, { valueMissing: "Elige una película" });
    }

    // Sesión: los radios no tienen validity cómodo, se comprueba a mano con :checked.
    function validarSesion() {
        const marcada = contenedorSesiones.querySelector('input[name="sesion"]:checked');
        if (marcada === null) {
            errorSesion.textContent = "Elige una película y una sesión";
            return false;
        }
        errorSesion.textContent = "";
        return true;
    }

    // Entradas: un mensaje distinto para cada bandera de validity.
    function validarEntradas() {
        return validarCampo(inputEntradas, errorEntradas, {
            valueMissing: "Indica cuántas entradas quieres",
            rangeUnderflow: "Mínimo 1 entrada",               // menor que min
            rangeOverflow: "Máximo 6 entradas",                // mayor que max
            stepMismatch: "El número de entradas debe ser entero",
            badInput: "Introduce un número válido"
        });
    }

    // Extras: máximo 3. selectedOptions es una colección, no un array: .length sí vale.
    function validarExtras() {
        if (selectExtras.selectedOptions.length > MAX_EXTRAS) {
            errorExtras.textContent = "Máximo " + MAX_EXTRAS + " extras";
            return false;
        }
        errorExtras.textContent = "";
        return true;
    }

    /* ---------- 4.4 PRECIO TOTAL EN VIVO ---------- */
    function calcularTotal() {
        const peli = peliculas.find(p => p.id === selectPelicula.value);
        if (!peli) {
            precioTotal.textContent = eur.format(0); // sin película, no hay precio
            return;
        }

        // .value es TEXTO: se convierte a número. "|| 0" cubre campo vacío o inválido (NaN).
        const unidades = Number(inputEntradas.value) || 0;

        // Entrada temporal: VIP o normal. Reutilizamos las clases en vez de repetir "+ 5":
        // precioFinal ya sabe si lleva suplemento. id (0) y sesión ("") son relleno.
        const entrada = checkVip.checked
            ? new EntradaVip(0, peli.titulo, "", peli.precio)
            : new Entrada(0, peli.titulo, "", peli.precio);

        // Array.from(select.selectedOptions, fn): convierte la colección en array y el 2.º
        // parámetro actúa como map (saca el value de cada opción elegida).
        const idsExtras = Array.from(selectExtras.selectedOptions, opt => opt.value);

        // filter se queda con los extras elegidos; reduce suma sus precios (acumulador, valor inicial 0).
        const sumaExtras = extras
            .filter(x => idsExtras.includes(x.id))
            .reduce((acumulado, x) => acumulado + x.precio, 0);

        // DECISIÓN: los extras se cuentan UNA vez por reserva (un pedido compartido),
        // no por entrada. Es lo que dan los casos de prueba: 2 VIP en "El faro" = 26,00 €,
        // y con Palomitas 30,50 €.
        const total = unidades * entrada.precioFinal + sumaExtras;
        precioTotal.textContent = eur.format(total);
    }

    /* ---------- 4.5 BORRADOR (sessionStorage) ---------- */
    function guardarBorrador() {
        const sesionMarcada = contenedorSesiones.querySelector('input[name="sesion"]:checked');
        const borrador = {
            nombre: nombre.value,
            email: email.value,
            dni: dni.value,
            pelicula: selectPelicula.value,
            sesion: sesionMarcada ? sesionMarcada.value : "",
            extras: Array.from(selectExtras.selectedOptions, opt => opt.value),
            entradas: inputEntradas.value,   // extra: no lo pide el enunciado pero mejora la restauración
            vip: checkVip.checked            // extra: ídem
        };
        try {
            // El storage solo guarda TEXTO: JSON.stringify.
            sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
        } catch (error) {
            console.error("Error al guardar el borrador:", error);
        }
    }

    function restaurarBorrador() {
        try {
            const raw = sessionStorage.getItem(CLAVE_BORRADOR);
            if (raw === null) return;             // no hay borrador: salimos

            const d = JSON.parse(raw);
            nombre.value = d.nombre;
            email.value = d.email;
            dni.value = d.dni;
            inputEntradas.value = d.entradas;
            checkVip.checked = d.vip;

            // ORDEN IMPORTANTE: primero la película, luego pintar sus sesiones (si no,
            // no existen los radios) y por último marcar la sesión guardada.
            selectPelicula.value = d.pelicula;
            pintarSesiones();
            contenedorSesiones.querySelectorAll('input[name="sesion"]').forEach(radio => {
                radio.checked = (radio.value === d.sesion);
            });

            // En un <select multiple> se marca cada <option> con .selected.
            Array.from(selectExtras.options).forEach(opt => {
                opt.selected = d.extras.includes(opt.value);
            });
        } catch (error) {
            console.error("Error al restaurar el borrador:", error);
        }
    }

    /* ---------- 4.6 EVENTOS ---------- */

    // Nombre y DNI: mayúsculas mientras se escribe (toUpperCase NO modifica: hay que reasignar).
    nombre.addEventListener("input", () => {
        nombre.value = nombre.value.toUpperCase();
        validarNombre();
    });
    dni.addEventListener("input", () => {
        dni.value = dni.value.toUpperCase();
        validarDni();
    });

    // Al cambiar el email hay que revalidar el de confirmación: la coincidencia depende de ambos.
    email.addEventListener("input", () => {
        validarEmail();
        if (email2.value !== "") validarEmail2();
    });
    email2.addEventListener("input", validarEmail2);

    // Película: pintar sus sesiones y validar. Este listener va ANTES (en el propio <select>)
    // que el del formulario (el evento sube), así el borrador ya ve la sesión nueva.
    selectPelicula.addEventListener("change", () => {
        pintarSesiones();
        validarPelicula();
        validarSesion();
    });

    inputEntradas.addEventListener("input", validarEntradas);
    selectExtras.addEventListener("change", validarExtras);

    // DELEGACIÓN en el formulario: input y change SUBEN hasta él, así que con un solo
    // listener cubrimos película, entradas, extras, VIP y los radios de sesión
    // (estos últimos se crean dinámicamente: no habría que ir poniéndoles listener).
    formulario.addEventListener("input", () => {
        calcularTotal();
        guardarBorrador();
    });
    formulario.addEventListener("change", () => {
        calcularTotal();
        guardarBorrador();
    });

    // RESERVAR
    formulario.addEventListener("submit", (e) => {
        e.preventDefault(); // nunca recargamos la página

        // Se llaman TODAS antes del if: así salen todos los errores a la vez.
        // (Con && directo, la primera que fallara cortaría y las demás no se ejecutarían.)
        const nombreOk = validarNombre();
        const emailOk = validarEmail();
        const email2Ok = validarEmail2();
        const dniOk = validarDni();
        const peliculaOk = validarPelicula();
        const sesionOk = validarSesion();
        const entradasOk = validarEntradas();
        const extrasOk = validarExtras();

        if (!(nombreOk && emailOk && email2Ok && dniOk && peliculaOk && sesionOk && entradasOk && extrasOk)) {
            mensaje.textContent = "Revisa los campos marcados";
            return; // hay errores: no se reserva
        }

        try {
            const peli = peliculas.find(p => p.id === selectPelicula.value);
            const sesionElegida = contenedorSesiones.querySelector('input[name="sesion"]:checked').value;
            const unidades = Number(inputEntradas.value);

            // Una entrada por unidad. El id es Date.now() + i: sin el "+ i", todas las
            // entradas creadas en el mismo milisegundo tendrían el MISMO id y al borrar
            // una se borrarían todas.
            for (let i = 0; i < unidades; i++) {
                const id = Date.now() + i;
                const entrada = checkVip.checked
                    ? new EntradaVip(id, peli.titulo, sesionElegida, peli.precio)
                    : new Entrada(id, peli.titulo, sesionElegida, peli.precio);
                gestor.add(entrada); // se guarda en localStorage
            }

            gestor.render(); // volvemos a dibujar la lista

            // Borrador fuera: ya se ha reservado (removeItem borra solo esa clave).
            sessionStorage.removeItem(CLAVE_BORRADOR);

            formulario.reset();   // limpia los campos
            pintarSesiones();     // reset no borra los radios creados por código: los repintamos (ahora sin película = vacío)
            calcularTotal();      // el total vuelve a 0,00 €
            [errorNombre, errorEmail, errorEmail2, errorDni, errorPelicula,
                errorSesion, errorEntradas, errorExtras].forEach(span => {
                span.textContent = "";
            });
            mensaje.textContent = "Reserva realizada: " + unidades + (unidades === 1 ? " entrada" : " entradas");
            nombre.focus();
        } catch (error) {
            mensaje.textContent = error.message;
        }
    });

    // DELEGACIÓN en el <ul>: UN listener para todos los botones "Eliminar",
    // incluidos los de <li> que se creen después (cada render crea elementos nuevos).
    document.getElementById("reservas").addEventListener("click", (e) => {
        const boton = e.target.closest("button.eliminar"); // closest busca hacia arriba
        if (!boton) return;                                // clic en otra cosa: ignorar
        const li = boton.closest("li");
        gestor.delete(Number(li.dataset.id));              // dataset siempre es texto -> Number
        gestor.render();
    });

    // Vaciar: solo la clave de reservas (removeItem dentro del gestor).
    botonVaciar.addEventListener("click", () => {
        gestor.vaciar();
        gestor.render();
        mensaje.textContent = "Reservas vaciadas";
    });

    /* ---------- 4.7 CARGA INICIAL (el ORDEN importa) ---------- */
    // Las películas y los extras ya están pintados más arriba.
    pintarSesiones();     // deja vacío el contenedor (quita el radio de ejemplo del HTML)
    gestor.render();      // reservas guardadas (si no han caducado)
    restaurarBorrador();  // si había un borrador, rellena el formulario (lo último: manda lo que se estaba escribiendo)
    calcularTotal();      // el total debe coincidir con lo restaurado
});