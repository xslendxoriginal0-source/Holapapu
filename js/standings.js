/* ============================================================
   standings.js
   Generador de fixture (todos contra todos, ida y vuelta, por
   fechas/jornadas), calculo de tabla de posiciones, y el motor
   que avanza fechas jugando partidos en las 5 confederaciones
   a la vez.
   ============================================================ */

// FIXTURES[confedId] = { jornadas: [ [match, match, ...], [match,...], ... ] }
const FIXTURES = {};

// Historial de partidos jugados (para la pestaña "Partidos Jugados"),
// mas reciente primero.
const PARTIDOS_JUGADOS = {}; // PARTIDOS_JUGADOS[confedId] = [match, match...]

/* ---------- Generador de calendario (metodo del circulo) ----------
   Genera ida y vuelta: cada equipo juega contra todos los demas de
   SU confederacion 2 veces (una de local, una de visita), repartido
   en jornadas/fechas. */
function generarRoundRobinIds(teamIds) {
  let ids = [...teamIds];
  const conBye = ids.length % 2 !== 0;
  if (conBye) ids.push(null); // equipo "descansa" esa fecha

  const n = ids.length;
  const rondas = n - 1;
  const mitad = n / 2;
  let arr = ids.slice();

  const idaVuelta = []; // primera vuelta

  for (let r = 0; r < rondas; r++) {
    const partidosRonda = [];
    for (let i = 0; i < mitad; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) {
        // alternamos localia ronda a ronda para que sea mas parejo
        partidosRonda.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
    }
    idaVuelta.push(partidosRonda);
    const fijo = arr[0];
    const resto = arr.slice(1);
    resto.unshift(resto.pop());
    arr = [fijo, ...resto];
  }

  // Segunda vuelta: mismos cruces, localia invertida, fechas nuevas
  const vueltaCompleta = idaVuelta.map((ronda) => ronda.map(([a, b]) => [b, a]));

  return [...idaVuelta, ...vueltaCompleta];
}

function generarFixtureConfed(confedId) {
  const teams = getTeamsByConfed(confedId);
  const teamIds = teams.map((t) => t.id);
  const rondas = generarRoundRobinIds(teamIds);

  const jornadas = rondas.map((ronda) =>
    ronda.map(([equipoAId, equipoBId]) => ({
      equipoAId,
      equipoBId,
      jugado: false,
      golesA: null,
      golesB: null,
      relato: null,
      fecha: null
    }))
  );

  FIXTURES[confedId] = { jornadas };
  PARTIDOS_JUGADOS[confedId] = [];
}

function generarTodosLosFixtures() {
  CONFEDERATIONS.forEach((conf) => generarFixtureConfed(conf.id));
}

/* ---------- Consultas de fixture ---------- */

/* Devuelve el indice de la primera jornada con partidos sin jugar,
   o null si ya se jugo todo el calendario de esa confederacion. */
function proximaJornadaIndex(confedId) {
  const { jornadas } = FIXTURES[confedId];
  for (let i = 0; i < jornadas.length; i++) {
    if (jornadas[i].some((m) => !m.jugado)) return i;
  }
  return null;
}

function confedTerminada(confedId) {
  return proximaJornadaIndex(confedId) === null;
}

function todasLasConfedsTerminadas() {
  return CONFEDERATIONS.every((c) => confedTerminada(c.id));
}

/* ---------- Jugar un partido puntual (botones Resultado / Simular) ----------
   modo: "resultado" | "simular" */
function jugarPartidoDeFixture(confedId, jornadaIndex, matchIndex, modo) {
  const match = FIXTURES[confedId].jornadas[jornadaIndex][matchIndex];
  if (match.jugado) return match; // ya jugado, no se repite

  const equipoA = getTeamById(match.equipoAId);
  const equipoB = getTeamById(match.equipoBId);

  const resultado = jugarPartido(equipoA, equipoB, modo, state.fechaGlobal);

  match.jugado = true;
  match.golesA = resultado.golesA;
  match.golesB = resultado.golesB;
  match.relato = resultado.relato;
  match.estadio = resultado.estadio;
  match.fecha = state.fechaGlobal;

  PARTIDOS_JUGADOS[confedId].unshift(match); // mas reciente primero

  return match;
}

/* ---------- Avanzar fecha: motor universal de "fast forward" ----------
   Segun la fase del juego, hace una cosa distinta:
   - Si quedan jornadas de eliminatoria, juega la proxima en las 5
     confederaciones a la vez.
   - Si las eliminatorias terminaron pero el repechaje no se ha
     iniciado, lo arma (sortea sede + clasificados).
   - Si el repechaje esta pendiente, resuelve todos sus partidos.
   - Si la fase de grupos tiene jornada pendiente, la juega en los
     8 grupos a la vez.
   - Si hay una ronda de bracket pendiente, resuelve todos sus partidos.
   - Si el mundial ya termino, reinicia la temporada (misma logica,
     estadisticas conservadas). */
