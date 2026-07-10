/* ============================================================
   worldcup.js
   Todo el ciclo del Mundial:
   0) Antes de las eliminatorias: elegir formato (32 u 48) y
      sortear entre 1 y 4 paises sede (elegirSedes(), llamado
      desde la pantalla de configuracion inicial).
   1) Al terminar las eliminatorias: calculo de clasificados
      (directos + repechaje), usando ranking normalizado entre
      confeds. Las sedes ya tienen su cupo asegurado.
   2) Repechaje: 8 llaves a partido unico (con prorroga y
      penales si hace falta) -> 8 ganadores completan el cupo.
   3) Sorteo de grupos (bombos por nivel, evitando en lo posible
      que 2 equipos de la misma confederacion caigan juntos).
   4) Fase de grupos (todos contra todos, 1 vuelta, 3 fechas).
   5) Camino a la copa: (dieciseisavos si es formato 48),
      octavos, cuartos, semis, final + tercer lugar.
   6) Reinicio de temporada conservando las estadisticas
      evolucionadas; el mundial recien terminado pasa a ser
      "el anterior" (solo se guardan el actual y el anterior).
   ============================================================ */

let MUNDIAL = crearMundialVacio();
let MUNDIAL_ANTERIOR = null; // solo se conserva el ciclo previo, para no acumular
let HISTORIAL_MUNDIALES = []; // esto si se conserva siempre (pestaña Campeones)

function crearMundialVacio() {
  return {
    fase: "pendiente", // pendiente -> repechaje -> grupos -> [dieciseisavos ->] octavos -> cuartos -> semis -> final -> terminado
    formato: null,           // 32 o 48, copiado de state.formatoMundial al iniciar
    sedeNombre: null,        // copia de state.sede al iniciar (para conservarlo en "anterior")
    directos: [],            // ids con cupo directo (incluye las sedes)
    candidatosRepechaje: [],  // ids antes de jugar el repechaje
    repechajePartidos: [],    // partidos planos
    clasificadosFinal: [],    // ids una vez resuelto el repechaje
    grupos: null,
    bracket: { dieciseisavos: [], octavos: [], cuartos: [], semis: [], final: [], tercerLugar: [] },
    campeonId: null,
    subcampeonId: null,
    tercerId: null
  };
}

/* ---------- Paso 0: elegir sede(s) (se llama ANTES de las eliminatorias,
   desde la pantalla de configuracion inicial) ---------- */
function elegirCantidadSedes() {
  const r = Math.random();
  if (r < 0.5) return 1;
  if (r < 0.75) return 2;
  if (r < 0.92) return 3;
  return 4;
}

function elegirEquipoAleatorio(pool, idsUsados) {
  const disponibles = pool.filter((t) => !idsUsados.has(t.id));
  if (disponibles.length === 0) return null;
  return disponibles[Math.floor(Math.random() * disponibles.length)];
}

function elegirSedes() {
  const cantidad = elegirCantidadSedes();
  const confedBase = CONFEDERATIONS[Math.floor(Math.random() * CONFEDERATIONS.length)];
  const idsUsados = new Set();
  const sedes = [];

  const primerEquipo = elegirEquipoAleatorio(getTeamsByConfed(confedBase.id), idsUsados);
  sedes.push(primerEquipo);
  idsUsados.add(primerEquipo.id);

  for (let i = 1; i < cantidad; i++) {
    const mismaConfed = Math.random() < 0.8; // 80% co-sede de la misma confederacion
    const pool = mismaConfed ? getTeamsByConfed(confedBase.id) : TEAMS;
    const elegido = elegirEquipoAleatorio(pool, idsUsados) || elegirEquipoAleatorio(TEAMS, idsUsados);
    if (elegido) {
      sedes.push(elegido);
      idsUsados.add(elegido.id);
    }
  }

  state.sedes = sedes.map((t) => t.id);
  state.sede = sedes.map((t) => t.name).join(" - ");
  state.sedeTeamId = sedes[0].id; // por compatibilidad con partes que asumen una sola sede
  return sedes;
}

/* Colores de la(s) confederacion(es) sede, para tematizar el Mundial */
function coloresMundial() {
  const idsConfeds = [...new Set((state.sedes || []).map((id) => getTeamById(id).confedId))];
  if (idsConfeds.length === 0) return ["#E8B84B", "#F2D06B"];
  if (idsConfeds.length === 1) {
    const conf = getConfederation(idsConfeds[0]);
    return [conf.colors.primary, conf.colors.secondary];
  }
  return idsConfeds.map((cid) => getConfederation(cid).colors.primary);
}

