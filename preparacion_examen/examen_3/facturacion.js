/*
 * SIMULACRO 3: SISTEMA DE FACTURACIÓN
 * Mezcla: clases con herencia + formulario con API de validación +
 *         delegación de eventos + localStorage.
 * Requiere productos.js cargado ANTES (de ahí sale el array global "catalogo").
 */

/* =====================================================
 * PUNTO 0: Formateador de moneda (se crea UNA vez y se reutiliza)
 * Intl.NumberFormat da "34,89 €" con separador decimal español.
 * ===================================================== */
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

/* =====================================================
 * PUNTO 1: Clase base Linea (una fila de la factura)
 * ===================================================== */
class Linea {
    // id opcional: al recuperar de localStorage hay que conservar el original.
    constructor(concepto, cantidad, precio, id = Date.now()) {
        this.id = id;
        this.concepto = concepto;
        this.cantidad = cantidad;
        this.precio = precio;
    }

    // Propiedad CALCULADA (get): se usa sin paréntesis -> linea.total
    get total() {
        return this.cantidad * this.precio;
    }

    // Método aparte para el texto del concepto: así una subclase puede cambiarlo
    // sin reescribir todo render() (sobrescritura / polimorfismo).
    mostrarConcepto() {
        return this.concepto;
    }

    // JSON.stringify llama solo a toJSON(): guardamos el "tipo" para poder
    // reconstruir la clase correcta al leer (los getters y #privados no se serializan).
    toJSON() {
        return {
            tipo: "normal",
            id: this.id,
            concepto: this.concepto,
            cantidad: this.cantidad,
            precio: this.precio
        };
    }

    // render() devuelve un <tr> (elemento del DOM, no texto).
    render() {
        const tr = document.createElement("tr");
        tr.dataset.id = this.id; // para saber qué línea es al hacer clic (delegación)

        // Las 4 primeras celdas se generan con un bucle en vez de repetir código.
        const valores = [
            this.mostrarConcepto(),
            this.cantidad,
            eur.format(this.precio),
            eur.format(this.total) // usa el getter total (el de la subclase si es LineaDescuento)
        ];
        valores.forEach(valor => {
            const td = document.createElement("td");
            td.textContent = valor;
            tr.append(td);
        });

        // Última celda: botón de eliminar.
        const tdBoton = document.createElement("td");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.classList.add("eliminar");   // clase para reconocerlo en la delegación
        boton.textContent = "X";
        boton.setAttribute("aria-label", "Eliminar " + this.concepto); // accesibilidad
        tdBoton.append(boton);
        tr.append(tdBoton);

        return tr;
    }
}

/* =====================================================
 * PUNTO 2: LineaDescuento hereda de Linea y añade un % de descuento
 * ===================================================== */
class LineaDescuento extends Linea {
    static MAX = 50;  // static: dato de la clase (LineaDescuento.MAX), no de cada instancia
    #descuento;       // campo privado: solo accesible a través del setter

    constructor(concepto, cantidad, precio, descuento = 10, id) {
        super(concepto, cantidad, precio, id); // super SIEMPRE antes de usar this
        this.descuento = descuento;            // pasa por el setter -> se valida
    }

    get descuento() {
        return this.#descuento;
    }

    // Setter con validación: lanza error si el valor no es válido.
    set descuento(valor) {
        const n = Number(valor);
        if (Number.isNaN(n) || n < 0 || n > LineaDescuento.MAX) {
            throw new Error("El descuento debe estar entre 0 y " + LineaDescuento.MAX);
        }
        this.#descuento = n;
    }

    // SOBRESCRIBE el getter: super.total accede al getter del padre.
    get total() {
        return super.total * (1 - this.descuento / 100);
    }

    // Sobrescribe el texto del concepto añadiendo el descuento.
    mostrarConcepto() {
        return this.concepto + " (-" + this.descuento + "%)";
    }

    toJSON() {
        return { ...super.toJSON(), tipo: "descuento", descuento: this.descuento };
    }