function avanzarFechaGlobal() {
  // 1) Eliminatorias
  if (!todasLasConfedsTerminadas()) {
    let seJugoAlgo = false;
    CONFEDERATIONS.forEach((conf) => {
      const idx = proximaJornadaIndex(conf.id);
      if (idx === null) return;
      const jornada = FIXTURES[conf.id].jornadas[idx];
      jornada.forEach((match, matchIndex) => {
        if (!match.jugado) {
          jugarPartidoDeFixture(conf.id, idx, matchIndex, "resultado");
          seJugoAlgo = true;
        }
      });
    });
    if (seJugoAlgo) state.fechaGlobal++;
    if (todasLasConfedsTerminadas()) {
      state.repechajeDesbloqueado = true;
    }
    return true;
  }

  // 2) Arrancar el repechaje si aun no existe
  if (MUNDIAL.fase === "pendiente") {
    iniciarMundial();
    state.repechajeDesbloqueado = true;
    state.fechaGlobal++;
    return true;
  }

  // 3) Resolver todo el repechaje pendiente
  if (MUNDIAL.fase === "repechaje") {
    MUNDIAL.repechajePartidos.forEach((m) => {
      if (!m.jugado) jugarPartidoEliminacion(m, "resultado");
    });
    cerrarRepechajeYSortear();
    state.mundialDesbloqueado = true;
    state.fechaGlobal++;
    return true;
  }

  // 4) Fase de grupos: jugar la proxima jornada pendiente en los 8 grupos
  if (MUNDIAL.fase === "grupos") {
    let seJugoAlgo = false;
    MUNDIAL.grupos.forEach((grupo) => {
      const idx = proximaJornadaGrupoIndex(grupo);
      if (idx === null) return;
      grupo.jornadas[idx].forEach((match, matchIndex) => {
        if (!match.jugado) {
          jugarPartidoDeGrupo(grupo.nombre, idx, matchIndex, "resultado");
          seJugoAlgo = true;
        }
      });
    });
    if (todosLosGruposTerminados()) {
      avanzarAKnockoutInicial();
    }
    if (seJugoAlgo) state.fechaGlobal++;
    return true;
  }

  // 5) Rondas de eliminacion directa (dieciseisavos, octavos, cuartos, semis, final + tercer lugar)
  if (["dieciseisavos", "octavos", "cuartos", "semis", "final"].includes(MUNDIAL.fase)) {
    const ronda = MUNDIAL.fase;
    MUNDIAL.bracket[ronda].forEach((m) => {
      if (!m.jugado) jugarPartidoEliminacion(m, "resultado");
    });
    if (ronda === "final") {
      MUNDIAL.bracket.tercerLugar.forEach((m) => {
        if (!m.jugado) jugarPartidoEliminacion(m, "resultado");
      });
    }
    avanzarSiguienteRondaBracket();
    state.fechaGlobal++;
    return true;
  }

  // 6) El mundial ya termino: nueva temporada
  if (MUNDIAL.fase === "terminado") {
    reiniciarTemporada();
    state.fechaGlobal++;
    return true;
  }

  return false;
}

/* ---------- Tabla de posiciones ----------
   Desempates: Puntos -> Diferencia de gol -> Goles a favor -> Nombre (alfabetico)
   como ultimo criterio para que el orden sea siempre estable. */
function calcularTabla(confedId) {
  const teams = getTeamsByConfed(confedId);
  const tabla = teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    pts: 0
  }));

  const porId = Object.fromEntries(tabla.map((row) => [row.teamId, row]));

  const { jornadas } = FIXTURES[confedId];
  jornadas.forEach((jornada) => {
    jornada.forEach((match) => {
      if (!match.jugado) return;
      const rowA = porId[match.equipoAId];
      const rowB = porId[match.equipoBId];
      rowA.pj++; rowB.pj++;
      rowA.gf += match.golesA; rowA.gc += match.golesB;
      rowB.gf += match.golesB; rowB.gc += match.golesA;

      if (match.golesA > match.golesB) {
        rowA.pg++; rowA.pts += 3;
        rowB.pp++;
      } else if (match.golesA < match.golesB) {
        rowB.pg++; rowB.pts += 3;
        rowA.pp++;
      } else {
        rowA.pe++; rowB.pe++;
        rowA.pts += 1; rowB.pts += 1;
      }
    });
  });

  tabla.forEach((row) => (row.dg = row.gf - row.gc));

  tabla.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });

  return tabla;
}
