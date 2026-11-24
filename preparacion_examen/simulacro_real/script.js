/*
 * SIMULACRO 2: GESTOR DE TAREAS (clases + DOM + localStorage)
 * Va con tareas.html (el <ul id="lista-tareas">, el formulario y el botón de refrescar).
 */

/* =====================================================
 * PUNTO 1: Clase base Tarea
 * Guarda id, título y estado. Por defecto NO completada.
 * ===================================================== */
class Tarea {
    // Parámetros con valor por defecto:
    //  - completada = false  -> "por defecto, no completadas" (lo pide el enunciado)
    //  - id = Date.now()     -> si no llega un id, se genera uno único.
    // El id opcional es CLAVE: al recuperar las tareas de localStorage hay que
    // recrearlas con su id original, no con uno nuevo.
    constructor(titulo, completada = false, id = Date.now()) {
        this.id = id;
        this.titulo = titulo;
        this.completada = completada;
    }

    // mostrar() devuelve SOLO el título (las subclases pueden sobrescribirlo).
    mostrar() {
        return this.titulo;
    }

    // PUNTO 5 (persistencia): JSON.stringify llama automáticamente a toJSON().
    // Lo necesitamos porque los campos privados (#) NO se serializan, y porque
    // hay que guardar el "tipo" para saber qué clase crear al volver a leer.
    toJSON() {
        return { tipo: "normal", id: this.id, titulo: this.titulo, completada: this.completada };
    }

    // PUNTO 4: render() devuelve un <li> (un elemento del DOM, no texto).
    render() {
        const li = document.createElement("li");
        // data-id: así, al hacer clic, sabremos de qué tarea se trata (delegación de eventos).
        li.dataset.id = this.id;

        // El texto va en un <span> para poder tacharlo y para detectar el clic sobre él.
        const texto = document.createElement("span");
        texto.textContent = this.mostrar(); // el contenido sale de mostrar()
        if (this.completada) {
            texto.classList.add("completada"); // en el CSS: text-decoration: line-through
        }

        // Botón Eliminar. type="button" evita que actúe como submit si estuviera en un form.
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "Eliminar";
        boton.classList.add("eliminar"); // clase para reconocerlo en la delegación

        li.append(texto, boton);
        return li;
    }
}

/* =====================================================
 * PUNTO 2: TareaUrgente hereda de Tarea y añade prioridad
 * Prioridades válidas: ALTA, MEDIA, BAJA (por defecto ALTA).
 * ===================================================== */
class TareaUrgente extends Tarea {
    // static: pertenece a la clase, no a cada instancia (TareaUrgente.PRIORIDADES).
    static PRIORIDADES = ["ALTA", "MEDIA", "BAJA"];

    // Campo privado: solo accesible dentro de la clase. Obliga a pasar por el setter.
    #prioridad;

    constructor(titulo, prioridad = "ALTA", completada = false, id) {
        // super(...) SIEMPRE antes de usar this. Si "id" llega undefined,
        // se usa el valor por defecto de Tarea (Date.now()).
        super(titulo, completada, id);
        // Asignamos mediante el setter, así se VALIDA también al crear la tarea.
        this.prioridad = prioridad;
    }

    get prioridad() {
        return this.#prioridad;
    }

    // Setter con validación: "se debe validar que no se asignen valores distintos".
    set prioridad(valor) {
        if (!TareaUrgente.PRIORIDADES.includes(valor)) {
            throw new Error("Prioridad no válida: " + valor + " (usa ALTA, MEDIA o BAJA)");
        }
        this.#prioridad = valor;
    }

    // Reutiliza el toJSON del padre con super y añade lo propio.
    toJSON() {
        return { ...super.toJSON(), tipo: "urgente", prioridad: this.prioridad };
    }

    // PUNTO 4: la tarea urgente añade además una clase CSS con su prioridad (class="BAJA").
    render() {
        const li = super.render(); // reutilizamos el <li> del padre
        li.classList.add(this.prioridad);
        return li;
    }
}

/* =====================================================
 * PUNTO 3: Recordatorio hereda de Tarea y añade descripción
 * ===================================================== */
class Recordatorio extends Tarea {
    constructor(titulo, descripcion = "", completada = false, id) {
        super(titulo, completada, id);
        this.descripcion = descripcion;
    }

    // Sobrescribe mostrar(): formato «título: descripción».
    mostrar() {
        return this.titulo + ": " + this.descripcion;
    }

    // Propiedad calculada: con "get" se usa SIN paréntesis (r.longitud).
    // Devuelve la cantidad de caracteres de la descripción.
    get longitud() {
        return this.descripcion.length;
    }

    toJSON() {
        return { ...super.toJSON(), tipo: "recordatorio", descripcion: this.descripcion };
    }
}

/* =====================================================
 * PUNTO 5: GestorTareas (gestiona y persiste en localStorage)
 * ===================================================== */
class GestorTareas {
    // Campos privados: nadie fuera de la clase debe tocarlos.
    #contenedor;
    #clave = "gestor_tareas"; // clave de localStorage

    // El constructor recibe SOLO el id del <ul> donde se dibujarán las tareas.
    constructor(idContenedor) {
        this.#contenedor = document.getElementById(idContenedor);
    }

    // Método interno PRIVADO (lo pide el enunciado): guarda el array entero.
    // JSON.stringify llamará al toJSON de cada tarea.
    #guardar(lista) {
        try {
            localStorage.setItem(this.#clave, JSON.stringify(lista));
        } catch (error) {
            console.error("No se pudo guardar:", error);
        }
    }