    // Reutiliza el <tr> del padre y le añade una clase CSS.
    render() {
        const tr = super.render();
        tr.classList.add("descuento");
        return tr;
    }
}

/* =====================================================
 * PUNTO 3: Clase Factura (gestiona y persiste en localStorage)
 * Usa DOS claves: una para las líneas (JSON) y otra para la tasa (texto).
 * ===================================================== */
class Factura {
    static TASAS = [5, 10, 15, 20];
    static TASA_POR_DEFECTO = 20;

    #contenedor;                         // el <tbody>
    #claveLineas = "factura_lineas";
    #claveTasa = "factura_tasa";

    // Recibe SOLO el id del <tbody> donde se dibujan las líneas.
    constructor(idContenedor) {
        this.#contenedor = document.getElementById(idContenedor);
    }

    // Método privado: guarda el array entero de líneas.
    #guardar(lista) {
        try {
            localStorage.setItem(this.#claveLineas, JSON.stringify(lista));
        } catch (error) {
            console.error("No se pudo guardar:", error);
        }
    }

    // Método privado: de objeto plano a instancia (JSON.parse devuelve objetos SIN métodos).
    #reconstruir(d) {
        if (d.tipo === "descuento") {
            return new LineaDescuento(d.concepto, d.cantidad, d.precio, d.descuento, d.id);
        }
        return new Linea(d.concepto, d.cantidad, d.precio, d.id);
    }

    // Devuelve SIEMPRE un array de instancias (vacío si no hay nada o hay error).
    getAll() {
        try {
            const raw = localStorage.getItem(this.#claveLineas);
            if (raw === null) {
                return [];
            }
            return JSON.parse(raw).map(d => this.#reconstruir(d));
        } catch (error) {
            console.error("No se pudo leer:", error);
            return [];
        }
    }

    get(id) {
        return this.getAll().find(l => l.id === id);
    }

    // LEER lo anterior + AÑADIR + GUARDAR todo (si no, machacarías lo guardado).
    add(linea) {
        const lista = this.getAll();
        lista.push(linea);
        this.#guardar(lista);
    }

    // Se queda con todas MENOS la del id.
    delete(id) {
        this.#guardar(this.getAll().filter(l => l.id !== id));
    }

    // removeItem borra SOLO la clave de las líneas; la tasa elegida se conserva.
    vaciar() {
        try {
            localStorage.removeItem(this.#claveLineas);
        } catch (error) {
            console.error("No se pudo vaciar:", error);
        }
    }

    // Tasa como propiedad con getter/setter. Es un texto simple: no hace falta JSON.
    get tasa() {
        try {
            const raw = localStorage.getItem(this.#claveTasa);
            const n = Number(raw); // Number(null) es 0, que no está en TASAS -> valor por defecto
            return Factura.TASAS.includes(n) ? n : Factura.TASA_POR_DEFECTO;
        } catch (error) {
            return Factura.TASA_POR_DEFECTO;
        }
    }

    set tasa(valor) {
        if (!Factura.TASAS.includes(valor)) {
            throw new Error("Tasa no válida: " + valor);
        }
        try {
            localStorage.setItem(this.#claveTasa, valor);
        } catch (error) {
            console.error("No se pudo guardar la tasa:", error);
        }
    }

    // Cálculo de totales. reduce acumula la suma de los totales de cada línea.
    totales() {
        const subtotal = this.getAll().reduce((acumulado, l) => acumulado + l.total, 0);
        const impuestos = subtotal * this.tasa / 100;
        return { subtotal, impuestos, total: subtotal + impuestos };
    }

    // Vacía el <tbody> y dibuja cada línea con SU render().
    render() {
        this.#contenedor.innerHTML = "";
        this.getAll().forEach(linea => this.#contenedor.append(linea.render()));
    }
}

/* =====================================================
 * PUNTO 4: Todo lo que toca el DOM, dentro de DOMContentLoaded
 * ===================================================== */
document.addEventListener("DOMContentLoaded", () => {

    // --- Elementos del DOM ---
    const formulario = document.getElementById("formulario");
    const selectCatalogo = document.getElementById("catalogo");
    const concepto = document.getElementById("concepto");
    const cantidad = document.getElementById("cantidad");
    const precio = document.getElementById("precio");
    const errorConcepto = document.getElementById("error-concepto");
    const errorCantidad = document.getElementById("error-cantidad");
    const errorPrecio = document.getElementById("error-precio");
    const checkDescuento = document.getElementById("con-descuento");
    const selectDescuento = document.getElementById("descuento");
    const mensaje = document.getElementById("mensaje");
    const botonVaciar = document.getElementById("vaciar");
    const grupoTasa = document.getElementById("grupo-tasa");
    const radiosTasa = grupoTasa.querySelectorAll('input[name="tasa"]');
    const tbody = document.getElementById("lineas");
    const celdaSubtotal = document.getElementById("subtotal");
    const celdaTasa = document.getElementById("tasa-valor");
    const celdaImpuestos = document.getElementById("impuestos");
    const celdaTotal = document.getElementById("total");

    const factura = new Factura("lineas");

    /* ---------- PUNTO 5: Catálogo (generar <option> desde un array) ---------- */
    catalogo.forEach(prod => {
        const opcion = document.createElement("option");
        opcion.value = prod.id;
        opcion.textContent = prod.nombre;
        selectCatalogo.append(opcion);
    });

    // Al elegir un producto se rellenan concepto y precio (y se validan).
    selectCatalogo.addEventListener("change", () => {
        const prod = catalogo.find(p => p.id === selectCatalogo.value);
        if (prod) {
            concepto.value = prod.nombre;
            precio.value = prod.precio;
            validarConcepto();
            validarPrecio();
        }
    });

    /* ---------- PUNTO 6: Validación con la API de validity ---------- */

    // Función genérica: recibe el input, su <span> de error y un objeto
    // { banderaDeValidity: "mensaje" }. Devuelve true/false.
    function validarCampo(input, error, mensajes) {
        if (input.validity.valid) {
            error.textContent = "";
            return true;
        }
        // Error personalizado (setCustomValidity): su texto está en validationMessage.
        if (input.validity.customError) {
            error.textContent = input.validationMessage;
            return false;
        }
        // Buscamos la primera bandera de validity activa que tenga mensaje nuestro.
        for (const bandera in mensajes) {
            if (input.validity[bandera]) {
                error.textContent = mensajes[bandera];
                return false;
            }
        }
        error.textContent = input.validationMessage; // mensaje del navegador como último recurso
        return false;
    }

    function validarConcepto() {
        const texto = concepto.value.trim();
        const repetido = factura.getAll()
            .some(l => l.concepto.toLowerCase() === texto.toLowerCase());

        // setCustomValidity("texto") marca el campo como inválido;
        // setCustomValidity("") lo restablece (si no, quedaría inválido SIEMPRE).
        if (concepto.value !== "" && texto.length < 3) {
            concepto.setCustomValidity("El concepto debe tener al menos 3 caracteres");
        } else if (texto !== "" && repetido) {
            concepto.setCustomValidity("Ese concepto ya está en la factura");
        } else {
            concepto.setCustomValidity("");
        }
        return validarCampo(concepto, errorConcepto, {
            valueMissing: "El concepto es obligatorio"
        });
    }

    function validarCantidad() {
        return validarCampo(cantidad, errorCantidad, {
            valueMissing: "La cantidad es obligatoria",
            rangeUnderflow: "La cantidad mínima es 1",     // menor que min
            rangeOverflow: "La cantidad máxima es 99",     // mayor que max
            stepMismatch: "La cantidad debe ser un número entero",
            badInput: "Introduce un número válido"
        });
    }

    function validarPrecio() {
        return validarCampo(precio, errorPrecio, {
            valueMissing: "El precio es obligatorio",
            rangeUnderflow: "El precio debe ser mayor que 0",
            stepMismatch: "Máximo dos decimales",
            badInput: "Introduce un número válido"
        });
    }

    // Validación en vivo con "input".
    concepto.addEventListener("input", validarConcepto);
    cantidad.addEventListener("input", validarCantidad);
    precio.addEventListener("input", validarPrecio);

    // El select de descuento solo está activo si el checkbox está marcado.
    function actualizarDescuento() {
        selectDescuento.disabled = !checkDescuento.checked;
    }
    checkDescuento.addEventListener("change", actualizarDescuento);

    /* ---------- PUNTO 7: Pintar tabla y totales ---------- */
    function pintarTotales() {
        const { subtotal, impuestos, total } = factura.totales(); // desestructuración
        celdaSubtotal.textContent = eur.format(subtotal);
        celdaTasa.textContent = factura.tasa + "%";
        celdaImpuestos.textContent = eur.format(impuestos);
        celdaTotal.textContent = eur.format(total);
    }

    // Se llama cada vez que cambia algo: añadir, eliminar, vaciar o cambiar tasa.
    function pintar() {
        factura.render();
        pintarTotales();
    }

    /* ---------- PUNTO 8: Insertar línea (submit) ---------- */
    formulario.addEventListener("submit", (e) => {
        e.preventDefault(); // nunca recargamos la página

        // Llamamos a las tres SIEMPRE (así salen todos los errores a la vez).
        const conceptoOk = validarConcepto();
        const cantidadOk = validarCantidad();
        const precioOk = validarPrecio();
        if (!(conceptoOk && cantidadOk && precioOk)) {
            return; // hay errores: no se inserta
        }

        try {
            const texto = concepto.value.trim();
            const unidades = Number(cantidad.value); // .value es texto: convertir a número
            const importe = Number(precio.value);

            // Según el checkbox se crea una clase u otra.
            const linea = checkDescuento.checked
                ? new LineaDescuento(texto, unidades, importe, Number(selectDescuento.value))
                : new Linea(texto, unidades, importe);

            factura.add(linea);      // guarda en localStorage
            pintar();                // dibuja tabla y totales
            formulario.reset();      // limpia los campos (cantidad vuelve a 1)
            actualizarDescuento();   // reset desmarca el checkbox: reajustar el select
            errorConcepto.textContent = "";
            errorCantidad.textContent = "";
            errorPrecio.textContent = "";
            mensaje.textContent = "Línea añadida";
            concepto.focus();
        } catch (error) {
            mensaje.textContent = error.message; // por ejemplo, descuento no válido
        }
    });

    /* ---------- PUNTO 9: DELEGACIÓN DE EVENTOS ---------- */

    // (a) Un solo listener en el <tbody> para todos los botones de eliminar,
    //     incluso los de filas que se crean después.
    tbody.addEventListener("click", (e) => {
        const boton = e.target.closest("button.eliminar");
        if (!boton) return;                       // clic en otra cosa: ignorar
        const fila = boton.closest("tr");
        factura.delete(Number(fila.dataset.id));  // dataset siempre es texto -> Number
        pintar();
    });

    // (b) Un solo listener en el <fieldset> para los cuatro radios de la tasa.
    //     "change" sube (burbujea) desde el radio hasta el fieldset.
    grupoTasa.addEventListener("change", (e) => {
        if (e.target.name === "tasa") {
            factura.tasa = Number(e.target.value); // el setter valida y guarda en localStorage
            pintarTotales();                       // las líneas no cambian: solo los totales
        }
    });

    // Botón "Vaciar factura".
    botonVaciar.addEventListener("click", () => {
        factura.vaciar();
        pintar();
        mensaje.textContent = "Factura vaciada";
    });

    /* ---------- PUNTO 10: Carga inicial (el ORDEN importa) ---------- */
    // Marcar el radio de la tasa guardada (20% si no hay nada guardado).
    radiosTasa.forEach(radio => {
        radio.checked = (Number(radio.value) === factura.tasa);
    });
    actualizarDescuento();
    pintar(); // dibuja las líneas guardadas de sesiones anteriores y los totales
});