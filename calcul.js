// =============================================================
//  calcul.js : la tâche lourde, partagée par les deux versions
//  - chargée dans la page avec <script src="calcul.js">
//  - chargée dans le worker avec importScripts("calcul.js")
// =============================================================

/**
 * Compte les nombres premiers entre 2 et `limite`.
 * Méthode volontairement naïve (division par tous les diviseurs)
 * pour être lente : c'est un calcul CPU pur.
 *
 * @param {number} limite        borne supérieure
 * @param {function} [progres]   appelée avec un pourcentage (0 à 100)
 * @returns {number}             nombre de nombres premiers trouvés
 */
function compterPremiers(limite, progres) {
  let compteur = 0;
  const pas = Math.floor(limite / 100); // on signale l'avancement tous les 1 %

  for (let n = 2; n <= limite; n++) {
    let estPremier = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        estPremier = false;
        break;
      }
    }
    if (estPremier) compteur++;

    if (progres && n % pas === 0) progres(Math.round((n / limite) * 100));
  }
  return compteur;
}
