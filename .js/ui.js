/* ============================================================
   ui.js — Renderizado de vistas
   ============================================================ */

const appEl = document.getElementById("app");

/* Noticias especiales generadas por eventos del juego (sorpresas de
   clasificacion, ciclos de era, etc.) - se llenan desde worldcup.js */
let NOTICIAS_ESPECIALES = [];

/* Duracion total (ms) que tarda en revelarse el relato completo */
const DURACION_ELIMINATORIA_MS = 30000;
const DURACION_MUNDIAL_MS = 60000;

function iconoEvento(evento) {
  if (evento.tipo === "info") return "🏟️";
  if (evento.tipo === "gol") return "⚽";
  const t = evento.texto;
  if (t.includes("ataja") || t.includes("tapada")) return "🧤";
  if (t.includes("palo")) return "🥅";
  if (t.includes("defensor")) return "🛡️";
  return "➡️";
}

/* ---------- Noticiero: destaca goleadas y sorpresas ---------- */
function tituloNoticia(match) {
  const eqA = getTeamById(match.equipoAId);
  const eqB = getTeamById(match.equipoBId);
  const maxGoles = Math.max(match.golesA, match.golesB);
  const dif = Math.abs(match.golesA - match.golesB);

  const nivelA = eqA.stats.ataque + eqA.stats.defensa + eqA.stats.portero;
  const nivelB = eqB.stats.ataque + eqB.stats.defensa + eqB.stats.portero;
  const favorito = nivelA >= nivelB ? eqA : eqB;
  const modesto = favorito === eqA ? eqB : eqA;
  const golesFavorito = favorito === eqA ? match.golesA : match.golesB;
  const golesModesto = favorito === eqA ? match.golesB : match.golesA;
  const diferenciaNivel = Math.abs(nivelA - nivelB);

  if (maxGoles >= 5 || dif >= 4) {
    const ganador = match.golesA > match.golesB ? eqA : eqB;
    const perdedor = match.golesA > match.golesB ? eqB : eqA;
    const gg = Math.max(match.golesA, match.golesB);
    const gp = Math.min(match.golesA, match.golesB);
    return `🔥 GOLEADA — ${ganador.name} aplastó ${gg}-${gp} a ${perdedor.name}${match.estadio ? " en el " + match.estadio : ""}.`;
  }
  if (golesModesto > golesFavorito && diferenciaNivel >= 15) {
    return `😱 SORPRESA — ${modesto.name} vence a ${favorito.name} (favorito) por ${golesModesto}-${golesFavorito}.`;
  }
  if (match.golesA === match.golesB) {
    return `🤝 ${eqA.name} y ${eqB.name} empataron ${match.golesA}-${match.golesB}.`;
  }
  const ganador = match.golesA > match.golesB ? eqA : eqB;
  const perdedor = match.golesA > match.golesB ? eqB : eqA;
  const gg = Math.max(match.golesA, match.golesB);
  const gp = Math.min(match.golesA, match.golesB);
  return `⚽ ${ganador.name} venció ${gg}-${gp} a ${perdedor.name}.`;
}

/* Noticias de ambiente, no ligadas a un partido especifico */
const NOTICIAS_AMBIENTE = [
  "🏗️ Avanzan las obras de remodelación del estadio nacional para cumplir estándares FIFA.",
  "📹 El VAR tendrá nuevas cámaras 360° para mejorar la precisión en las decisiones.",
  "🎨 Hinchas organizan el mosaico más grande de la historia para la final.",
  "🕊️ Se lanza campaña para reducir la violencia en los estadios.",
  "⚽ La organización confirma un nuevo balón oficial con sensores de seguimiento en tiempo real.",
  "👕 Aumentan las ventas de camisetas de las selecciones sorpresa del torneo.",
  "📺 Anuncian pantallas gigantes gratuitas para hinchas sin entrada en la sede.",
  "🥤 Polémica por el precio de las bebidas dentro de los estadios.",
  "🚌 Refuerzan el transporte público hacia los estadios para los días de partido.",
  "🩺 El cuerpo médico de varias selecciones reporta un buen estado físico general del plantel."
];

function generarNoticias(limite = 6) {
  const todos = [];
  Object.keys(PARTIDOS_JUGADOS).forEach((confedId) => {
    PARTIDOS_JUGADOS[confedId].forEach((m) => todos.push(m));
  });

  const titularesPartidos = [];
  if (todos.length > 0) {
    todos.forEach((m) => {
      const maxGoles = Math.max(m.golesA, m.golesB);
      const dif = Math.abs(m.golesA - m.golesB);
      m._importancia = (maxGoles >= 5 || dif >= 4) ? 2 : 0;
      const eqA = getTeamById(m.equipoAId);
      const eqB = getTeamById(m.equipoBId);
      const nivelA = eqA.stats.ataque + eqA.stats.defensa + eqA.stats.portero;
      const nivelB = eqB.stats.ataque + eqB.stats.defensa + eqB.stats.portero;
      const favorito = nivelA >= nivelB ? eqA : eqB;
      const golesFavorito = favorito === eqA ? m.golesA : m.golesB;
      const golesModesto = favorito === eqA ? m.golesB : m.golesA;
      if (golesModesto > golesFavorito && Math.abs(nivelA - nivelB) >= 15) m._importancia = Math.max(m._importancia, 2);
    });
    todos.sort((a, b) => (b._importancia - a._importancia) || (b.fecha - a.fecha));
    titularesPartidos.push(...todos.slice(0, Math.max(1, limite - 2)).map(tituloNoticia));
  }

  const ambienteBarajado = [...NOTICIAS_AMBIENTE].sort(() => Math.random() - 0.5);
  const especialesBarajadas = [...NOTICIAS_ESPECIALES].sort(() => Math.random() - 0.5);
  const combinadas = [
    ...especialesBarajadas.slice(0, 2),
    ...titularesPartidos,
    ...ambienteBarajado.slice(0, 2)
  ];
  return combinadas.sort(() => Math.random() - 0.5).slice(0, limite);
}

function getThemeClasses() {
  return CONFEDERATIONS.map((c) => `theme-${c.id}`);
}

function applyTheme(confedId) {
  const conf = getConfederation(confedId);
  document.documentElement.style.setProperty("--conf-primary", conf.colors.primary);
  document.documentElement.style.setProperty("--conf-secondary", conf.colors.secondary);
  document.documentElement.style.setProperty("--conf-dark", conf.colors.dark);
}