/* ---------- Paso 1: clasificados (una vez terminan las eliminatorias) ---------- */
function iniciarMundial() {
  MUNDIAL = crearMundialVacio();
  MUNDIAL.formato = state.formatoMundial || 32;
  MUNDIAL.sedeNombre = state.sede;

  const sedeIds = state.sedes && state.sedes.length ? [...state.sedes] : elegirSedes().map((t) => t.id);
  const candidatos = [];

  CONFEDERATIONS.forEach((conf) => {
    const tabla = calcularTabla(conf.id); // ya viene ordenada de mejor a peor
    const cupos = cuposConfed(conf);
    const sedesAqui = sedeIds.filter((id) => getTeamById(id).confedId === conf.id);
    const cuposCompetitivos = Math.max(0, cupos - sedesAqui.length);

    const otros = tabla.filter((row) => !sedeIds.includes(row.teamId));
    const qualifiedIds = otros.slice(0, cuposCompetitivos).map((r) => r.teamId);

    qualifiedIds.forEach((teamId) => {
      const row = tabla.find((r) => r.teamId === teamId);
      const partidos = row.pj || 1;
      const scoreNormalizado = row.pts / partidos + (row.dg / partidos) * 0.3;
      candidatos.push({ teamId, score: scoreNormalizado });
    });
  });

  candidatos.sort((a, b) => b.score - a.score);

  const totalObjetivo = MUNDIAL.formato === 48 ? 48 : 32;
  const directExtraCount = Math.max(0, totalObjetivo - sedeIds.length - 8); // 8 salen del repechaje
  const directosExtra = candidatos.slice(0, directExtraCount).map((c) => c.teamId);
  const paraRepechaje = candidatos.slice(directExtraCount).map((c) => c.teamId);

  MUNDIAL.directos = [...sedeIds, ...directosExtra];
  MUNDIAL.candidatosRepechaje = paraRepechaje;
  MUNDIAL.fase = "repechaje";

  generarNoticiasClasificacion();
  generarPartidosRepechaje();
}

/* Noticias de "sorpresa": favoritos que se quedaron fuera del Mundial
   y selecciones modestas que sí clasificaron, ademas de destacar
   ciclos de era en auge o declive marcado. */
function generarNoticiasClasificacion() {
  const promedioGeneral = TEAMS.reduce((s, t) => s + nivelGeneral(t), 0) / TEAMS.length;
  const umbralFavorito = promedioGeneral + 12;
  const umbralModesto = promedioGeneral - 10;

  CONFEDERATIONS.forEach((conf) => {
    const tabla = calcularTabla(conf.id);
    const cupos = cuposConfed(conf);
    tabla.forEach((row, i) => {
      const team = getTeamById(row.teamId);
      const clasifico = i < cupos || (state.sedes || []).includes(team.id);
      const nivel = nivelGeneral(team);

      if (!clasifico && (nivel >= umbralFavorito || team.titulos > 0)) {
        NOTICIAS_ESPECIALES.unshift(
          `😮 SORPRESA — ${team.name}, uno de los que se creían favoritos${team.titulos > 0 ? " (ex campeón)" : ""}, no logró clasificar al Mundial.`
        );
      } else if (clasifico && nivel <= umbralModesto) {
        NOTICIAS_ESPECIALES.unshift(
          `🌟 CENICIENTA — ${team.name} clasifica al Mundial pese a no ser de los favoritos de ${conf.name}.`
        );
      }
    });
  });

  MUNDIAL.directos.concat(MUNDIAL.candidatosRepechaje).forEach((teamId) => {
    const team = getTeamById(teamId);
    const estado = estadoCiclo(team);
    if (estado === "auge") {
      NOTICIAS_ESPECIALES.unshift(`📈 ${team.name} llega al Mundial atravesando el mejor momento de su historia reciente.`);
    } else if (estado === "declive") {
      NOTICIAS_ESPECIALES.unshift(`📉 ${team.name} clasificó, pero arrastra una racha floja que preocupa a su hinchada.`);
    }
  });

  NOTICIAS_ESPECIALES = NOTICIAS_ESPECIALES.slice(0, 20);
}

function generarPartidosRepechaje() {
  const ids = MUNDIAL.candidatosRepechaje; // vienen ordenados de mejor a peor dentro del grupo
  const n = ids.length;
  const partidos = [];
  for (let i = 0; i < n / 2; i++) {
    partidos.push({
      equipoAId: ids[i],
      equipoBId: ids[n - 1 - i],
      jugado: false,
      golesA: null,
      golesB: null,
      relato: null,
      estadio: null,
      ganadorId: null,
      penales: false
    });
  }
  MUNDIAL.repechajePartidos = partidos;
}

