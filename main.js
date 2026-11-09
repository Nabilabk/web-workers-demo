// =============================================================
//  main.js : s'exécute sur le MAIN THREAD (le thread de l'interface)
// =============================================================

const $ = (id) => document.getElementById(id);
const nombre = (n) => n.toLocaleString("fr-FR");
const ms = (n) => nombre(Math.round(n)) + " ms";

let limite = 10_000_000; // charge choisie
let mesure = null;       // mesures pendant un calcul : { gelMax, fpsMin }
const resultats = {};    // dernière exécution de chaque mode

// -------------------------------------------------------------
//  1. Moniteur de fluidité (requestAnimationFrame)
//     Tout ici tourne sur le main thread : si le main thread est
//     bloqué, la balle, le chrono et la courbe s'arrêtent.
// -------------------------------------------------------------
const fpsEl = $("fps");
const courbe = $("courbe");
const ctx = courbe.getContext("2d");
const piste = $("piste");
const balle = $("balle");

const NB_POINTS = 120;                // 120 points x 250 ms = 30 s d'historique
const points = new Array(NB_POINTS).fill(60);
let aRedessiner = true;
let derniereImage = performance.now();
let debutFenetre = derniereImage;
let imagesFenetre = 0;
let position = 0;
let direction = 1;

function ajouterPoint(fps) {
  points.push(fps);
  points.shift();
  fpsEl.textContent = fps;
  fpsEl.dataset.niveau = fps >= 50 ? "ok" : fps >= 25 ? "moyen" : "ko";
  if (mesure) mesure.fpsMin = Math.min(mesure.fpsMin, fps);
  aRedessiner = true;
}

function animer() {
  // performance.now() plutôt que l'horodatage de requestAnimationFrame :
  // juste après un gel, ce dernier peut dater d'avant la fin du blocage.
  const t = performance.now();
  const ecart = t - derniereImage; // temps écoulé depuis l'image précédente
  derniereImage = t;
  if (mesure) mesure.gelMax = Math.max(mesure.gelMax, ecart);

  // Gel détecté : on ajoute des points à 0 FPS pour toute sa durée
  if (ecart > 250) {
    const n = Math.min(Math.floor(ecart / 250), NB_POINTS);
    for (let i = 0; i < n; i++) ajouterPoint(0);
    debutFenetre = t;
    imagesFenetre = 0;
  }

  // Balle qui fait des allers-retours
  const max = piste.clientWidth - balle.offsetWidth - 12;
  position += direction * 4;
  if (position >= max) { position = max; direction = -1; }
  if (position <= 0) { position = 0; direction = 1; }
  balle.style.transform = `translateX(${position}px)`;

  $("chrono").textContent = (t / 1000).toFixed(2) + " s";

  // Calcul du FPS toutes les 250 ms
  imagesFenetre++;
  if (t - debutFenetre >= 250) {
    const duree = t - debutFenetre;
    ajouterPoint(Math.min(60, Math.round((imagesFenetre * 1000) / duree)));
    $("temps-image").textContent = (duree / imagesFenetre).toFixed(1) + " ms";
    debutFenetre = t;
    imagesFenetre = 0;
  }

  if (aRedessiner) dessinerCourbe();
  requestAnimationFrame(animer);
}

function dessinerCourbe() {
  aRedessiner = false;
  const dpr = window.devicePixelRatio || 1;
  const w = courbe.clientWidth;
  const h = courbe.clientHeight;
  if (courbe.width !== Math.round(w * dpr) || courbe.height !== Math.round(h * dpr)) {
    courbe.width = Math.round(w * dpr);
    courbe.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim();
  const danger = css.getPropertyValue("--danger").trim();
  const grille = css.getPropertyValue("--bordure-forte").trim();
  const doux = css.getPropertyValue("--texte-doux").trim();

  const y = (fps) => h - 2 - (fps / 66) * (h - 4);
  const pas = w / (NB_POINTS - 1);

  // Ligne de référence : 60 FPS
  ctx.strokeStyle = grille;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(0, y(60));
  ctx.lineTo(w, y(60));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = doux;
  ctx.font = "500 11px 'Geist Mono', ui-monospace, monospace";
  ctx.fillText("60 FPS", 0, y(60) + 15);

  // Courbe (rouge si la page vient de se figer)
  const couleur = Math.min(...points.slice(-8)) < 25 ? danger : accent;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(i * pas, y(p)) : ctx.moveTo(0, y(p))));
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Remplissage sous la courbe
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = couleur;
  ctx.fill();
  ctx.globalAlpha = 1;
}

