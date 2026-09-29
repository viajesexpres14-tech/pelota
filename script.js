
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const grafica = document.getElementById("grafica");
const graficaCtx = grafica.getContext("2d");

const btnCamara = document.getElementById("btnCamara");
const btnIniciar = document.getElementById("btnIniciar");
const btnDetener = document.getElementById("btnDetener");

const estado = document.getElementById("estado");
const loading = document.getElementById("loading");

const resultadoObjeto = document.getElementById("resultadoObjeto");
const resultadoTiempo = document.getElementById("tiempo");
const resultadoVelocidadInicial =
    document.getElementById("velocidadInicial");
const resultadoVelocidadFinal =
    document.getElementById("velocidadFinal");
const resultadoDistancia =
    document.getElementById("distancia");
const resultadoAltura =
    document.getElementById("altura");

let modelo = null;
let stream = null;

let detecciones = [];

let objetoSeleccionado = null;
let analizando = false;

let intervaloDeteccion = null;

let trayectoria = [];

let ultimaDeteccion = null;
let ultimaHora = 0;

let velocidadX = 0;
let velocidadY = 0;

let perdidaFrames = 0;

let fase = "esperando";


// ======================================================
// CARGAR MODELO
// ======================================================

async function cargarModelo() {

    loading.style.display = "block";
    loading.textContent = "Cargando detector de objetos...";

    try {

        modelo = await cocoSsd.load({
            base: "lite_mobilenet_v2"
        });

        loading.textContent = "Detector listo";

        setTimeout(() => {
            loading.style.display = "none";
        }, 1200);

        estado.textContent =
            "Detector listo. Enciende la cámara.";

    } catch (error) {

        console.error(error);

        loading.textContent =
            "No se pudo cargar el detector.";

        estado.textContent =
            "Error cargando el detector.";
    }
}


// ======================================================
// ENCENDER CÁMARA
// ======================================================

async function encenderCamara() {

    try {

        stream = await navigator.mediaDevices.getUserMedia({

            video: {
                width: {
                    ideal: 640
                },

                height: {
                    ideal: 480
                },

                facingMode: "environment"
            },

            audio: false

        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            grafica.width = grafica.clientWidth;
            grafica.height = 350;

            estado.textContent =
                "Cámara activa. Haz clic sobre el objeto que quieres seguir.";

            iniciarDeteccion();

        };

    } catch (error) {

        console.error(error);

        estado.textContent =
            "No se pudo acceder a la cámara. Debes permitir el acceso.";

    }
}


// ======================================================
// INICIAR DETECCIÓN
// ======================================================

function iniciarDeteccion() {

    if (intervaloDeteccion) {
        clearInterval(intervaloDeteccion);
    }

    intervaloDeteccion =
        setInterval(
            detectarObjetos,
            100
        );
}


// ======================================================
// DETECTAR OBJETOS
// ======================================================

async function detectarObjetos() {

    if (!modelo) return;

    if (video.readyState < 2) return;

    try {

        const resultados =
            await modelo.detect(
                video,
                20,
                0.45
            );


        /*
         * IMPORTANTE:
         * LAS PERSONAS SE ELIMINAN COMPLETAMENTE.
         *
         * Solo quedan objetos diferentes
         * de "person".
         */

        detecciones =
            resultados.filter(objeto => {

                return (
                    objeto.score >= 0.45 &&
                    objeto.class !== "person"
                );

            });


        procesarDetecciones();

    } catch (error) {

        console.error(
            "Error detectando objetos:",
            error
        );

    }
}


// ======================================================
// PROCESAR DETECCIONES
// ======================================================

function procesarDetecciones() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    dibujarObjetos();

    if (
        analizando &&
        objetoSeleccionado
    ) {

        seguirObjetoSeleccionado();

    }
}


// ======================================================
// DIBUJAR OBJETOS
// ======================================================

function dibujarObjetos() {

    detecciones.forEach(objeto => {

        const [
            x,
            y,
            ancho,
            alto
        ] = objeto.bbox;


        const seleccionado =
            objetoSeleccionado &&
            objeto ===
            objetoSeleccionado.deteccion;


        ctx.lineWidth =
            seleccionado ? 4 : 2;


        ctx.strokeStyle =
            seleccionado
                ? "#00ff66"
                : "#60a5fa";


        ctx.strokeRect(
            x,
            y,
            ancho,
            alto
        );


        ctx.font =
            "16px Arial";


        ctx.fillStyle =
            seleccionado
                ? "#00ff66"
                : "#60a5fa";


        ctx.fillText(

            `${objeto.class} ${Math.round(
                objeto.score * 100
            )}%`,

            x,

            Math.max(
                18,
                y - 5
            )

        );

    });
}


