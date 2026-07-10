/* ============================================================
   simulation.js
   Motor de partidos: genera un resultado (o un relato minuto a
   minuto) a partir de las estadisticas de dos equipos, y hace
   evolucionar esas estadisticas de forma gradual tras cada partido.
   ============================================================ */

const SIM_CONFIG = {
  minutos: 90,
  probOcasionBase: 0.045,
  probOcasionPorAtaque: 0.00075,
  pGolMin: 0.06,
  pGolMax: 0.62,
  factorSuerte: 0.09,
  maxCambioStatPorPartido: 2,
  statMin: 25,
  statMax: 99,
  formaMin: -10,
  formaMax: 10
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ataqueEfectivo(team) {
  return clamp(team.stats.ataque + team.stats.forma * 0.8 + team.cicloValor * 0.5, 1, 99);
}

function defensaEfectiva(team) {
  return clamp(
    team.stats.defensa * 0.65 + team.stats.portero * 0.35 + team.stats.forma * 0.4 + team.cicloValor * 0.4,
    1,
    99
  );
}

const TEXTOS_FALLO = [
  "remata desviado",
  "el arquero ataja el remate",
  "¡pega en el palo!",
  "el defensor corta el balon a tiempo",
  "remata alto, ocasion desperdiciada",
  "gran tapada del portero"
];

function textoFalloAleatorio() {
  return TEXTOS_FALLO[Math.floor(Math.random() * TEXTOS_FALLO.length)];
}

/* Corre un bloque de partido de "duracion" minutos, empezando a contar
   desde "minutoInicio" (se usa tanto para los 90' normales como para
   los tiempos de la prorroga). */
function correrBloqueDePartido(equipoA, equipoB, minutoInicio, duracion) {
  const efA = ataqueEfectivo(equipoA);
  const efB = ataqueEfectivo(equipoB);
  const defA = defensaEfectiva(equipoA);
  const defB = defensaEfectiva(equipoB);

  let golesA = 0;
  let golesB = 0;
  const relato = [];

  for (let i = 1; i <= duracion; i++) {
    const minuto = minutoInicio + i;
    if (intentaOcasion(efA)) {
      const fueGol = resuelveOcasion(efA, defB);
      if (fueGol) {
        golesA++;
        relato.push({ minuto, tipo: "gol", equipoId: equipoA.id, texto: `¡GOOOL de ${equipoA.name}!` });
      } else {
        relato.push({ minuto, tipo: "fallo", equipoId: equipoA.id, texto: `${equipoA.name} ${textoFalloAleatorio()}` });
      }
    }
    if (intentaOcasion(efB)) {
      const fueGol = resuelveOcasion(efB, defA);
      if (fueGol) {
        golesB++;
        relato.push({ minuto, tipo: "gol", equipoId: equipoB.id, texto: `¡GOOOL de ${equipoB.name}!` });
      } else {
        relato.push({ minuto, tipo: "fallo", equipoId: equipoB.id, texto: `${equipoB.name} ${textoFalloAleatorio()}` });
      }
    }
  }

  relato.sort((a, b) => a.minuto - b.minuto);
  return { golesA, golesB, relato };
}

function correrMotorDePartido(equipoA, equipoB) {
  const estadio = estadioAleatorio(equipoA); // el local elige la cancha
  const relatoInfo = { minuto: 0, tipo: "info", equipoId: null, texto: `Los equipos saltan a la cancha en el ${estadio}.` };
  const bloque = correrBloqueDePartido(equipoA, equipoB, 0, SIM_CONFIG.minutos);
  return { golesA: bloque.golesA, golesB: bloque.golesB, relato: [relatoInfo, ...bloque.relato], estadio };
}

function intentaOcasion(ataqueEf) {
  const prob = SIM_CONFIG.probOcasionBase + ataqueEf * SIM_CONFIG.probOcasionPorAtaque;
  return Math.random() < prob;
}

function resuelveOcasion(ataqueEf, defensaEf) {
  let pGol = 0.18 + (ataqueEf - defensaEf) / 130;
  const suerte = (Math.random() * 2 - 1) * SIM_CONFIG.factorSuerte;
  pGol = clamp(pGol + suerte, SIM_CONFIG.pGolMin, SIM_CONFIG.pGolMax);
  return Math.random() < pGol;
}

function obtenerResultadoDirecto(equipoA, equipoB) {
  const { golesA, golesB } = correrMotorDePartido(equipoA, equipoB);
  return { golesA, golesB };
}

function simularPartidoConRelato(equipoA, equipoB) {
  return correrMotorDePartido(equipoA, equipoB);
}

function evolucionarEstadisticas(equipo, golesFavor, golesContra, fechaGlobal) {
  const gano = golesFavor > golesContra;
  const empato = golesFavor === golesContra;
  const perdio = golesFavor < golesContra;
  const vallaInvicta = golesContra === 0;

  const max = SIM_CONFIG.maxCambioStatPorPartido;
  let deltaAtaque = 0;
  let deltaDefensa = 0;
  let deltaPortero = 0;
  let deltaForma = 0;

  if (gano) {
    deltaForma = 2;
    deltaAtaque = golesFavor >= 2 ? rand(1, max) : rand(0, 1);
  } else if (empato) {
    deltaForma = 0;
    deltaAtaque = rand(-1, 1);
  } else if (perdio) {
    deltaForma = -2;
    deltaAtaque = golesContra >= 3 ? -rand(1, max) : rand(-1, 0);
  }

  if (vallaInvicta) {
    deltaDefensa = rand(1, max);
    deltaPortero = rand(0, 1);
  } else if (golesContra >= 3) {
    deltaDefensa = -rand(1, max);
    deltaPortero = -rand(0, 1);
  } else {
    deltaDefensa = rand(-1, 1);
  }

  const tendenciaNeutral = equipo.stats.forma > 0 ? -1 : equipo.stats.forma < 0 ? 1 : 0;

  /* ---------- Ciclo de era ----------
     Cada equipo tiene rachas de 2 a 4 "temporadas" de buena o mala
     suerte, independientes del resultado puntual. Al agotarse el
     contador se sortea un nuevo objetivo, y el valor actual se
     desliza suavemente hacia el hasta llegar. Esto es lo que hace
     que un equipo entre en un "periodo dorado" o en una "mala racha"
     que puede durar bastante y que puede ser noticia. */
  equipo.cicloRestante--;
  if (equipo.cicloRestante <= 0) {
    equipo.cicloObjetivo = rand(-14, 14);
    equipo.cicloRestante = rand(10, 22);
  }
  equipo.cicloValor += (equipo.cicloObjetivo - equipo.cicloValor) * 0.12;

  /* Sesgo extra a la evolucion segun el ciclo: en auge, hasta ganando
     poco se sigue subiendo un poco mas; en declive, hasta ganando
     cuesta subir (y perdiendo se cae mas rapido). */
  const sesgoCiclo = equipo.cicloValor / 12; // aprox -1 a 1
  deltaAtaque += sesgoCiclo > 0.4 ? rand(0, 1) : sesgoCiclo < -0.4 ? -rand(0, 1) : 0;
  deltaDefensa += sesgoCiclo > 0.4 ? rand(0, 1) : sesgoCiclo < -0.4 ? -rand(0, 1) : 0;

  /* Reversion suave a la media: evita que una estadistica se quede
     pegada para siempre en el techo (99) o en el piso (25), asi
     con el tiempo hay recambio de selecciones "top". */
  const media = 62;
  const reversionAtaque = -(equipo.stats.ataque - media) * 0.018;
  const reversionDefensa = -(equipo.stats.defensa - media) * 0.018;
  const reversionPortero = -(equipo.stats.portero - media) * 0.012;

  equipo.stats.ataque = clamp(equipo.stats.ataque + deltaAtaque + reversionAtaque, SIM_CONFIG.statMin, SIM_CONFIG.statMax);
  equipo.stats.defensa = clamp(equipo.stats.defensa + deltaDefensa + reversionDefensa, SIM_CONFIG.statMin, SIM_CONFIG.statMax);
  equipo.stats.portero = clamp(equipo.stats.portero + deltaPortero + reversionPortero, SIM_CONFIG.statMin, SIM_CONFIG.statMax);
  equipo.stats.forma = clamp(
    equipo.stats.forma + deltaForma + tendenciaNeutral * 0.5,
    SIM_CONFIG.formaMin,
    SIM_CONFIG.formaMax
  );

  equipo.statHistory.push({
    fecha: fechaGlobal,
    ataque: equipo.stats.ataque,
    defensa: equipo.stats.defensa,
    portero: equipo.stats.portero,
    forma: equipo.stats.forma
  });
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function jugarPartido(equipoA, equipoB, modo, fechaGlobal) {
  const resultado =
    modo === "simular"
      ? simularPartidoConRelato(equipoA, equipoB)
      : obtenerResultadoDirecto(equipoA, equipoB);

  const golesA = resultado.golesA;
  const golesB = resultado.golesB;

  evolucionarEstadisticas(equipoA, golesA, golesB, fechaGlobal);
  evolucionarEstadisticas(equipoB, golesB, golesA, fechaGlobal);

  return {
    equipoAId: equipoA.id,
    equipoBId: equipoB.id,
    golesA,
    golesB,
    relato: resultado.relato || null,
    fecha: fechaGlobal
  };
}

/* ============================================================
   Partidos a ELIMINACION DIRECTA (repechaje y bracket del Mundial):
   no puede haber empate. Si siguen igualados tras los 90', se juega
   la prorroga (15' + 15'); si el empate persiste, se define por
   penales.
   ============================================================ */

const PENAL_CONFIG = {
  probBase: 0.78,
  ajustePortero: 300, // portero mejor => reduce probabilidad del pateador
  ajusteAtaque: 400   // ataque mejor => aumenta probabilidad del pateador
};

function probabilidadGolPenal(equipoPatea, equipoAtaja) {
  const ajustePortero = (equipoAtaja.stats.portero - 60) / PENAL_CONFIG.ajustePortero;
  const ajusteAtaque = (equipoPatea.stats.ataque - 60) / PENAL_CONFIG.ajusteAtaque;
  const p = PENAL_CONFIG.probBase - ajustePortero + ajusteAtaque;
  return clamp(p, 0.55, 0.93);
}

/* Devuelve la secuencia completa de penales (para animarla como
   circulos verdes/rojos) + el ganador. */
function simularPenales(equipoA, equipoB) {
  const tandas = [];
  let totalA = 0;
  let totalB = 0;

  for (let ronda = 1; ronda <= 5; ronda++) {
    const golA = Math.random() < probabilidadGolPenal(equipoA, equipoB);
    tandas.push({ ronda, equipoId: equipoA.id, gol: golA });
    if (golA) totalA++;

    const golB = Math.random() < probabilidadGolPenal(equipoB, equipoA);
    tandas.push({ ronda, equipoId: equipoB.id, gol: golB });
    if (golB) totalB++;
  }

  let rondaExtra = 6;
  while (totalA === totalB && rondaExtra <= 25) {
    const golA = Math.random() < probabilidadGolPenal(equipoA, equipoB);
    tandas.push({ ronda: rondaExtra, equipoId: equipoA.id, gol: golA });
    if (golA) totalA++;

    const golB = Math.random() < probabilidadGolPenal(equipoB, equipoA);
    tandas.push({ ronda: rondaExtra, equipoId: equipoB.id, gol: golB });
    if (golB) totalB++;

    rondaExtra++;
  }

  const ganadorId = totalA >= totalB ? equipoA.id : equipoB.id;
  return { tandas, totalA, totalB, ganadorId };
}

/* Partido completo a eliminacion directa: 90' + (si hace falta)
   prorroga de 30' + (si hace falta) penales. Nunca termina en
   empate. NO se usa para fase de grupos ni eliminatorias. */
function correrPartidoEliminatorio(equipoA, equipoB) {
  const estadio = estadioAleatorio(equipoA);
  let relato = [
    { minuto: 0, tipo: "info", equipoId: null, texto: `Los equipos saltan a la cancha en el ${estadio}. ¡Partido a eliminacion directa, aqui no hay empates posibles!` }
  ];

  const regular = correrBloqueDePartido(equipoA, equipoB, 0, SIM_CONFIG.minutos);
  relato = relato.concat(regular.relato);
  let golesA = regular.golesA;
  let golesB = regular.golesB;

  let fueAProrroga = false;
  let fueAPenales = false;
  let penales = null;

  if (golesA === golesB) {
    fueAProrroga = true;
    relato.push({ minuto: 90, tipo: "info", equipoId: null, texto: "⏱️ Empate al final del tiempo reglamentario. ¡Vamos a la prorroga!" });

    const et1 = correrBloqueDePartido(equipoA, equipoB, 90, 15);
    relato = relato.concat(et1.relato);
    golesA += et1.golesA; golesB += et1.golesB;

    const et2 = correrBloqueDePartido(equipoA, equipoB, 105, 15);
    relato = relato.concat(et2.relato);
    golesA += et2.golesA; golesB += et2.golesB;

    if (golesA === golesB) {
      relato.push({ minuto: 120, tipo: "info", equipoId: null, texto: "⏱️ Sigue el empate tras la prorroga. ¡Definicion por penales!" });
      penales = simularPenales(equipoA, equipoB);
      fueAPenales = true;
    }
  }

  const ganadorId = golesA !== golesB
    ? (golesA > golesB ? equipoA.id : equipoB.id)
    : penales.ganadorId;

  return { golesA, golesB, relato, estadio, fueAProrroga, fueAPenales, penales, ganadorId };
}

/* Version "de alto nivel" que ademas hace evolucionar las estadisticas
   (con base en el resultado de los 90'/prorroga, sin contar los penales,
   ya que la tanda es mucho mas dependiente de la suerte). */
function jugarPartidoEliminatorio(equipoA, equipoB, fechaGlobal) {
  const resultado = correrPartidoEliminatorio(equipoA, equipoB);

  evolucionarEstadisticas(equipoA, resultado.golesA, resultado.golesB, fechaGlobal);
  evolucionarEstadisticas(equipoB, resultado.golesB, resultado.golesA, fechaGlobal);

  return {
    equipoAId: equipoA.id,
    equipoBId: equipoB.id,
    golesA: resultado.golesA,
    golesB: resultado.golesB,
    relato: resultado.relato,
    estadio: resultado.estadio,
    fueAProrroga: resultado.fueAProrroga,
    fueAPenales: resultado.fueAPenales,
    penales: resultado.penales,
    ganadorId: resultado.ganadorId,
    fecha: fechaGlobal
  };
}