window.addEventListener("resize", () => (aRedessiner = true));
requestAnimationFrame(animer);

// -------------------------------------------------------------
//  2. Utilitaires d'affichage
//     Chaque version a sa carte (A = "sans", B = "avec") :
//     les fonctions ci-dessous mettent à jour la carte active.
// -------------------------------------------------------------
const btnSans = $("btn-sans");
const btnAvec = $("btn-avec");
const btnStop = $("btn-stop");
const segment = document.querySelectorAll("[data-limite]");
const journal = $("journal");

let modeActif = "sans"; // carte concernée par l'affichage : "sans" ou "avec"

const LIBELLES = { libre: "Libre", bloque: "Bloqué", inactif: "Inactif", calcul: "En calcul", arrete: "Arrêté" };

function etatThreads(main, worker) {
  for (const [el, etat] of [[$("etat-main"), main], [$("etat-worker"), worker]]) {
    el.dataset.etat = etat;
    el.querySelector("strong").textContent = LIBELLES[etat];
  }
}

// Badge d'état de la carte active : Prêt / En cours / Terminé en X ms
function afficherStatut(texte, classe = "") {
  const badge = $("badge-" + modeActif);
  badge.textContent = texte;
  badge.className = "badge " + classe;
}

function progression(pourcent) {
  $("barre-" + modeActif).style.width = pourcent + "%";
  $("pourcent-" + modeActif).textContent = pourcent + " %";
}

function log(source, message) {
  journal.querySelector(".journal-vide")?.remove();
  const li = document.createElement("li");
  const heure = new Date().toLocaleTimeString("fr-FR");
  const noms = { main: "main", worker: "worker", systeme: "système" };
  li.innerHTML = `<time>${heure}</time><span class="tag ${source}">${noms[source]}</span><span></span>`;
  li.lastChild.textContent = message;
  journal.prepend(li);
}

function viderJournal() {
  journal.innerHTML = '<li class="journal-vide">Aucun message pour l\'instant.</li>';
}

function occupe(mode) {
  btnSans.disabled = btnAvec.disabled = !!mode;
  segment.forEach((b) => (b.disabled = !!mode));
  $("carte-sans").classList.toggle("actif", mode === "sans");
  $("carte-avec").classList.toggle("actif", mode === "avec");
}

function demarrer(mode) {
  modeActif = mode;
  mesure = { gelMax: 0, fpsMin: Infinity };
  occupe(mode);
  progression(0);
  $(mode + "-nb").textContent = "…";
}

function terminer(mode, nb, duree) {
  // On attend l'image suivante : le moniteur mesure alors le gel complet
  requestAnimationFrame(() => {
    const { gelMax, fpsMin } = mesure || { gelMax: 0, fpsMin: Infinity };
    mesure = null;
    resultats[mode] = { limite, nb, duree, gelMax, fpsMin: fpsMin === Infinity ? 60 : fpsMin };
    afficherComparaison();
    occupe(null);
  });
}

// Remplit les deux cartes avec leur dernier résultat
function afficherComparaison() {
  for (const mode of ["sans", "avec"]) {
    const r = resultats[mode];
    if (!r) continue;
    $(`${mode}-nb`).textContent = nombre(r.nb);
    $(`${mode}-charge`).textContent = `entre 2 et ${nombre(r.limite)}`;
    $(`${mode}-duree`).textContent = ms(r.duree);
    $(`${mode}-gel`).textContent = ms(r.gelMax);
    $(`${mode}-fps`).textContent = r.fpsMin;
    $(`${mode}-ui`).innerHTML = r.gelMax > 200
      ? '<span class="verdict-valeur ko">Figée</span>'
      : '<span class="verdict-valeur ok">Fluide</span>';
  }
}

// -------------------------------------------------------------
//  3. VERSION 1 : SANS worker -> le calcul bloque l'interface
// -------------------------------------------------------------
btnSans.addEventListener("click", () => {
  demarrer("sans");
  etatThreads("bloque", "inactif");
  afficherStatut("En cours…", "encours");
  log("main", `compterPremiers(${nombre(limite)}) lancé sur le main thread`);

  // Petit délai pour laisser le navigateur afficher l'état « Bloqué »
  setTimeout(() => {
    const debut = performance.now();

    // Le calcul s'exécute ICI, sur le main thread.
    // La barre est mise à jour… mais l'écran ne peut pas se
    // redessiner tant que le calcul n'est pas terminé !
    const nb = compterPremiers(limite, progression);

    const duree = performance.now() - debut;
    etatThreads("libre", "inactif");
    afficherStatut(`Terminé en ${ms(duree)}`, "termine");
    log("main", `Terminé en ${ms(duree)} : aucune image affichée pendant ce temps`);
    terminer("sans", nb, duree);
  }, 60);
});