// ======================================================
// SELECCIONAR OBJETO CON UN SOLO CLIC
// ======================================================

canvas.addEventListener(
    "click",
    function(event) {

        if (!detecciones.length) {

            estado.textContent =
                "No hay objetos detectados.";

            return;
        }


        const rect =
            canvas.getBoundingClientRect();


        const escalaX =
            canvas.width /
            rect.width;


        const escalaY =
            canvas.height /
            rect.height;


        const clickX =
            (
                event.clientX -
                rect.left
            ) * escalaX;


        const clickY =
            (
                event.clientY -
                rect.top
            ) * escalaY;


        const candidatos =
            detecciones.filter(
                objeto => {

                    const [
                        x,
                        y,
                        ancho,
                        alto
                    ] = objeto.bbox;


                    return (

                        clickX >= x &&

                        clickX <=
                        x + ancho &&

                        clickY >= y &&

                        clickY <=
                        y + alto

                    );

                }
            );


        if (!candidatos.length) {

            estado.textContent =
                "Haz clic directamente sobre un objeto detectado. Las personas están excluidas.";

            return;
        }


        candidatos.sort(
            (a, b) =>
                b.score - a.score
        );


        const elegido =
            candidatos[0];


        const [
            x,
            y,
            ancho,
            alto
        ] = elegido.bbox;


        objetoSeleccionado = {

            clase: elegido.class,

            deteccion: elegido,

            x:
                x +
                ancho / 2,

            y:
                y +
                alto / 2,

            bbox:
                [...elegido.bbox]

        };


        resultadoObjeto.textContent =
            elegido.class;


        btnIniciar.disabled =
            false;


        estado.textContent =
            `Objeto seleccionado: ${elegido.class}. ` +
            `Ahora pulsa "Iniciar análisis".`;


        dibujarObjetos();

    }
);


// ======================================================
// INICIAR ANÁLISIS
// ======================================================

btnIniciar.addEventListener(
    "click",
    function() {

        if (!objetoSeleccionado) {

            estado.textContent =
                "Primero selecciona un objeto.";

            return;
        }


        trayectoria = [];

        analizando = true;

        perdidaFrames = 0;

        fase = "subiendo";

        ultimaDeteccion = null;

        ultimaHora =
            performance.now();

        velocidadX = 0;

        velocidadY = 0;


        resultadoTiempo.textContent =
            "---";

        resultadoVelocidadInicial.textContent =
            "---";

        resultadoVelocidadFinal.textContent =
            "---";

        resultadoDistancia.textContent =
            "---";

        resultadoAltura.textContent =
            "---";


        estado.textContent =
            "Analizando únicamente el objeto seleccionado...";

    }
);


// ======================================================
// SEGUIR SOLO EL OBJETO SELECCIONADO
// ======================================================

function seguirObjetoSeleccionado() {

    if (!objetoSeleccionado) {
        return;
    }


    /*
     * SOLO buscamos objetos de la misma clase
     * que seleccionó el usuario.
     *
     * Las personas ya fueron eliminadas
     * desde detectarObjetos().
     */

    const candidatos =
        detecciones.filter(
            objeto =>
                objeto.class ===
                objetoSeleccionado.clase
        );


    if (!candidatos.length) {

        perdidaFrames++;

        return;
    }


    const anteriorX =
        objetoSeleccionado.x;


    const anteriorY =
        objetoSeleccionado.y;


    let mejor = null;

    let mejorPuntuacion =
        Infinity;


    candidatos.forEach(
        objeto => {

            const [
                x,
                y,
                ancho,
                alto
            ] = objeto.bbox;


            const centroX =
                x +
                ancho / 2;


            const centroY =
                y +
                alto / 2;


            const distancia =
                Math.sqrt(

                    Math.pow(
                        centroX -
                        anteriorX,
                        2
                    )

                    +

                    Math.pow(
                        centroY -
                        anteriorY,
                        2
                    )

                );


            const iou =
                calcularIoU(
                    objetoSeleccionado.bbox,
                    objeto.bbox
                );


            /*
             * Priorizamos:
             *
             * 1. La posición anterior.
             * 2. El cuadro anterior.
             *
             * Esto evita cambiar fácilmente
             * a otro objeto de la misma clase.
             */

            const puntuacion =
                distancia -
                (iou * 150);


            if (
                puntuacion <
                mejorPuntuacion
            ) {

                mejorPuntuacion =
                    puntuacion;

                mejor =
                    objeto;

            }

        }
    );


    if (!mejor) {

        perdidaFrames++;

        return;
    }


    perdidaFrames = 0;


    const [
        x,
        y,
        ancho,
        alto
    ] = mejor.bbox;


    const centroX =
        x +
        ancho / 2;


    const centroY =
        y +
        alto / 2;


    const ahora =
        performance.now();


    if (
        ultimaDeteccion !== null
    ) {

        const dt =
            (
                ahora -
                ultimaHora
            ) / 1000;


        if (dt > 0) {

            velocidadX =
                (
                    centroX -
                    ultimaDeteccion.x
                ) / dt;


            velocidadY =
                (
                    centroY -
                    ultimaDeteccion.y
                ) / dt;

        }

    }


    ultimaDeteccion = {

        x: centroX,

        y: centroY

    };


    ultimaHora = ahora;


    objetoSeleccionado.x =
        centroX;


    objetoSeleccionado.y =
        centroY;


    objetoSeleccionado.bbox =
        [...mejor.bbox];


    objetoSeleccionado.deteccion =
        mejor;


    trayectoria.push({

        tiempo: ahora,

        x: centroX,

        y: centroY

    });


    analizarMovimiento();

    dibujarTrayectoria();

}