    // Método interno privado: convierte un objeto plano en la instancia correcta.
    // IMPORTANTE: JSON.parse devuelve objetos SIN métodos (sin render, ni mostrar...),
    // por eso hay que reconstruir cada instancia con "new" según su tipo.
    #reconstruir(d) {
        switch (d.tipo) {
            case "urgente":
                return new TareaUrgente(d.titulo, d.prioridad, d.completada, d.id);
            case "recordatorio":
                return new Recordatorio(d.titulo, d.descripcion, d.completada, d.id);
            default:
                return new Tarea(d.titulo, d.completada, d.id);
        }
    }

    // getAll(): devuelve todas las tareas guardadas (siempre un array de instancias).
    getAll() {
        try {
            const raw = localStorage.getItem(this.#clave);
            if (raw === null) {
                return []; // todavía no hay nada guardado
            }
            return JSON.parse(raw).map(d => this.#reconstruir(d));
        } catch (error) {
            console.error("No se pudo leer:", error);
            return [];
        }
    }

    // get(id): devuelve la tarea con ese id (o undefined si no existe).
    get(id) {
        return this.getAll().find(t => t.id === id);
    }

    // add(tarea): LEER lo anterior + AÑADIR + GUARDAR todo (si no, machacarías lo guardado).
    add(tarea) {
        const lista = this.getAll();
        lista.push(tarea);
        this.#guardar(lista);
    }

    // delete(id): se queda con todas las tareas MENOS la del id y guarda el resultado.
    delete(id) {
        const restantes = this.getAll().filter(t => t.id !== id);
        this.#guardar(restantes);
    }

    // Extra necesario para el clic: alterna completada/no completada y persiste el cambio.
    toggle(id) {
        const lista = this.getAll();
        const tarea = lista.find(t => t.id === id);
        if (tarea) {
            tarea.completada = !tarea.completada;
            this.#guardar(lista); // guardamos la lista entera ya modificada
        }
    }

    // render(): vacía el <ul> y dibuja cada tarea con SU propio render().
    render() {
        this.#contenedor.innerHTML = ""; // vaciar antes, o se duplicarían
        this.getAll().forEach(tarea => {
            this.#contenedor.append(tarea.render()); // cada tarea sabe dibujarse (polimorfismo)
        });
    }
}

/* =====================================================
 * PUNTO 6: Interacciones y eventos
 * ===================================================== */
document.addEventListener("DOMContentLoaded", () => {

    // --- Elementos del DOM ---
    const formulario = document.getElementById("formulario");
    const titulo = document.getElementById("titulo");
    const tipo = document.getElementById("tipo");
    const prioridad = document.getElementById("prioridad");
    const descripcion = document.getElementById("descripcion");
    const mensaje = document.getElementById("mensaje");
    const botonRefrescar = document.getElementById("refrescar");
    const lista = document.getElementById("lista-tareas");

    // El gestor solo recibe el ID del contenedor, tal como pide el enunciado.
    const gestor = new GestorTareas("lista-tareas");

    // --- Accesibilidad/usabilidad: solo se activa el campo que corresponde al tipo ---
    function actualizarCampos() {
        prioridad.disabled = (tipo.value !== "urgente");
        descripcion.disabled = (tipo.value !== "recordatorio");
    }
    tipo.addEventListener("change", actualizarCampos);

    // --- Crear tarea desde el formulario ---
    formulario.addEventListener("submit", (e) => {
        e.preventDefault(); // no recargar la página

        const texto = titulo.value.trim();
        if (texto === "") {
            // role="alert" en el HTML hace que se anuncie a lectores de pantalla.
            mensaje.textContent = "El título es obligatorio";
            titulo.focus();
            return;
        }

        try {
            let tarea;
            // Según el tipo elegido se crea la clase correspondiente.
            if (tipo.value === "urgente") {
                tarea = new TareaUrgente(texto, prioridad.value); // puede lanzar error si no es válida
            } else if (tipo.value === "recordatorio") {
                tarea = new Recordatorio(texto, descripcion.value.trim());
            } else {
                tarea = new Tarea(texto);
            }

            gestor.add(tarea);   // se guarda en localStorage
            gestor.render();     // se vuelve a dibujar la lista
            formulario.reset();  // limpiar el formulario
            actualizarCampos();  // reset reactiva/desactiva campos según el tipo por defecto
            mensaje.textContent = "Tarea añadida";
            titulo.focus();
        } catch (error) {
            mensaje.textContent = error.message; // por ejemplo, prioridad no válida
        }
    });

    // --- DELEGACIÓN DE EVENTOS: UN solo listener en el <ul> ---
    // En vez de un manejador por cada botón o texto (que habría que recrear
    // cada vez que se dibuja la lista), escuchamos en el padre: los clics "suben" hasta él.
    lista.addEventListener("click", (e) => {
        // closest() busca hacia arriba desde el elemento clicado.
        const li = e.target.closest("li");
        if (!li) return; // clic en la lista pero no en una tarea

        // El id viene de data-id (siempre como texto), hay que pasarlo a número.
        const id = Number(li.dataset.id);

        if (e.target.closest("button.eliminar")) {
            // Clic en "Eliminar": borra del almacenamiento y de la vista.
            gestor.delete(id);
            gestor.render();
        } else if (e.target.closest("span")) {
            // Clic en el texto: alterna completada / no completada.
            gestor.toggle(id);
            gestor.render();
        }
    });

    // --- Botón refrescar: vuelve a leer de localStorage y a dibujar ---
    botonRefrescar.addEventListener("click", () => {
        gestor.render();
    });

    // --- Carga inicial: mostrar lo guardado y ajustar los campos del formulario ---
    actualizarCampos();
    gestor.render();
});