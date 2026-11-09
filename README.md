# Web Workers : démo avant / après

## Lancer la démo

Les workers ne fonctionnent **pas** si on ouvre `index.html` en double-cliquant (`file://`).
Il faut un serveur local :

- **Option 1** : double-cliquer sur `lancer-demo.bat` (Python requis), puis ouvrir http://localhost:8000
- **Option 2** : dans VS Code, clic droit sur `index.html` → *Open with Live Server*
- **Option 3** : dans un terminal, `cd demo` puis `py -m http.server 8000`

Pour le thème « mobile » : F12 → Ctrl+Shift+M → choisir un smartphone.
Pour simuler un téléphone lent : onglet *Performance* → ⚙️ → *CPU: 4x slowdown*.
Le bouton ◐ en haut à droite bascule entre thème clair et sombre (le clair passe mieux au projecteur).

## L'interface

| Zone                      | Ce qu'elle montre                                                       |
|---------------------------|------------------------------------------------------------------------|
| En-tête                   | État du **main thread** (Libre / Bloqué) et du **worker** (En calcul…)  |
| 01 Fluidité de la page    | FPS en grand, balle animée, courbe des FPS, champ de saisie             |
| 02 Charge de calcul       | 2 M / 5 M / 10 M nombres testés                                         |
| 03 Avant / après          | Carte **A Sans Worker** (rouge) et carte **B Avec Worker** (vert) : badge d'état, résultat, durée, gel max, FPS min, verdict Figée / Fluide |
| 04 Messages échangés      | Les `postMessage` entre la page et le worker                          |

## Fichiers

| Fichier      | Rôle                                                         |
|--------------|--------------------------------------------------------------|
| `index.html` | Structure de la page                                         |
| `style.css`  | Mise en page (clair / sombre, mobile / ordinateur)           |
| `main.js`    | Main thread : moniteur, version SANS worker, version AVEC    |
| `worker.js`  | Le worker : reçoit la tâche, calcule, renvoie le résultat    |
| `calcul.js`  | Le calcul lourd (nombres premiers), utilisé par les deux     |

## Déroulé conseillé (environ 4 min)

1. **Page au repos** : 60 FPS, courbe plate, balle qui bouge, badge « Main thread : Libre ».
   « Tout ça est géré par le main thread. »
2. **Carte A : cliquer sur « Lancer le calcul »** puis essayer d'écrire dans le champ.
   → Badge « Bloqué », balle et chrono figés, la barre ne bouge pas, le texte n'apparaît pas.
   Après coup : la courbe tombe à 0 FPS et la carte A affiche « Figée ».
3. **Carte B : cliquer sur « Lancer le calcul »** puis écrire dans le champ.
   → Badge « Worker : En calcul », 60 FPS, la barre avance, le texte s'affiche,
   le journal montre les messages du worker. La carte B affiche « Fluide ».
4. **Comparer les deux cartes** : même calcul, même durée,
   mais le gel de l'UI passe de plusieurs secondes à environ 20 ms.
5. **Relancer la carte B puis cliquer sur « Arrêter terminate() »** : montrer `terminate()`.
6. **Montrer le code** : `worker.js`, puis les parties 3 et 4 de `main.js`
   (`new Worker()` → `postMessage()` → `onmessage` → `terminate()`).

## Points à souligner

- La **barre de progression** est une bonne preuve : sans worker, le code la met à jour,
  mais l'écran ne se redessine qu'à la fin (elle saute de 0 à 100 %).
- Le worker n'accède jamais au DOM : il envoie `{ type: "progression" }` et c'est
  `main.js` qui modifie la barre.
- Un seul worker est créé puis **réutilisé** (bonne pratique). `onerror` gère les erreurs.
- La durée du calcul est presque la même dans les deux cas : le worker ne rend pas le
  calcul plus rapide, il **libère l'interface** pendant le calcul.
- L'animation est faite en JavaScript (`requestAnimationFrame`) : une animation CSS
  pourrait continuer à tourner même avec le main thread bloqué.