// ======================================================
// ANALIZAR MOVIMIENTO
// ======================================================

function analizarMovimiento() {

    if (
        trayectoria.length < 4
    ) {
        return;
    }


    const primero =
        trayectoria[0];


    const ultimo =
        trayectoria[
            trayectoria.length - 1
        ];


    /*
     * Y menor = objeto subiendo.
     * Y mayor = objeto bajando.
     */

    if (
        velocidadY < -10
    ) {

        fase = "subiendo";

    }


    if (
        velocidadY > 10 &&
        fase === "subiendo"
    ) {

        fase = "bajando";

    }


    /*
     * Cuando baja y vuelve
     * cerca de la altura inicial,
     * termina el análisis.
     */

    if (
        fase === "bajando" &&
        trayectoria.length > 15
    ) {

        const diferenciaInicial =
            Math.abs(
                ultimo.y -
                primero.y
            );


        const umbral =
            canvas.height *
            0.08;


        const tiempo =
            (
                ultimo.tiempo -
                primero.tiempo
            ) / 1000;


        if (
            diferenciaInicial <
            umbral &&
            tiempo > 0.5
        ) {

            finalizarAnalisis();

        }

    }

}


// ======================================================
// FINALIZAR ANÁLISIS
// ======================================================

function finalizarAnalisis() {

    if (!analizando) {
        return;
    }


    analizando = false;


    if (
        trayectoria.length < 5
    ) {

        estado.textContent =
            "No hubo suficientes datos.";

        return;
    }


    const primero =
        trayectoria[0];


    const ultimo =
        trayectoria[
            trayectoria.length - 1
        ];


    const tiempo =
        (
            ultimo.tiempo -
            primero.tiempo
        ) / 1000;


    const metros =
        parseFloat(
            document.getElementById(
                "metros"
            ).value
        );


    const pixeles =
        parseFloat(
            document.getElementById(
                "pixeles"
            ).value
        );


    if (
        !metros ||
        !pixeles ||
        metros <= 0 ||
        pixeles <= 0
    ) {

        estado.textContent =
            "Configura correctamente la calibración.";

        return;
    }


    const metrosPorPixel =
        metros / pixeles;


    // ==========================================
    // VELOCIDAD INICIAL
    // ==========================================

    const cantidad =
        Math.min(
            5,
            trayectoria.length - 1
        );


    const puntoInicial =
        trayectoria[cantidad];


    const dxInicial =
        puntoInicial.x -
        primero.x;


    const dyInicial =
        puntoInicial.y -
        primero.y;


    const dtInicial =
        (
            puntoInicial.tiempo -
            primero.tiempo
        ) / 1000;


    let velocidadInicial = 0;


    if (
        dtInicial > 0
    ) {

        velocidadInicial =
            Math.sqrt(

                dxInicial *
                dxInicial +

                dyInicial *
                dyInicial

            )
            *
            metrosPorPixel
            /
            dtInicial;

    }


    // ==========================================
    // VELOCIDAD FINAL
    // ==========================================

    const cantidadFinal =
        Math.min(
            5,
            trayectoria.length - 1
        );


    const indiceFinalInicio =
        trayectoria.length -
        1 -
        cantidadFinal;


    const puntoFinalInicio =
        trayectoria[
            indiceFinalInicio
        ];


    const dxFinal =
        ultimo.x -
        puntoFinalInicio.x;


    const dyFinal =
        ultimo.y -
        puntoFinalInicio.y;


    const dtFinal =
        (
            ultimo.tiempo -
            puntoFinalInicio.tiempo
        ) / 1000;


    let velocidadFinal = 0;


    if (
        dtFinal > 0
    ) {

        velocidadFinal =
            Math.sqrt(

                dxFinal *
                dxFinal +

                dyFinal *
                dyFinal

            )
            *
            metrosPorPixel
            /
            dtFinal;

    }


    // ==========================================
    // DISTANCIA HORIZONTAL
    // ==========================================

    const distanciaHorizontal =
        Math.abs(
            ultimo.x -
            primero.x
        )
        *
        metrosPorPixel;


    // ==========================================
    // ALTURA MÁXIMA
    // ==========================================

    let yMinimo =
        primero.y;


    trayectoria.forEach(
        punto => {

            if (
                punto.y <
                yMinimo
            ) {

                yMinimo =
                    punto.y;

            }

        }
    );


    const alturaMaxima =
        Math.abs(
            primero.y -
            yMinimo
        )
        *
        metrosPorPixel;


    // ==========================================
    // MOSTRAR RESULTADOS
    // ==========================================

    resultadoTiempo.textContent =
        tiempo.toFixed(2) +
        " s";


    resultadoVelocidadInicial.textContent =
        velocidadInicial.toFixed(2) +
        " m/s";


    resultadoVelocidadFinal.textContent =
        velocidadFinal.toFixed(2) +
        " m/s";


    resultadoDistancia.textContent =
        distanciaHorizontal.toFixed(2) +
        " m";


    resultadoAltura.textContent =
        alturaMaxima.toFixed(2) +
        " m";


    estado.textContent =
        "Análisis terminado. Se siguió únicamente el objeto seleccionado.";

}