// -------------------------------------------------------------
//  4. VERSION 2 : AVEC worker -> l'interface reste fluide
// -------------------------------------------------------------
let worker = null;

function creerWorker() {
  // Création du worker : le navigateur lance un nouveau thread
  worker = new Worker("worker.js");
  log("systeme", 'new Worker("worker.js") : thread créé');

  // Réception des messages envoyés par le worker
  worker.onmessage = (event) => {
    const msg = event.data;

    if (msg.type === "progression") {
      progression(msg.pourcent); // l'écran se met à jour en direct
      if (msg.pourcent % 25 === 0 && msg.pourcent > 0) {
        log("worker", `postMessage({ type: "progression", pourcent: ${msg.pourcent} })`);
      }
    }

    if (msg.type === "resultat") {
      etatThreads("libre", "inactif");
      afficherStatut(`Terminé en ${ms(msg.duree)}`, "termine");
      log("worker", `postMessage({ type: "resultat", resultat: ${nombre(msg.resultat)} })`);
      btnStop.disabled = true;
      terminer("avec", msg.resultat, msg.duree);
    }
  };

  // Gestion des erreurs (bonne pratique)
  worker.onerror = (erreur) => {
    erreur.preventDefault();
    log("systeme", "Erreur dans le worker : " + (erreur.message || "fichier introuvable ?"));
    afficherStatut("Erreur", "erreur");
    etatThreads("libre", "arrete");
    btnStop.disabled = true;
    worker = null;
    mesure = null;
    occupe(null);
  };
}

btnAvec.addEventListener("click", () => {
  if (!worker) creerWorker(); // un seul worker, réutilisé (bonne pratique)

  demarrer("avec");
  etatThreads("libre", "calcul");
  afficherStatut("En cours…", "encours");
  btnStop.disabled = false;
  log("main", `worker.postMessage(${nombre(limite)})`);

  // Envoi de la tâche : la page continue immédiatement
  worker.postMessage(limite);
});

// -------------------------------------------------------------
//  5. Arrêt du worker : terminate()
// -------------------------------------------------------------
btnStop.addEventListener("click", () => {
  worker.terminate(); // le thread est tué immédiatement
  worker = null;      // un nouveau sera créé au prochain clic
  mesure = null;
  etatThreads("libre", "arrete");
  afficherStatut("Arrêté", "arrete");
  log("systeme", "worker.terminate() : calcul annulé, mémoire libérée");
  btnStop.disabled = true;
  $("avec-nb").textContent = "—";
  occupe(null);
});

// -------------------------------------------------------------
//  6. Réglages et vérifications au démarrage
// -------------------------------------------------------------

// Choix de la charge
segment.forEach((bouton) => {
  bouton.addEventListener("click", () => {
    segment.forEach((b) => b.setAttribute("aria-checked", b === bouton));
    limite = Number(bouton.dataset.limite);
  });
});

// Thème clair / sombre
const racine = document.documentElement;
try {
  const theme = localStorage.getItem("theme");
  if (theme) racine.dataset.theme = theme;
} catch (e) {}
$("theme").addEventListener("click", () => {
  const sombre = racine.dataset.theme
    ? racine.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  racine.dataset.theme = sombre ? "light" : "dark";
  try { localStorage.setItem("theme", racine.dataset.theme); } catch (e) {}
  aRedessiner = true;
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => (aRedessiner = true));

$("vider").addEventListener("click", viderJournal);
viderJournal();

$("coeurs").textContent = navigator.hardwareConcurrency || "?";

const alerte = $("alerte");
if (!("Worker" in window)) {
  alerte.textContent = "Ce navigateur ne prend pas en charge les Web Workers.";
  alerte.hidden = false;
  btnAvec.disabled = true;
} else if (location.protocol === "file:") {
  alerte.innerHTML =
    "Page ouverte en <code>file://</code> : le navigateur bloquera le worker. " +
    "Lancez <code>lancer-demo.bat</code> ou l'extension Live Server de VS Code.";
  alerte.hidden = false;
}