/* ---------- Jugar un partido a eliminacion directa (repechaje o bracket) ----------
   Usa el motor sin empates: 90' -> prorroga 30' -> penales si hace falta.
   Devuelve el match ya resuelto, con ganadorId siempre definido. */
function jugarPartidoEliminacion(match, modo) {
  if (match.jugado) return match;
  const equipoA = getTeamById(match.equipoAId);
  const equipoB = getTeamById(match.equipoBId);

  const resultado = jugarPartidoEliminatorio(equipoA, equipoB, state.fechaGlobal);

  match.golesA = resultado.golesA;
  match.golesB = resultado.golesB;
  match.relato = resultado.relato;
  match.estadio = resultado.estadio;
  match.fueAProrroga = resultado.fueAProrroga;
  match.fueAPenales = resultado.fueAPenales;
  match.penales = resultado.penales;
  match.ganadorId = resultado.ganadorId;
  match.jugado = true;

  return match;
}

function repechajeCompleto() {
  return MUNDIAL.repechajePartidos.length > 0 && MUNDIAL.repechajePartidos.every((m) => m.jugado);
}

/* ---------- Paso 2 -> 3: cerrar repechaje y sortear grupos ---------- */
function cerrarRepechajeYSortear() {
  const ganadores = MUNDIAL.repechajePartidos.map((m) => m.ganadorId);
  MUNDIAL.clasificadosFinal = [...MUNDIAL.directos, ...ganadores];
  MUNDIAL.grupos = sortearGrupos(MUNDIAL.clasificadosFinal);
  MUNDIAL.fase = "grupos";
}

function sortearGrupos(equipoIds) {
  const numGrupos = equipoIds.length / 4;
  const conRating = equipoIds.map((id) => {
    const t = getTeamById(id);
    return { id, rating: nivelGeneral(t), confedId: t.confedId };
  });
  conRating.sort((a, b) => b.rating - a.rating);

  // 4 bombos de "numGrupos" equipos cada uno, segun nivel
  const bombos = [[], [], [], []];
  conRating.forEach((e, i) => bombos[Math.floor(i / numGrupos)].push(e));

  const grupos = Array.from({ length: numGrupos }, (_, i) => ({
    nombre: String.fromCharCode(65 + i), // A, B, C...
    equipos: []
  }));

  bombos.forEach((bombo) => {
    const disponibles = [...bombo].sort(() => Math.random() - 0.5);
    grupos.forEach((g) => {
      let idx = disponibles.findIndex(
        (e) => !g.equipos.some((id) => getTeamById(id).confedId === e.confedId)
      );
      if (idx === -1) idx = 0; // si no se puede evitar, se asigna igual
      const elegido = disponibles.splice(idx, 1)[0];
      g.equipos.push(elegido.id);
    });
  });

  grupos.forEach((g) => {
    g.jornadas = generarJornadasGrupo(g.equipos);
  });

  return grupos;
}

/* Calendario clasico de grupo de 4: 3 fechas, cada equipo juega 1 vez por fecha */
function generarJornadasGrupo(ids) {
  const [a, b, c, d] = ids;
  const esquema = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]]
  ];
  return esquema.map((fecha) =>
    fecha.map(([eqA, eqB]) => ({
      equipoAId: eqA,
      equipoBId: eqB,
      jugado: false,
      golesA: null,
      golesB: null,
      relato: null,
      estadio: null
    }))
  );
}

function proximaJornadaGrupoIndex(grupo) {
  for (let i = 0; i < grupo.jornadas.length; i++) {
    if (grupo.jornadas[i].some((m) => !m.jugado)) return i;
  }
  return null;
}

function todosLosGruposTerminados() {
  return MUNDIAL.grupos.every((g) => proximaJornadaGrupoIndex(g) === null);
}

function jugarPartidoDeGrupo(grupoNombre, jornadaIndex, matchIndex, modo) {
  const grupo = MUNDIAL.grupos.find((g) => g.nombre === grupoNombre);
  const match = grupo.jornadas[jornadaIndex][matchIndex];
  if (match.jugado) return match;

  const equipoA = getTeamById(match.equipoAId);
  const equipoB = getTeamById(match.equipoBId);
  const resultado = jugarPartido(equipoA, equipoB, modo, state.fechaGlobal);

  match.golesA = resultado.golesA;
  match.golesB = resultado.golesB;
  match.relato = resultado.relato;
  match.estadio = resultado.estadio;
  match.jugado = true;

  return match;
}