// ======================================================
// DETENER
// ======================================================

btnDetener.addEventListener(
    "click",
    function() {

        analizando = false;

        trayectoria = [];

        objetoSeleccionado = null;

        resultadoObjeto.textContent =
            "---";

        btnIniciar.disabled =
            true;


        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        estado.textContent =
            "Análisis detenido. Puedes seleccionar otro objeto.";

    }
);


// ======================================================
// CALCULAR IOU
// ======================================================

function calcularIoU(a, b) {

    const ax = a[0];
    const ay = a[1];
    const aw = a[2];
    const ah = a[3];

    const bx = b[0];
    const by = b[1];
    const bw = b[2];
    const bh = b[3];


    const izquierda =
        Math.max(
            ax,
            bx
        );


    const arriba =
        Math.max(
            ay,
            by
        );


    const derecha =
        Math.min(
            ax + aw,
            bx + bw
        );


    const abajo =
        Math.min(
            ay + ah,
            by + bh
        );


    const ancho =
        Math.max(
            0,
            derecha -
            izquierda
        );


    const alto =
        Math.max(
            0,
            abajo -
            arriba
        );


    const interseccion =
        ancho *
        alto;


    const areaA =
        aw *
        ah;


    const areaB =
        bw *
        bh;


    const union =
        areaA +
        areaB -
        interseccion;


    if (
        union <= 0
    ) {
        return 0;
    }


    return (
        interseccion /
        union
    );

}


// ======================================================
// GRÁFICA DE TRAYECTORIA
// ======================================================

function dibujarTrayectoria() {

    graficaCtx.clearRect(
        0,
        0,
        grafica.width,
        grafica.height
    );


    if (
        trayectoria.length < 2
    ) {
        return;
    }


    const xs =
        trayectoria.map(
            punto =>
                punto.x
        );


    const ys =
        trayectoria.map(
            punto =>
                punto.y
        );


    const minX =
        Math.min(...xs);


    const maxX =
        Math.max(...xs);


    const minY =
        Math.min(...ys);


    const maxY =
        Math.max(...ys);


    const margen = 30;


    const rangoX =
        Math.max(
            1,
            maxX -
            minX
        );


    const rangoY =
        Math.max(
            1,
            maxY -
            minY
        );


    graficaCtx.beginPath();


    trayectoria.forEach(
        (punto, indice) => {

            const x =
                margen +

                (
                    (
                        punto.x -
                        minX
                    ) /
                    rangoX
                )
                *
                (
                    grafica.width -
                    margen * 2
                );


            const y =
                margen +

                (
                    (
                        maxY -
                        punto.y
                    ) /
                    rangoY
                )
                *
                (
                    grafica.height -
                    margen * 2
                );


            if (
                indice === 0
            ) {

                graficaCtx.moveTo(
                    x,
                    y
                );

            } else {

                graficaCtx.lineTo(
                    x,
                    y
                );

            }

        }
    );


    graficaCtx.strokeStyle =
        "#22c55e";


    graficaCtx.lineWidth =
        3;


    graficaCtx.stroke();

}


// ======================================================
// BOTÓN CÁMARA
// ======================================================

btnCamara.addEventListener(
    "click",
    encenderCamara
);


// ======================================================
// CARGAR MODELO
// ======================================================

cargarModelo();

