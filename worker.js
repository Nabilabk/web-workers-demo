// =============================================================
//  worker.js : s'exécute dans un THREAD SÉPARÉ
//  Ici, pas de document, pas de window, pas d'accès au DOM.
//  `self` désigne le worker lui-même.
// =============================================================

// Un worker peut charger d'autres scripts
importScripts("calcul.js");

// 1) Réception d'un message envoyé par la page
self.onmessage = (event) => {
  const limite = event.data;
  const debut = performance.now();

  // 2) Calcul lourd : il bloque le worker, mais PAS l'interface
  const resultat = compterPremiers(limite, (pourcent) => {
    // On peut envoyer plusieurs messages pendant le calcul
    self.postMessage({ type: "progression", pourcent });
  });

  // 3) Envoi du résultat final à la page
  self.postMessage({
    type: "resultat",
    resultat,
    duree: performance.now() - debut,
  });
};
