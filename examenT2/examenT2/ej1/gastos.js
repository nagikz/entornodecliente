// Nombre del alumno: Ángela Barrera Rodríguez

class Gasto {
    constructor(concepto, importe, categoria) {
        this.concepto = concepto;
        this.importe = importe;
        this.categoria = categoria;
    }
}

function formatear() {
        return "[" + this.categoria + "] " + this.concepto + " - " + this.importe;
    }