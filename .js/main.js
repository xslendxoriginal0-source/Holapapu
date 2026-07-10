/* ============================================================
   main.js — Estado global y arranque de la app
   ============================================================ */

const state = {
  fechaGlobal: 0,
  sede: null,
  sedeTeamId: null,
  sedes: [],
  formatoMundial: null, // 32 o 48, se elige en la pantalla de configuracion
  setupCompleto: false, // hay que elegir formato + sede antes de jugar
  mundialDesbloqueado: false,
  repechajeDesbloqueado: false,
  temporada: 1,
  anioBase: 2026, // año ficticio del primer Mundial
  grupoSeleccionado: null,
  mundialTab: "grupos",     // "grupos" | "bracket", dentro de la pestaña Mundial
  mundialViendo: "actual",  // "actual" | "anterior"
  currentView: "menu"
};

function navigateTo(view) {
  renderView(view);
}

document.getElementById("mainNav").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (!btn || btn.disabled) return;
  if (!state.setupCompleto) {
    renderView("setup");
    return;
  }
  navigateTo(btn.dataset.view);
});

document.getElementById("avanzarFechaBtn").addEventListener("click", () => {
  if (!state.setupCompleto) {
    renderView("setup");
    return;
  }
  const seJugo = avanzarFechaGlobal();
  updateFooter();
  updateNavLockState();
  if (!seJugo) {
    alert("Ya no quedan fechas pendientes en las eliminatorias. ¡El Mundial esta listo para jugarse!");
  }
  // Refrescamos la vista actual para reflejar los nuevos resultados
  renderView(state.currentView);
});

// Colapsar/expandir la narracion de un partido sin borrarla (funciona
// para cualquier pantalla: eliminatorias, repechaje, grupos o bracket).
document.getElementById("app").addEventListener("click", (e) => {
  const btn = e.target.closest(".relato-toggle");
  if (!btn) return;
  const key = btn.dataset.toggle;
  const box = document.getElementById(`rb-${key}`);
  if (!box) return;
  const colapsado = box.classList.toggle("collapsed");
  const chev = btn.querySelector(".chev");
  if (chev) chev.textContent = colapsado ? "▸" : "▾";
});

function updateFooter() {
  document.getElementById("fechaGlobalLabel").textContent = `Fecha global: ${state.fechaGlobal}`;
  document.getElementById("sedeLabel").textContent = state.sede
    ? `Sede: ${state.sede}`
    : "Sede: por sortear";
}

// Arranque
generarTodosLosFixtures();
updateFooter();
updateNavLockState();
renderView("setup");