function clearTheme() {
  document.documentElement.style.setProperty("--conf-primary", "var(--accent-gold)");
  document.documentElement.style.setProperty("--conf-secondary", "#F2D06B");
  document.documentElement.style.setProperty("--conf-dark", "#221a08");
}

/* ---------- Menu principal ---------- */
function renderMenu() {
  clearTheme();
  const noticias = generarNoticias(6);
  appEl.innerHTML = `
    <section class="hero">
      <h1>COPA <span>MUNDIAL</span></h1>
      <p>81 selecciones, 5 confederaciones ficticias, un camino a la gloria.
      Simula fecha a fecha, mira crecer (o caer) a cada seleccion, y llega al Mundial.</p>
    </section>
    <div class="menu-grid">
      <div class="menu-card" data-goto="confederaciones">
        <h3>Confederaciones</h3>
        <p>5 zonas, eliminatorias todos-contra-todos ida y vuelta.</p>
      </div>
      <div class="menu-card" data-goto="globales">
        <h3>Estadisticas Globales</h3>
        <p>Ataque, defensa, forma y portero de los 81 equipos.</p>
      </div>
      <div class="menu-card" data-goto="mundial">
        <h3>Mundial ${state.mundialDesbloqueado ? "" : "🔒"}</h3>
        <p>${state.mundialDesbloqueado ? "Fase de grupos y camino a la copa." : "Se desbloquea tras el repechaje (24 directos + 8 de repechaje)."}</p>
      </div>
    </div>
    <div class="menu-grid" style="margin-top:12px;">
      <div class="menu-card" data-goto="repechaje">
        <h3>Repechaje ${state.repechajeDesbloqueado ? "" : "🔒"}</h3>
        <p>${state.repechajeDesbloqueado ? "8 llaves a partido único por los últimos cupos." : "Se desbloquea cuando terminen las 5 eliminatorias."}</p>
      </div>
    </div>
    <section class="noticiero">
      <div class="noticiero-header"><h3>📰 Noticiero Mundialista</h3></div>
      <div class="noticiero-body">
        <div class="noticiero-image-placeholder">
          <!-- Cuando tengas una imagen de portada, reemplaza este div por:
               <img src="assets/news/portada.jpg" alt="Noticia destacada" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" /> -->
          🖼️ Espacio para imagen
        </div>
        <ul class="noticiero-list">
          ${noticias.length ? noticias.map((n) => `<li>${n}</li>`).join("") : `<li>Aún no hay resultados. ¡Juega algunas fechas para que empiecen las noticias!</li>`}
        </ul>
      </div>
    </section>
  `;
  appEl.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(el.dataset.goto));
  });
}

/* ---------- Confederaciones (lista) ---------- */
function renderConfederaciones() {
  clearTheme();
  appEl.innerHTML = `
    <h2 style="font-family:var(--font-display);font-size:30px;margin-bottom:18px;">Confederaciones</h2>
    <div class="menu-grid" id="confGrid"></div>
  `;
  const grid = document.getElementById("confGrid");
  CONFEDERATIONS.forEach((conf) => {
    const div = document.createElement("div");
    div.className = "conf-card";
    div.style.setProperty("--conf-primary", conf.colors.primary);
    const jornadaIdx = proximaJornadaIndex(conf.id);
    const estado = jornadaIdx === null
      ? "Eliminatoria finalizada"
      : `Jornada ${jornadaIdx + 1} de ${FIXTURES[conf.id].jornadas.length}`;
    div.innerHTML = `
      <h3 style="color:${conf.colors.primary}">${conf.name}</h3>
      <p>${conf.teams.length} selecciones · ${cuposConfed(conf)} cupos al Mundial</p>
      <p style="margin-top:6px;color:var(--accent-gold);font-family:var(--font-mono);font-size:12px;">${estado}</p>
    `;
    div.addEventListener("click", () => renderConfedDetail(conf.id));
    grid.appendChild(div);
  });
}

/* ---------- Detalle de una confederacion ---------- */
function renderConfedDetail(confedId, tab = "tabla") {
  applyTheme(confedId);
  const conf = getConfederation(confedId);
  const teams = getTeamsByConfed(confedId);

  appEl.innerHTML = `
    <div class="conf-header">
      <h2>${conf.name}</h2>
      <p style="color:var(--text-muted)">${teams.length} selecciones · Clasifican los primeros ${cuposConfed(conf)}</p>
    </div>
    <div class="tabs">
      <button class="tab-btn ${tab === "tabla" ? "active" : ""}" data-tab="tabla">Tabla</button>
      <button class="tab-btn ${tab === "partidos" ? "active" : ""}" data-tab="partidos">Partidos Jugados</button>
      <button class="tab-btn ${tab === "stats" ? "active" : ""}" data-tab="stats">Estadisticas</button>
    </div>
    <div id="confedContent"></div>
    <div style="margin-top:20px;">
      <button class="btn-secondary" id="backToConfs">← Volver a Confederaciones</button>
    </div>
  `;

  document.getElementById("backToConfs").addEventListener("click", renderConfederaciones);
  appEl.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => renderConfedDetail(confedId, btn.dataset.tab));
  });

  const content = document.getElementById("confedContent");
  if (tab === "tabla") {
    content.innerHTML = renderTablaHTML(confedId, conf);
  } else if (tab === "partidos") {
    content.innerHTML = renderPartidosHTML(confedId);
    wirePartidosButtons(confedId, tab);
  } else if (tab === "stats") {
    content.innerHTML = renderStatsTableHTML(teams);
  }
}

