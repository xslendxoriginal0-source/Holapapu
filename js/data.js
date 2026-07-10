/* ============================================================
   data.js
   Datos base: confederaciones, equipos, colores y generación
   determinística de estadísticas iniciales (Ataque, Defensa,
   Forma, Portero). Todo lo que necesita el resto del simulador
   para arrancar vive aquí.
   ============================================================ */

/* ---------- PRNG determinístico (mulberry32) ----------
   Usamos esto en vez de Math.random() para que las estadísticas
   iniciales de cada equipo sean siempre las mismas la primera
   vez que se genera el mundo (después ya evolucionan con el
   tiempo y se guardan en localStorage). */
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandomInRange(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/* ---------- Confederaciones ----------
   cupos32 / cupos48 = clasificados directos segun el formato de
   Mundial elegido (antes del recorte de repechaje). El total de
   cupos32 suma 40 (24 directos + 16 al repechaje -> 32 finales) y
   el de cupos48 suma 56 (40 directos + 16 al repechaje -> 48 finales). */
const CONFEDERATIONS = [
  {
    id: "rogen",
    name: "Rogen",
    cupos32: 10,
    cupos48: 14,
    colors: { primary: "#C1440E", secondary: "#F2A65A", dark: "#3A1220" },
    teams: [
      "Nipez", "Matine", "Malva", "Costa del Norte", "Cahuan", "Bahtimo",
      "Retemo", "Calitio", "Cania", "Netilia", "Brakia", "Quicker",
      "Grapua", "Chem", "Pobe", "Trofto", "Lucenia", "Protenia",
      "Falontamo", "Tromao"
    ]
  },
  {
    id: "fameli",
    name: "Faméli",
    cupos32: 10,
    cupos48: 14,
    colors: { primary: "#1B4E8F", secondary: "#4FB6E8", dark: "#0A2A4A" },
    teams: [
      "Choella", "Glöß", "Errepoc", "Tsachella", "Usa", "Toko", "Holo",
      "Taêlos", "Vesarum", "Toe", "Dröt", "Toffeke", "Cruptia",
      "Tautamin", "Shöu", "Teffè", "Floäi", "Thöi", "Tveli", "Afu",
      "Dolki", "Skölou", "Cuo"
    ]
  },
  {
    id: "tore",
    name: "Tore",
    cupos32: 7,
    cupos48: 10,
    colors: { primary: "#6C2FA6", secondary: "#B98CE8", dark: "#241033" },
    teams: [
      "Shoub", "Toke", "Temiro", "Fulemike", "Cometon", "Budish",
      "Shtkö", "Mokeire", "Souoere", "Kiwoté", "Tromelus", "Lutas",
      "Jek", "Notechu"
    ]
  },
  {
    id: "lotecato",
    name: "Lotecato",
    cupos32: 7,
    cupos48: 10,
    colors: { primary: "#1E7A4C", secondary: "#7FD99A", dark: "#0C2A1B" },
    teams: [
      "Aquitoso", "Fumarak", "Tasta", "Toski", "Morela", "Tellaiku",
      "Domesk", "Husta", "Fucela", "Frankio", "Tasmo", "Cloga"
    ]
  },
  {
    id: "toste",
    name: "Toste",
    cupos32: 6,
    cupos48: 8,
    colors: { primary: "#C9942B", secondary: "#F2D06B", dark: "#332405" },
    teams: [
      "Mostaná", "Mbate", "Todkete", "Zwaie", "Jshoka", "Pomule",
      "Chuckler", "Marcalt", "Saltword", "Coemnets", "Mulard", "Reiti"
    ]
  }
];

/* Cupos activos segun el formato de Mundial elegido para la temporada
   actual (32 u 48 equipos). Usar SIEMPRE esta funcion en vez de leer
   conf.cupos32/cupos48 directamente. */
function cuposConfed(conf) {
  const formato = (typeof state !== "undefined" && state.formatoMundial) || 32;
  return formato === 48 ? conf.cupos48 : conf.cupos32;
}

/* ---------- Generador de estadios ficticios ----------
   Cada equipo tiene 3 estadios posibles (el de local se elige al
   azar en cada partido y se menciona en la narración). */
const ESTADIO_PREFIJOS = ["Estadio", "Coliseo", "Parque", "Templo Deportivo", "Arena"];
const ESTADIO_NOMBRES = [
  "Aurora", "Vientonorte", "Cumbres", "Marejada", "Sol Naciente", "Bravo",
  "Unión", "Centenario", "Libertad", "Halcón", "Trueno", "Cóndor", "Faro",
  "Meridiano", "Alba", "Zafiro", "Roble", "Cascada", "Amanecer", "Vanguardia",
  "Solsticio", "Encuentro", "Marfil", "Relámpago", "Constelación"
];

function generarEstadios(rng) {
  const usados = new Set();
  const estadios = [];
  while (estadios.length < 3) {
    const pre = ESTADIO_PREFIJOS[seededRandomInRange(rng, 0, ESTADIO_PREFIJOS.length - 1)];
    const nom = ESTADIO_NOMBRES[seededRandomInRange(rng, 0, ESTADIO_NOMBRES.length - 1)];
    const nombreCompleto = `${pre} ${nom}`;
    if (!usados.has(nombreCompleto)) {
      usados.add(nombreCompleto);
      estadios.push(nombreCompleto);
    }
  }
  return estadios;
}

function estadioAleatorio(team) {
  return team.estadios[Math.floor(Math.random() * team.estadios.length)];
}

/* ---------- Generación de equipos con estadísticas base ----------
   Ataque / Defensa / Portero: 40-90 (rango amplio para que haya
   equipos claramente más fuertes que otros, pero nadie es "perfecto").
   Forma: arranca en 0 (neutral), rango real de -10 a +10, y se mueve
   +/-1 o 2 por resultado, nunca salta bruscamente. */
function buildTeams() {
  const teams = [];
  CONFEDERATIONS.forEach((conf) => {
    conf.teams.forEach((name) => {
      const seedFn = hashString(conf.id + "_" + name);
      const rng = mulberry32(seedFn());
      const ataque = seededRandomInRange(rng, 40, 90);
      const defensa = seededRandomInRange(rng, 40, 90);
      const portero = seededRandomInRange(rng, 40, 90);
      teams.push({
        id: (conf.id + "_" + name).toLowerCase().replace(/[^a-z0-9_]/g, ""),
        name,
        confedId: conf.id,
        // Ruta a la bandera/logo del equipo. Déjalo en null hasta tener el
        // archivo; en ese caso la UI muestra un placeholder con iniciales.
        // Ejemplo cuando tengas el archivo: "assets/flags/nipez.png"
        flag: null,
        estadios: generarEstadios(rng),
        titulos: 0, // cantidad de Mundiales ganados (se muestra con estrellas)
        // Ciclo de "era" (auge/declive de varios años, independiente del
        // resultado partido a partido) para que ninguna seleccion se quede
        // pegada para siempre en 99 o en el piso. Ver evolucionarEstadisticas().
        cicloValor: 0,
        cicloObjetivo: seededRandomInRange(rng, -12, 12),
        cicloRestante: seededRandomInRange(rng, 10, 22),
        stats: {
          ataque,
          defensa,
          portero,
          forma: 0 // -10 a +10, neutral al empezar
        },
        // Historial de estadísticas (para graficar evolución más adelante)
        statHistory: [{ fecha: 0, ataque, defensa, portero, forma: 0 }],
        // Se completa en standings.js al iniciar cada eliminatoria
        stanRecord: null
      });
    });
  });
  return teams;
}

const TEAMS = buildTeams();

/* ---------- Utilidades de acceso a datos ---------- */
function getConfederation(confedId) {
  return CONFEDERATIONS.find((c) => c.id === confedId);
}

function getTeamsByConfed(confedId) {
  return TEAMS.filter((t) => t.confedId === confedId);
}

function getTeamById(teamId) {
  return TEAMS.find((t) => t.id === teamId);
}

/* ---------- Bandera / logo con placeholder ----------
   Mientras "team.flag" sea null, se muestra un círculo con las
   iniciales del equipo en el color de su confederación. En cuanto
   pongas una ruta real (ej. "assets/flags/nipez.png") en flag,
   esta función automáticamente muestra la imagen en su lugar en
   TODA la interfaz (tabla, partidos, estadísticas). */
function iniciales(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function banderaHTML(team, size = 22) {
  const conf = getConfederation(team.confedId);
  if (team.flag) {
    return `<img src="${team.flag}" alt="${team.name}" class="flag-img" style="width:${size}px;height:${size}px;" />`;
  }
  return `<span class="flag-placeholder" style="width:${size}px;height:${size}px;background:${conf.colors.primary};font-size:${Math.max(8, size * 0.4)}px;">${iniciales(team.name)}</span>`;
}

/* Estrellas de campeon: una por cada Mundial ganado (persisten entre
   temporadas). Se muestran al lado del numero de posicion en la tabla. */
function estrellasHTML(team) {
  if (!team.titulos || team.titulos <= 0) return "";
  return `<span class="estrellas-campeon" title="${team.titulos} Mundial(es) ganado(s)">${"★".repeat(team.titulos)}</span>`;
}

/* Estado del ciclo de era de un equipo (para noticias y flavor) */
function estadoCiclo(team) {
  if (team.cicloValor >= 6) return "auge";
  if (team.cicloValor <= -6) return "declive";
  return "estable";
}

function nivelGeneral(team) {
  return (team.stats.ataque + team.stats.defensa + team.stats.portero) / 3;
}

/* Verificación rápida en consola (útil mientras desarrollamos) */
console.log(
  "Total equipos cargados:",
  TEAMS.length,
  "(esperado: 81) — Cupos totales (formato 32):",
  CONFEDERATIONS.reduce((sum, c) => sum + c.cupos32, 0),
  "— Cupos totales (formato 48):",
  CONFEDERATIONS.reduce((sum, c) => sum + c.cupos48, 0)
);