function calcularTablaGrupo(grupo) {
  const tabla = grupo.equipos.map((id) => {
    const t = getTeamById(id);
    return { teamId: id, name: t.name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
  });
  const porId = Object.fromEntries(tabla.map((row) => [row.teamId, row]));

  grupo.jornadas.forEach((jornada) => {
    jornada.forEach((match) => {
      if (!match.jugado) return;
      const rowA = porId[match.equipoAId];
      const rowB = porId[match.equipoBId];
      rowA.pj++; rowB.pj++;
      rowA.gf += match.golesA; rowA.gc += match.golesB;
      rowB.gf += match.golesB; rowB.gc += match.golesA;
      if (match.golesA > match.golesB) { rowA.pg++; rowA.pts += 3; rowB.pp++; }
      else if (match.golesA < match.golesB) { rowB.pg++; rowB.pts += 3; rowA.pp++; }
      else { rowA.pe++; rowB.pe++; rowA.pts++; rowB.pts++; }
    });
  });

  tabla.forEach((row) => (row.dg = row.gf - row.gc));
  tabla.sort((a, b) => (b.pts - a.pts) || (b.dg - a.dg) || (b.gf - a.gf) || a.name.localeCompare(b.name));
  return tabla;
}

/* ---------- Paso 5: camino a la copa ---------- */

/* Al terminar los grupos, segun el formato vamos a dieciseisavos (48
   equipos) o directo a octavos (32 equipos). */
function avanzarAKnockoutInicial() {
  if (MUNDIAL.formato === 48) {
    generarDieciseisavosDesdeGrupos();
  } else {
    generarOctavosDesdeGrupos();
  }
}

/* Formato 32: 8 grupos -> 1ros y 2dos -> 16 equipos -> octavos directo */
function generarOctavosDesdeGrupos() {
  const tablas = {};
  MUNDIAL.grupos.forEach((g) => (tablas[g.nombre] = calcularTablaGrupo(g)));
  const primero = (letra) => tablas[letra][0].teamId;
  const segundo = (letra) => tablas[letra][1].teamId;

  const cruces = [
    [primero("A"), segundo("B")],
    [primero("C"), segundo("D")],
    [primero("E"), segundo("F")],
    [primero("G"), segundo("H")],
    [primero("B"), segundo("A")],
    [primero("D"), segundo("C")],
    [primero("F"), segundo("E")],
    [primero("H"), segundo("G")]
  ];

  MUNDIAL.bracket.octavos = cruces.map(([a, b]) => nuevoMatchBracket(a, b));
  MUNDIAL.fase = "octavos";
}

/* Formato 48: 12 grupos -> 1ros y 2dos (24) + los 8 mejores terceros
   -> 32 equipos -> dieciseisavos (ronda de 32) */
function generarDieciseisavosDesdeGrupos() {
  const tablas = {};
  MUNDIAL.grupos.forEach((g) => (tablas[g.nombre] = calcularTablaGrupo(g)));

  const directos = [];
  const terceros = [];
  MUNDIAL.grupos.forEach((g) => {
    const t = tablas[g.nombre];
    directos.push(t[0].teamId, t[1].teamId);
    terceros.push({ teamId: t[2].teamId, pts: t[2].pts, dg: t[2].dg, gf: t[2].gf });
  });

  terceros.sort((a, b) => (b.pts - a.pts) || (b.dg - a.dg) || (b.gf - a.gf));
  const mejoresTerceros = terceros.slice(0, 8).map((t) => t.teamId);

  const pool = [...directos, ...mejoresTerceros]; // 32 equipos
  const conRating = pool.map((id) => ({ id, rating: nivelGeneral(getTeamById(id)) }));
  conRating.sort((a, b) => b.rating - a.rating);

  const cruces = [];
  for (let i = 0; i < 16; i++) {
    cruces.push([conRating[i].id, conRating[31 - i].id]); // el mejor vs el peor del pool, y asi sucesivamente
  }

  MUNDIAL.bracket.dieciseisavos = cruces.map(([a, b]) => nuevoMatchBracket(a, b));
  MUNDIAL.fase = "dieciseisavos";
}

function generarOctavosDesdeDieciseisavos() {
  const g = MUNDIAL.bracket.dieciseisavos.map((m) => m.ganadorId);
  MUNDIAL.bracket.octavos = [
    nuevoMatchBracket(g[0], g[1]), nuevoMatchBracket(g[2], g[3]),
    nuevoMatchBracket(g[4], g[5]), nuevoMatchBracket(g[6], g[7]),
    nuevoMatchBracket(g[8], g[9]), nuevoMatchBracket(g[10], g[11]),
    nuevoMatchBracket(g[12], g[13]), nuevoMatchBracket(g[14], g[15])
  ];
  MUNDIAL.fase = "octavos";
}

function nuevoMatchBracket(equipoAId, equipoBId) {
  return {
    equipoAId, equipoBId,
    jugado: false, golesA: null, golesB: null, relato: null, estadio: null,
    ganadorId: null, penales: false
  };
}

function jugarPartidoBracket(ronda, matchIndex, modo) {
  const match = MUNDIAL.bracket[ronda][matchIndex];
  jugarPartidoEliminacion(match, modo);
  avanzarSiguienteRondaBracket();
  return match;
}

function rondaCompleta(ronda) {
  const partidos = MUNDIAL.bracket[ronda];
  return partidos.length > 0 && partidos.every((m) => m.jugado);
}

function avanzarSiguienteRondaBracket() {
  if (MUNDIAL.fase === "dieciseisavos" && rondaCompleta("dieciseisavos")) {
    generarOctavosDesdeDieciseisavos();
  } else if (MUNDIAL.fase === "octavos" && rondaCompleta("octavos")) {
    const g = MUNDIAL.bracket.octavos.map((m) => m.ganadorId);
    MUNDIAL.bracket.cuartos = [
      nuevoMatchBracket(g[0], g[1]),
      nuevoMatchBracket(g[2], g[3]),
      nuevoMatchBracket(g[4], g[5]),
      nuevoMatchBracket(g[6], g[7])
    ];
    MUNDIAL.fase = "cuartos";
  } else if (MUNDIAL.fase === "cuartos" && rondaCompleta("cuartos")) {
    const g = MUNDIAL.bracket.cuartos.map((m) => m.ganadorId);
    MUNDIAL.bracket.semis = [nuevoMatchBracket(g[0], g[1]), nuevoMatchBracket(g[2], g[3])];
    MUNDIAL.fase = "semis";
  } else if (MUNDIAL.fase === "semis" && rondaCompleta("semis")) {
    const ganadores = MUNDIAL.bracket.semis.map((m) => m.ganadorId);
    const perdedores = MUNDIAL.bracket.semis.map((m) =>
      m.ganadorId === m.equipoAId ? m.equipoBId : m.equipoAId
    );
    MUNDIAL.bracket.final = [nuevoMatchBracket(ganadores[0], ganadores[1])];
    MUNDIAL.bracket.tercerLugar = [nuevoMatchBracket(perdedores[0], perdedores[1])];
    MUNDIAL.fase = "final";
  } else if (MUNDIAL.fase === "final" && rondaCompleta("final") && rondaCompleta("tercerLugar")) {
    const finalMatch = MUNDIAL.bracket.final[0];
    MUNDIAL.campeonId = finalMatch.ganadorId;
    MUNDIAL.subcampeonId =
      finalMatch.ganadorId === finalMatch.equipoAId ? finalMatch.equipoBId : finalMatch.equipoAId;
    MUNDIAL.tercerId = MUNDIAL.bracket.tercerLugar[0].ganadorId;
    MUNDIAL.fase = "terminado";
    registrarCampeonEnHistorial();
  }
}

function registrarCampeonEnHistorial() {
  const campeon = getTeamById(MUNDIAL.campeonId);
  campeon.titulos = (campeon.titulos || 0) + 1;

  const anio = (state.anioBase || 2026) + (state.temporada - 1);
  HISTORIAL_MUNDIALES.push({
    anio,
    sedeName: state.sede,
    campeonId: MUNDIAL.campeonId,
    subcampeonId: MUNDIAL.subcampeonId,
    tercerId: MUNDIAL.tercerId
  });
}

/* ---------- Paso 6: reiniciar temporada (conserva estadisticas) ----------
   El mundial recien terminado pasa a ser "el anterior" (se puede seguir
   viendo desde la pestaña Mundial); el que estaba antes de ese se pierde,
   para no acumular datos para siempre. */
function reiniciarTemporada() {
  generarTodosLosFixtures(); // vuelve a armar el calendario, jugado:false para todos
  MUNDIAL_ANTERIOR = MUNDIAL;
  MUNDIAL = crearMundialVacio();

  state.sede = null;
  state.sedeTeamId = null;
  state.sedes = [];
  state.mundialDesbloqueado = false;
  state.repechajeDesbloqueado = false;
  state.formatoMundial = null;
  state.setupCompleto = false;
  state.mundialTab = "grupos";
  state.mundialViendo = "actual";
  state.grupoSeleccionado = null;
  state.temporada = (state.temporada || 1) + 1;
}