/* ---------- Tabla de posiciones ---------- */
function renderTablaHTML(confedId, conf) {
  const tabla = calcularTabla(confedId);
  const rows = tabla
    .map((row, i) => {
      const team = getTeamById(row.teamId);
      const clasifica = i < cuposConfed(conf);
      return `
      <tr style="${clasifica ? "background:rgba(255,255,255,0.03);" : ""}">
        <td class="team-name">
          <div class="team-with-flag">
            <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">${i + 1}</span>${estrellasHTML(team)}
            ${banderaHTML(team, 20)}
            <span style="${clasifica ? "color:var(--accent-gold);font-weight:600;" : ""}">${team.name}</span>
          </div>
        </td>
        <td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td>
        <td>${row.gf}</td><td>${row.gc}</td><td>${row.dg}</td><td><strong>${row.pts}</strong></td>
      </tr>`;
    })
    .join("");

  return `
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:10px;">
      Los primeros <strong style="color:var(--accent-gold)">${cuposConfed(conf)}</strong> lugares (resaltados) clasifican directo al Mundial.
    </p>
    <table class="standings">
      <thead>
        <tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ---------- Estadisticas de equipos ---------- */
function renderStatsTableHTML(teams) {
  const rows = teams
    .map(
      (t) => `
      <tr>
        <td class="team-name">
          <div class="team-with-flag">${banderaHTML(t, 20)}<span>${t.name}</span></div>
        </td>
        <td>${t.stats.ataque}</td>
        <td>${t.stats.defensa}</td>
        <td>${t.stats.portero}</td>
        <td>${t.stats.forma > 0 ? "+" + t.stats.forma : t.stats.forma}</td>
      </tr>`
    )
    .join("");
  return `
    <table class="standings">
      <thead>
        <tr><th>Equipo</th><th>Ataque</th><th>Defensa</th><th>Portero</th><th>Forma</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ---------- Partidos: proxima jornada (con botones) + jugados ---------- */
function renderPartidosHTML(confedId) {
  const idx = proximaJornadaIndex(confedId);
  let proximaHTML = `<p style="color:var(--text-muted)">Eliminatoria finalizada, no quedan partidos pendientes.</p>`;

  if (idx !== null) {
    const jornada = FIXTURES[confedId].jornadas[idx];
    const filas = jornada
      .map((match, matchIndex) => {
        if (match.jugado) return "";
        const eqA = getTeamById(match.equipoAId);
        const eqB = getTeamById(match.equipoBId);
        return `
        <div class="match-row" data-jornada="${idx}" data-match="${matchIndex}">
          <div class="match-teams team-with-flag">
            ${banderaHTML(eqA, 20)}<span>${eqA.name}</span>
            <span style="color:var(--text-muted);margin:0 6px;">vs</span>
            ${banderaHTML(eqB, 20)}<span>${eqB.name}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary btn-resultado" data-jornada="${idx}" data-match="${matchIndex}">Resultado</button>
            <button class="btn-primary btn-simular" data-jornada="${idx}" data-match="${matchIndex}">Simular</button>
          </div>
        </div>
        <div class="relato-slot" data-jornada="${idx}" data-match="${matchIndex}"></div>
        `;
      })
      .join("");
    proximaHTML = `
      <h3 style="font-family:var(--font-display);font-size:20px;margin:0 0 10px;">Jornada ${idx + 1} (pendiente)</h3>
      ${filas}
    `;
  }

  const jugadosHTML = (PARTIDOS_JUGADOS[confedId] || [])
    .slice(0, 40) // limitamos el largo de la lista visible
    .map((match) => {
      const eqA = getTeamById(match.equipoAId);
      const eqB = getTeamById(match.equipoBId);
      return `
      <div class="match-row">
        <div class="match-teams team-with-flag">
          ${banderaHTML(eqA, 18)}<span>${eqA.name}</span>
        </div>
        <div class="match-score">${match.golesA} - ${match.golesB}</div>
        <div class="match-teams team-with-flag">
          <span>${eqB.name}</span>${banderaHTML(eqB, 18)}
        </div>
        <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">Fecha ${match.fecha}</span>
      </div>`;
    })
    .join("");

  return `
    ${proximaHTML}
    <h3 style="font-family:var(--font-display);font-size:20px;margin:24px 0 10px;">Partidos jugados (mas recientes primero)</h3>
    ${jugadosHTML || `<p style="color:var(--text-muted)">Todavia no se ha jugado ningun partido en esta confederacion.</p>`}
  `;
}

function wirePartidosButtons(confedId) {
  appEl.querySelectorAll(".btn-resultado").forEach((btn) => {
    btn.addEventListener("click", () => {
      const jornada = Number(btn.dataset.jornada);
      const matchIdx = Number(btn.dataset.match);
      jugarPartidoDeFixture(confedId, jornada, matchIdx, "resultado");
      if (todasLasConfedsTerminadas()) state.mundialDesbloqueado = true;
      renderConfedDetail(confedId, "partidos");
      updateNavLockState();
    });
  });

  appEl.querySelectorAll(".btn-simular").forEach((btn) => {
    btn.addEventListener("click", () => {
      const jornada = Number(btn.dataset.jornada);
      const matchIdx = Number(btn.dataset.match);
      const match = jugarPartidoDeFixture(confedId, jornada, matchIdx, "simular");
      if (todasLasConfedsTerminadas()) state.mundialDesbloqueado = true;

      const row = appEl.querySelector(`.match-row[data-jornada="${jornada}"][data-match="${matchIdx}"]`);
      const slot = appEl.querySelector(`.relato-slot[data-jornada="${jornada}"][data-match="${matchIdx}"]`);
      if (row) row.querySelectorAll("button").forEach((b) => (b.disabled = true));

      if (slot) {
        const eqA = getTeamById(match.equipoAId);
        const eqB = getTeamById(match.equipoBId);
        const key = `elim-${jornada}-${matchIdx}`;
        slot.innerHTML = construirScoreboardHTML(eqA, eqB, key);
        const ctx = obtenerCtxScoreboard(key, match.equipoAId, match.equipoBId);

        // Importante: NO volvemos a renderizar la vista al terminar.
        // La narracion y el marcador se quedan visibles tal cual hasta
        // que el usuario cambie de fecha (avanzar fecha) o de pestaña.
        reproducirRelato(match.relato, ctx, DURACION_ELIMINATORIA_MS, () => {
          updateNavLockState();
        });
      }
    });
  });
}

/* Revela el relato evento por evento, con marcador en vivo con colores
   (verde = va ganando, rojo = va perdiendo, blanco = empate). La duracion
   total se reparte entre todos los eventos para que dure ~totalDurationMs.
   Si penalesInfo viene definido, al terminar el relato se anima la tanda
   de penales con circulos verdes (gol) y rojos (fallo). */
function reproducirRelato(relato, ctx, totalDurationMs, onDone, penalesInfo = null) {
  const delay = Math.max(500, Math.min(6000, totalDurationMs / relato.length));
  let i = 0;
  let golesA = 0;
  let golesB = 0;

  function actualizarMarcador() {
    ctx.sideANumEl.textContent = golesA;
    ctx.sideBNumEl.textContent = golesB;
    ctx.sideAEl.classList.remove("winning", "losing", "tied");
    ctx.sideBEl.classList.remove("winning", "losing", "tied");
    if (golesA > golesB) {
      ctx.sideAEl.classList.add("winning");
      ctx.sideBEl.classList.add("losing");
    } else if (golesB > golesA) {
      ctx.sideBEl.classList.add("winning");
      ctx.sideAEl.classList.add("losing");
    } else {
      ctx.sideAEl.classList.add("tied");
      ctx.sideBEl.classList.add("tied");
    }
    ctx.scoreboardBox.classList.remove("flash");
    void ctx.scoreboardBox.offsetWidth; // fuerza reinicio de la animacion
    ctx.scoreboardBox.classList.add("flash");
  }

  function terminar() {
    if (penalesInfo) {
      animarPenales(penalesInfo, ctx, () => {
        mostrarFinal(ctx, golesA, golesB, penalesInfo);
        if (onDone) onDone();
      });
    } else {
      mostrarFinal(ctx, golesA, golesB, null);
      if (onDone) onDone();
    }
  }

  function siguienteLinea() {
    if (i >= relato.length) {
      terminar();
      return;
    }
    const evento = relato[i];
    if (evento.tipo === "gol") {
      if (evento.equipoId === ctx.equipoAId) golesA++;
      else golesB++;
      actualizarMarcador();
    }
    const p = document.createElement("p");
    p.className = "relato-line relato-" + evento.tipo;
    p.innerHTML =
      evento.tipo === "info"
        ? `${iconoEvento(evento)} ${evento.texto}`
        : `<span class="relato-min">Min ${evento.minuto}':</span> ${iconoEvento(evento)} ${evento.texto}`;
    ctx.relatoBox.appendChild(p);
    ctx.relatoBox.scrollTop = ctx.relatoBox.scrollHeight;
    i++;
    setTimeout(siguienteLinea, delay);
  }
  siguienteLinea();
}

/* Anima la tanda de penales: un circulo por cada disparo, verde si fue
   gol y rojo si fue fallado/atajado. */
function animarPenales(penalesInfo, ctx, onDone) {
  const cont = document.createElement("div");
  cont.className = "penales-box";
  cont.innerHTML = `
    <div class="penales-header">🥅 Definición por penales</div>
    <div class="penales-circulos"></div>
  `;
  ctx.relatoBox.appendChild(cont);
  const circulosCont = cont.querySelector(".penales-circulos");

  let i = 0;
  function siguiente() {
    if (i >= penalesInfo.tandas.length) {
      if (onDone) onDone();
      return;
    }
    const tanda = penalesInfo.tandas[i];
    const equipo = getTeamById(tanda.equipoId);
    const esA = tanda.equipoId === ctx.equipoAId;
    const circle = document.createElement("span");
    circle.className = "penal-circle " + (tanda.gol ? "gol" : "fallo") + (esA ? " lado-a" : " lado-b");
    circle.title = `${equipo.name} — Ronda ${tanda.ronda}: ${tanda.gol ? "gol" : "fallo"}`;
    circulosCont.appendChild(circle);
    ctx.relatoBox.scrollTop = ctx.relatoBox.scrollHeight;
    i++;
    setTimeout(siguiente, 450);
  }
  siguiente();
}

function mostrarFinal(ctx, golesA, golesB, penalesInfo) {
  const equipoA = getTeamById(ctx.equipoAId);
  const equipoB = getTeamById(ctx.equipoBId);
  const final = document.createElement("div");
  final.className = "relato-final";
  let texto = `🏁 <strong>Final del partido:</strong> ${equipoA.name} ${golesA} - ${golesB} ${equipoB.name}`;
  if (penalesInfo) {
    texto += `<br/><span style="font-size:13px;">Definido por penales: ${penalesInfo.totalA} - ${penalesInfo.totalB}</span>`;
  }
  final.innerHTML = texto;
  ctx.relatoBox.appendChild(final);
  ctx.relatoBox.scrollTop = ctx.relatoBox.scrollHeight;
}

/* ---------- Estadisticas globales ---------- */
function renderGlobales() {
  clearTheme();
  const rows = [...TEAMS]
    .sort((a, b) => (b.stats.ataque + b.stats.defensa) - (a.stats.ataque + a.stats.defensa))
    .map((t) => {
      const conf = getConfederation(t.confedId);
      return `
      <tr>
        <td class="team-name"><div class="team-with-flag">${banderaHTML(t, 20)}<span>${t.name}</span>${estrellasHTML(t)}</div></td>
        <td style="color:${conf.colors.primary}">${conf.name}</td>
        <td>${t.stats.ataque}</td>
        <td>${t.stats.defensa}</td>
        <td>${t.stats.portero}</td>
        <td>${t.stats.forma > 0 ? "+" + t.stats.forma : t.stats.forma}</td>
      </tr>`;
    })
    .join("");
  appEl.innerHTML = `
    <h2 style="font-family:var(--font-display);font-size:30px;margin-bottom:6px;">Estadisticas Globales</h2>
    <p style="color:var(--text-muted);margin-bottom:18px;">Los 81 equipos, ordenados por nivel ofensivo + defensivo.</p>
    <table class="standings">
      <thead>
        <tr><th>Equipo</th><th>Confederacion</th><th>Ataque</th><th>Defensa</th><th>Portero</th><th>Forma</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ---------- Helpers compartidos: marcador en vivo ---------- */
function construirScoreboardHTML(eqA, eqB, key) {
  return `
    <div class="live-scoreboard" id="sb-${key}">
      <div class="score-side tied" data-side="A">${banderaHTML(eqA, 26)}<span class="side-name">${eqA.name}</span><span class="side-num">0</span></div>
      <div class="score-mid">VS</div>
      <div class="score-side tied" data-side="B"><span class="side-num">0</span><span class="side-name">${eqB.name}</span>${banderaHTML(eqB, 26)}</div>
    </div>
    <div class="relato-wrapper">
      <button class="relato-toggle" data-toggle="${key}">📜 Narración del partido <span class="chev">▾</span></button>
      <div class="relato-box" id="rb-${key}"></div>
    </div>
  `;
}

function obtenerCtxScoreboard(key, equipoAId, equipoBId) {
  const sb = document.getElementById(`sb-${key}`);
  return {
    relatoBox: document.getElementById(`rb-${key}`),
    scoreboardBox: sb,
    sideAEl: sb.querySelector('.score-side[data-side="A"]'),
    sideBEl: sb.querySelector('.score-side[data-side="B"]'),
    sideANumEl: sb.querySelector('.score-side[data-side="A"] .side-num'),
    sideBNumEl: sb.querySelector('.score-side[data-side="B"] .side-num'),
    equipoAId,
    equipoBId
  };
}

/* ---------- Repechaje ---------- */
function renderRepechaje() {
  clearTheme();
  aplicarTemaMundial();
  if (MUNDIAL.fase === "pendiente") {
    appEl.innerHTML = `
      <div class="world-header"><div class="world-header-inner"><h2>🎟️ Repechaje</h2></div></div>
      <p style="color:var(--text-muted)">Las eliminatorias ya terminaron. Dale a "Avanzar Fecha" una vez más para armar las 8 llaves del repechaje.</p>
    `;
    return;
  }

  const listo = repechajeCompleto();

  const filas = MUNDIAL.repechajePartidos
    .map((match, i) => {
      const eqA = getTeamById(match.equipoAId);
      const eqB = getTeamById(match.equipoBId);
      if (match.jugado) {
        const ganador = getTeamById(match.ganadorId);
        return `
        <div class="match-row">
          <div class="match-teams team-with-flag">${banderaHTML(eqA, 20)}<span>${eqA.name}</span></div>
          <div class="match-score">${match.golesA} - ${match.golesB}${match.penales ? " (pen.)" : ""}</div>
          <div class="match-teams team-with-flag"><span>${eqB.name}</span>${banderaHTML(eqB, 20)}</div>
          <span style="color:var(--accent-gold);font-family:var(--font-mono);font-size:11px;">Avanza: ${ganador.name}</span>
        </div>`;
      }
      return `
        <div class="match-row" data-rep="${i}">
          <div class="match-teams team-with-flag">
            ${banderaHTML(eqA, 20)}<span>${eqA.name}</span>
            <span style="color:var(--text-muted);margin:0 6px;">vs</span>
            ${banderaHTML(eqB, 20)}<span>${eqB.name}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary btn-rep-resultado" data-rep="${i}">Resultado</button>
            <button class="btn-primary btn-rep-simular" data-rep="${i}">Simular</button>
          </div>
        </div>
        <div class="relato-slot" data-rep="${i}"></div>
      `;
    })
    .join("");

  appEl.innerHTML = `
    <div class="world-header">
      <div class="world-header-inner">
        <h2>🎟️ Repechaje</h2>
        <p style="color:var(--text-muted);margin:6px 0 0;">
          Sede: <strong style="color:var(--accent-gold)">${MUNDIAL.sedeNombre || state.sede}</strong> (cupo directo asegurado).
          Los 16 peor ubicados entre los clasificados juegan 8 llaves a partido único
          (con prórroga y penales si hace falta) por los últimos 8 cupos al Mundial.
        </p>
      </div>
    </div>
    ${filas}
    ${listo ? `<p style="color:var(--accent-gold);margin-top:16px;">✅ Repechaje resuelto. Dale a "Avanzar Fecha" para sortear los grupos del Mundial.</p>` : ""}
  `;

  wireRepechajeButtons();
}

function wireRepechajeButtons() {
  appEl.querySelectorAll(".btn-rep-resultado").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.rep);
      jugarPartidoEliminacion(MUNDIAL.repechajePartidos[i], "resultado");
      renderRepechaje();
      updateNavLockState();
    });
  });
  appEl.querySelectorAll(".btn-rep-simular").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.rep);
      const match = jugarPartidoEliminacion(MUNDIAL.repechajePartidos[i], "simular");
      const row = appEl.querySelector(`.match-row[data-rep="${i}"]`);
      const slot = appEl.querySelector(`.relato-slot[data-rep="${i}"]`);
      if (row) row.querySelectorAll("button").forEach((b) => (b.disabled = true));
      if (slot) {
        const eqA = getTeamById(match.equipoAId);
        const eqB = getTeamById(match.equipoBId);
        slot.innerHTML = construirScoreboardHTML(eqA, eqB, `rep-${i}`);
        const ctx = obtenerCtxScoreboard(`rep-${i}`, match.equipoAId, match.equipoBId);
        reproducirRelato(match.relato, ctx, DURACION_MUNDIAL_MS, () => {
          updateNavLockState();
        }, match.penales);
      }
    });
  });
}

/* ---------- Mundial: enruta segun la fase actual ---------- */
function renderMundial() {
  clearTheme();
  aplicarTemaMundial();

  const hayAnterior = !!MUNDIAL_ANTERIOR;
  if (state.mundialViendo === "anterior" && !hayAnterior) state.mundialViendo = "actual";
  const data = state.mundialViendo === "anterior" ? MUNDIAL_ANTERIOR : MUNDIAL;
  const esActual = state.mundialViendo !== "anterior";

  const toggleHTML = hayAnterior
    ? `<div class="tabs">
        <button class="tab-btn btn-mundial-viendo ${state.mundialViendo === "actual" ? "active" : ""}" data-viendo="actual">Mundial Actual</button>
        <button class="tab-btn btn-mundial-viendo ${state.mundialViendo === "anterior" ? "active" : ""}" data-viendo="anterior">Mundial Anterior</button>
      </div>`
    : "";

  if (data.fase === "pendiente" || data.fase === "repechaje") {
    appEl.innerHTML = `
      ${toggleHTML}
      <div class="world-header"><div class="world-header-inner"><h2>🏆 MUNDIAL</h2></div></div>
      <p style="color:var(--text-muted)">Primero hay que resolver el repechaje (pestaña "Repechaje").</p>
    `;
    wireMundialViendoButtons();
    return;
  }

  const FASES_CON_BRACKET = ["dieciseisavos", "octavos", "cuartos", "semis", "final", "terminado"];
  const hayBracket = FASES_CON_BRACKET.includes(data.fase);
  if (!hayBracket) state.mundialTab = "grupos";

  const subTabsHTML = `
    <div class="tabs">
      <button class="tab-btn btn-mundial-tab ${state.mundialTab === "grupos" ? "active" : ""}" data-mtab="grupos">Fase de Grupos</button>
      <button class="tab-btn btn-mundial-tab ${state.mundialTab === "bracket" ? "active" : ""}" data-mtab="bracket" ${!hayBracket ? "disabled" : ""}>Camino a la Copa</button>
    </div>
  `;

  const banderaCampeon = data.fase === "terminado"
    ? `<div class="world-header"><div class="world-header-inner">
        <h2>🏆 ¡CAMPEÓN!</h2>
        <div style="margin-top:14px;display:flex;align-items:center;justify-content:center;gap:12px;">
          ${banderaHTML(getTeamById(data.campeonId), 44)}
          <span style="font-family:var(--font-display);font-size:28px;color:${getConfederation(getTeamById(data.campeonId).confedId).colors.primary}">${getTeamById(data.campeonId).name}</span>
        </div>
      </div></div>`
    : "";

  appEl.innerHTML = `${toggleHTML}${banderaCampeon}${subTabsHTML}<div id="mundialSubContent"></div>`;
  wireMundialViendoButtons();

  const sub = document.getElementById("mundialSubContent");
  if (state.mundialTab === "bracket" && hayBracket) {
    sub.innerHTML = renderBracketContenidoHTML(data, esActual);
    wireBracketButtons(esActual);
  } else {
    sub.innerHTML = renderGruposContenidoHTML(data, esActual);
    wireGrupoSelectorButtons(data, esActual);
    wireGrupoButtons(esActual);
  }
}

function wireMundialViendoButtons() {
  appEl.querySelectorAll(".btn-mundial-viendo").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mundialViendo = btn.dataset.viendo;
      state.mundialTab = "grupos";
      renderMundial();
    });
  });
  appEl.querySelectorAll(".btn-mundial-tab").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      state.mundialTab = btn.dataset.mtab;
      renderMundial();
    });
  });
}

function renderGruposContenidoHTML(data, esActual) {
  if (!state.grupoSeleccionado || !data.grupos.some((g) => g.nombre === state.grupoSeleccionado)) {
    const conPendientes = esActual ? data.grupos.find((g) => proximaJornadaGrupoIndex(g) !== null) : null;
    state.grupoSeleccionado = (conPendientes || data.grupos[0]).nombre;
  }

  const selectorHTML = data.grupos
    .map((g) => {
      const terminado = proximaJornadaGrupoIndex(g) === null;
      const activo = g.nombre === state.grupoSeleccionado;
      return `
      <button class="tab-btn btn-grupo-selector ${activo ? "active" : ""}" data-grupo="${g.nombre}">
        Grupo ${g.nombre} ${terminado ? "✅" : ""}
      </button>`;
    })
    .join("");

  const grupo = data.grupos.find((g) => g.nombre === state.grupoSeleccionado);
  const tabla = calcularTablaGrupo(grupo);
  const idx = esActual ? proximaJornadaGrupoIndex(grupo) : null;

  const filasTabla = tabla
    .map((row, i) => {
      const team = getTeamById(row.teamId);
      const clasifica = i < 2;
      return `
      <tr style="${clasifica ? "background:rgba(255,255,255,0.03);" : ""}">
        <td class="team-name"><div class="team-with-flag">
          <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">${i + 1}</span>${estrellasHTML(team)}
          ${banderaHTML(team, 24)}
          <span style="${clasifica ? "color:var(--accent-gold);font-weight:600;" : ""}">${team.name}</span>
        </div></td>
        <td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td>
        <td>${row.gf}</td><td>${row.gc}</td><td>${row.dg}</td><td><strong>${row.pts}</strong></td>
      </tr>`;
    })
    .join("");

  let partidosHTML = `<p style="color:var(--accent-gold);margin-top:14px;">✅ Este grupo ya finalizó todos sus partidos.</p>`;
  if (idx !== null) {
    const filas = grupo.jornadas[idx]
      .map((match, mi) => {
        if (match.jugado) return "";
        const eqA = getTeamById(match.equipoAId);
        const eqB = getTeamById(match.equipoBId);
        const key = `grp-${grupo.nombre}-${idx}-${mi}`;
        return `
        <div class="match-row" data-key="${key}">
          <div class="match-teams team-with-flag">${banderaHTML(eqA, 22)}<span>${eqA.name}</span><span style="color:var(--text-muted);margin:0 6px;">vs</span>${banderaHTML(eqB, 22)}<span>${eqB.name}</span></div>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary btn-grp-resultado" data-grupo="${grupo.nombre}" data-jornada="${idx}" data-match="${mi}">Resultado</button>
            <button class="btn-primary btn-grp-simular" data-key="${key}" data-grupo="${grupo.nombre}" data-jornada="${idx}" data-match="${mi}">Simular</button>
          </div>
        </div>
        <div class="relato-slot" data-key="${key}"></div>
        `;
      })
      .join("");
    partidosHTML = `<h4 style="font-family:var(--font-display);font-size:16px;margin:18px 0 8px;">Fecha ${idx + 1} de 3</h4>${filas}`;
  } else if (!esActual) {
    partidosHTML = "";
  }

  return `
    <div class="world-header">
      <div class="world-header-inner">
        <h2>🏆 FASE DE GRUPOS</h2>
        <p style="color:var(--text-muted);margin-top:6px;">${data.grupos.length * 4} equipos, ${data.grupos.length} grupos de 4. Clasifican los 2 primeros de cada grupo.</p>
      </div>
    </div>
    <div class="tabs" style="flex-wrap:wrap;">${selectorHTML}</div>
    <div class="conf-header" style="padding:20px;">
      <h2 style="font-size:24px;">Grupo ${grupo.nombre}</h2>
    </div>
    <table class="standings">
      <thead><tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
      <tbody>${filasTabla}</tbody>
    </table>
    ${partidosHTML}
  `;
}

function wireGrupoSelectorButtons(data, esActual) {
  appEl.querySelectorAll(".btn-grupo-selector").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.grupoSeleccionado = btn.dataset.grupo;
      const sub = document.getElementById("mundialSubContent");
      sub.innerHTML = renderGruposContenidoHTML(data, esActual);
      wireGrupoSelectorButtons(data, esActual);
      wireGrupoButtons(esActual);
    });
  });
}

function wireGrupoButtons(esActual) {
  if (!esActual) return; // el mundial anterior es de solo lectura
  appEl.querySelectorAll(".btn-grp-resultado").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { grupo, jornada, match } = btn.dataset;
      jugarPartidoDeGrupo(grupo, Number(jornada), Number(match), "resultado");
      if (todosLosGruposTerminados()) avanzarAKnockoutInicial();
      renderMundial();
      updateNavLockState();
    });
  });
  appEl.querySelectorAll(".btn-grp-simular").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { key, grupo, jornada, match } = btn.dataset;
      const played = jugarPartidoDeGrupo(grupo, Number(jornada), Number(match), "simular");
      const row = appEl.querySelector(`.match-row[data-key="${key}"]`);
      const slot = appEl.querySelector(`.relato-slot[data-key="${key}"]`);
      if (row) row.querySelectorAll("button").forEach((b) => (b.disabled = true));
      if (slot) {
        const eqA = getTeamById(played.equipoAId);
        const eqB = getTeamById(played.equipoBId);
        slot.innerHTML = construirScoreboardHTML(eqA, eqB, key);
        const ctx = obtenerCtxScoreboard(key, played.equipoAId, played.equipoBId);
        reproducirRelato(played.relato, ctx, DURACION_MUNDIAL_MS, () => {
          if (todosLosGruposTerminados()) avanzarAKnockoutInicial();
          updateNavLockState();
        });
      }
    });
  });
}

function nombreRonda(r) {
  return {
    dieciseisavos: "Dieciseisavos de Final",
    octavos: "Octavos de Final",
    cuartos: "Cuartos de Final",
    semis: "Semifinal",
    final: "🏆 Final",
    tercerLugar: "🥉 Tercer Lugar"
  }[r];
}

function filaBracketHTML(match, ronda, mi, activa) {
  const eqA = getTeamById(match.equipoAId);
  const eqB = getTeamById(match.equipoBId);
  if (match.jugado) {
    return `
    <div class="match-row">
      <div class="match-teams team-with-flag">${banderaHTML(eqA, 18)}<span style="${match.ganadorId === eqA.id ? "color:var(--accent-gold);font-weight:700;" : ""}">${eqA.name}</span></div>
      <div class="match-score">${match.golesA}-${match.golesB}${match.fueAPenales ? ` (pen. ${match.penales.totalA}-${match.penales.totalB})` : match.fueAProrroga ? " (prórroga)" : ""}</div>
      <div class="match-teams team-with-flag"><span style="${match.ganadorId === eqB.id ? "color:var(--accent-gold);font-weight:700;" : ""}">${eqB.name}</span>${banderaHTML(eqB, 18)}</div>
    </div>`;
  }
  if (!activa) {
    return `<div class="match-row"><span style="color:var(--text-muted);">Esperando resultados de la ronda anterior…</span></div>`;
  }
  const key = `br-${ronda}-${mi}`;
  return `
  <div class="match-row" data-key="${key}">
    <div class="match-teams team-with-flag">${banderaHTML(eqA, 18)}<span>${eqA.name}</span><span style="color:var(--text-muted);margin:0 6px;">vs</span>${banderaHTML(eqB, 18)}<span>${eqB.name}</span></div>
    <div style="display:flex;gap:8px;">
      <button class="btn-secondary btn-br-resultado" data-ronda="${ronda}" data-match="${mi}">Resultado</button>
      <button class="btn-primary btn-br-simular" data-key="${key}" data-ronda="${ronda}" data-match="${mi}">Simular</button>
    </div>
  </div>
  <div class="relato-slot" data-key="${key}"></div>
  `;
}

function bloqueRondaHTML(data, ronda, indices, esActual) {
  const partidos = data.bracket[ronda];
  const activa = esActual && (ronda === data.fase || (ronda === "tercerLugar" && data.fase === "final"));
  const filas = indices
    .map((mi) => (partidos[mi] ? filaBracketHTML(partidos[mi], ronda, mi, activa) : `<div class="match-row"><span style="color:var(--text-muted);">Por definir.</span></div>`))
    .join("");
  return `<h4 style="font-family:var(--font-display);font-size:15px;margin:14px 0 8px;color:var(--accent-gold);">${nombreRonda(ronda)}</h4>${filas}`;
}

function renderBracketContenidoHTML(data, esActual) {
  const hayDieciseisavos = data.bracket.dieciseisavos.length === 16;
  const hayCuartos = data.bracket.cuartos.length === 4;
  const haySemis = data.bracket.semis.length === 2;
  const hayFinal = data.bracket.final.length === 1;

  const rondaInicialIzq = hayDieciseisavos
    ? bloqueRondaHTML(data, "dieciseisavos", [0, 1, 2, 3, 4, 5, 6, 7], esActual)
    : bloqueRondaHTML(data, "octavos", [0, 1, 2, 3], esActual);
  const rondaInicialDer = hayDieciseisavos
    ? bloqueRondaHTML(data, "dieciseisavos", [8, 9, 10, 11, 12, 13, 14, 15], esActual)
    : bloqueRondaHTML(data, "octavos", [4, 5, 6, 7], esActual);

  const ladoIzquierdo = `
    ${rondaInicialIzq}
    ${hayDieciseisavos && data.bracket.octavos.length ? bloqueRondaHTML(data, "octavos", [0, 1, 2, 3], esActual) : ""}
    ${hayCuartos ? bloqueRondaHTML(data, "cuartos", [0, 1], esActual) : ""}
    ${haySemis ? bloqueRondaHTML(data, "semis", [0], esActual) : ""}
  `;
  const ladoDerecho = `
    ${rondaInicialDer}
    ${hayDieciseisavos && data.bracket.octavos.length ? bloqueRondaHTML(data, "octavos", [4, 5, 6, 7], esActual) : ""}
    ${hayCuartos ? bloqueRondaHTML(data, "cuartos", [2, 3], esActual) : ""}
    ${haySemis ? bloqueRondaHTML(data, "semis", [1], esActual) : ""}
  `;
  const centro = hayFinal
    ? `${bloqueRondaHTML(data, "tercerLugar", [0], esActual)}${bloqueRondaHTML(data, "final", [0], esActual)}`
    : `<p style="color:var(--text-muted);text-align:center;margin-top:40px;">La final y el tercer lugar se arman cuando terminen las semifinales.</p>`;

  return `
    <div class="bracket-container">
      <div class="bracket-side">${ladoIzquierdo}</div>
      <div class="bracket-center">${centro}</div>
      <div class="bracket-side">${ladoDerecho}</div>
    </div>
  `;
}

function wireBracketButtons(esActual) {
  if (!esActual) return; // el mundial anterior es de solo lectura
  appEl.querySelectorAll(".btn-br-resultado").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ronda = btn.dataset.ronda;
      const mi = Number(btn.dataset.match);
      jugarPartidoBracket(ronda, mi, "resultado");
      renderMundial();
      updateNavLockState();
    });
  });
  appEl.querySelectorAll(".btn-br-simular").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const ronda = btn.dataset.ronda;
      const mi = Number(btn.dataset.match);
      const match = MUNDIAL.bracket[ronda][mi];
      jugarPartidoEliminacion(match, "simular"); // llena relato/ganador, sin avanzar ronda aun

      const row = appEl.querySelector(`.match-row[data-key="${key}"]`);
      const slot = appEl.querySelector(`.relato-slot[data-key="${key}"]`);
      if (row) row.querySelectorAll("button").forEach((b) => (b.disabled = true));
      if (slot) {
        const eqA = getTeamById(match.equipoAId);
        const eqB = getTeamById(match.equipoBId);
        slot.innerHTML = construirScoreboardHTML(eqA, eqB, key);
        const ctx = obtenerCtxScoreboard(key, match.equipoAId, match.equipoBId);
        reproducirRelato(match.relato, ctx, DURACION_MUNDIAL_MS, () => {
          avanzarSiguienteRondaBracket();
          updateNavLockState();
        }, match.penales);
      }
    });
  });
}

/* ---------- Campeones: historial de Mundiales ---------- */
function renderCampeones() {
  clearTheme();
  if (HISTORIAL_MUNDIALES.length === 0) {
    appEl.innerHTML = `
      <h2 style="font-family:var(--font-display);font-size:30px;margin-bottom:10px;">🏆 Campeones</h2>
      <p style="color:var(--text-muted)">Todavía no se ha coronado ningún campeón. ¡Termina un ciclo completo del Mundial para que aparezca aquí!</p>
    `;
    return;
  }

  const filas = [...HISTORIAL_MUNDIALES]
    .reverse()
    .map((h) => {
      const campeon = getTeamById(h.campeonId);
      const sub = getTeamById(h.subcampeonId);
      const tercero = getTeamById(h.tercerId);
      const confCampeon = getConfederation(campeon.confedId);
      return `
      <div class="match-row" style="flex-wrap:wrap;">
        <div style="font-family:var(--font-mono);color:var(--text-muted);min-width:60px;">${h.anio}</div>
        <div style="min-width:160px;color:var(--text-muted);font-size:12px;">Sede: <strong style="color:var(--text-main)">${h.sedeName}</strong></div>
        <div class="team-with-flag">🥇 ${banderaHTML(campeon, 22)}<span style="color:${confCampeon.colors.primary};font-weight:700;">${campeon.name}</span></div>
        <div class="team-with-flag">🥈 ${banderaHTML(sub, 18)}<span>${sub.name}</span></div>
        <div class="team-with-flag">🥉 ${banderaHTML(tercero, 18)}<span>${tercero.name}</span></div>
      </div>`;
    })
    .join("");

  appEl.innerHTML = `
    <h2 style="font-family:var(--font-display);font-size:30px;margin-bottom:6px;">🏆 Campeones</h2>
    <p style="color:var(--text-muted);margin-bottom:18px;">Historial de todos los Mundiales jugados (más reciente primero). Las estrellas ★ junto a cada equipo en las tablas de eliminatoria indican cuántos títulos tiene.</p>
    ${filas}
  `;
}

/* ---------- Pantalla de configuracion inicial (formato + sede) ----------
   Se muestra antes de cada eliminatoria (arranque y cada reinicio de
   temporada). Bloquea el resto de la navegacion hasta completarse. */
function renderSetup() {
  clearTheme();
  const formato = state.formatoMundial;
  const haySedes = state.sedes && state.sedes.length > 0;

  const sedesHTML = haySedes
    ? state.sedes
        .map((id) => {
          const t = getTeamById(id);
          const conf = getConfederation(t.confedId);
          return `<span class="team-with-flag" style="margin-right:14px;">${banderaHTML(t, 24)}<span style="color:${conf.colors.primary};font-weight:600;">${t.name}</span></span>`;
        })
        .join("")
    : "";

  appEl.innerHTML = `
    <section class="hero">
      <h1>CONFIGURA LA <span>TEMPORADA</span></h1>
      <p>Antes de arrancar las eliminatorias hay que definir el formato del Mundial y sortear la sede (o sedes).</p>
    </section>

    <div class="conf-header">
      <h2 style="font-size:22px;">1. Formato del Mundial</h2>
      <div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;">
        <button class="${formato === 32 ? "btn-primary" : "btn-secondary"}" id="btnFormato32">32 equipos (clásico)</button>
        <button class="${formato === 48 ? "btn-primary" : "btn-secondary"}" id="btnFormato48">48 equipos (grande, con dieciseisavos)</button>
      </div>
      ${formato ? `<p style="color:var(--accent-gold);margin-top:12px;">Formato elegido: <strong>${formato} equipos</strong>.</p>` : ""}
    </div>

    ${formato ? `
    <div class="conf-header">
      <h2 style="font-size:22px;">2. Sede del Mundial</h2>
      <p style="color:var(--text-muted);margin:6px 0 12px;">Se sorteará entre 1 y 4 países sede (mayormente de la misma confederación, aunque a veces se suma uno de otra).</p>
      <button class="btn-primary" id="btnSortearSede">🎲 Sortear sede(s)</button>
      ${haySedes ? `<div style="margin-top:14px;">${sedesHTML}</div>` : ""}
    </div>` : ""}

    ${formato && haySedes ? `
    <div style="text-align:center;margin-top:24px;">
      <button class="btn-primary" id="btnComenzar" style="font-size:16px;padding:14px 30px;">Comenzar Eliminatorias ▶</button>
    </div>` : ""}
  `;

  const b32 = document.getElementById("btnFormato32");
  const b48 = document.getElementById("btnFormato48");
  if (b32) b32.addEventListener("click", () => { state.formatoMundial = 32; state.sedes = []; state.sede = null; renderSetup(); });
  if (b48) b48.addEventListener("click", () => { state.formatoMundial = 48; state.sedes = []; state.sede = null; renderSetup(); });

  const btnSortear = document.getElementById("btnSortearSede");
  if (btnSortear) btnSortear.addEventListener("click", () => {
    elegirSedes();
    renderSetup();
  });

  const btnComenzar = document.getElementById("btnComenzar");
  if (btnComenzar) btnComenzar.addEventListener("click", () => {
    state.setupCompleto = true;
    updateFooter();
    renderView("menu");
  });
}

/* Tematiza los encabezados del Mundial con los colores de la(s)
   confederacion(es) sede, en vez de un degradado fijo para todos. */
function aplicarTemaMundial() {
  const colores = coloresMundial();
  document.documentElement.style.setProperty("--mundial-gradient", `linear-gradient(90deg, ${colores.join(", ")})`);
}

function updateNavLockState() {
  const repBtn = document.getElementById("repechajeNavBtn");
  repBtn.disabled = !state.setupCompleto || !state.repechajeDesbloqueado;
  repBtn.textContent = state.repechajeDesbloqueado ? "Repechaje" : "Repechaje 🔒";

  const wcBtn = document.getElementById("worldCupNavBtn");
  wcBtn.disabled = !state.setupCompleto || !state.mundialDesbloqueado;
  wcBtn.textContent = state.mundialDesbloqueado ? "Mundial" : "Mundial 🔒";
}

function renderView(view) {
  if (!state.setupCompleto) view = "setup";
  state.currentView = view;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (btn) btn.classList.add("active");

  if (view === "setup") renderSetup();
  else if (view === "menu") renderMenu();
  else if (view === "confederaciones") renderConfederaciones();
  else if (view === "globales") renderGlobales();
  else if (view === "repechaje") renderRepechaje();
  else if (view === "mundial") renderMundial();
  else if (view === "campeones") renderCampeones();
}
