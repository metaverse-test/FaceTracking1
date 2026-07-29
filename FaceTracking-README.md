# FaceTracking

Animation faciale 3D en temps réel dans le navigateur, avec **Three.js** pour
le rendu et **MediaPipe Face Landmarker** pour la capture des expressions du
visage via webcam.

Le projet charge un avatar `.glb`, détecte automatiquement tous ses morph
targets (blendshapes) et les anime en temps réel à partir des coefficients
ARKit calculés par MediaPipe — visage, rotation de tête et regard compris.
**Aucun nom de mesh ou de blendshape n'est codé en dur** : remplacer le
fichier `.glb` suffit à faire fonctionner le projet avec un autre avatar.

100 % statique, sans build ni serveur Node : ouvrez `index.html` via un
serveur local ou publiez le dossier tel quel sur GitHub Pages.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Architecture du projet](#architecture-du-projet)
- [Prise en main](#prise-en-main)
- [Remplacer LuciaHead.glb par un autre avatar](#remplacer-luciaheadglb-par-un-autre-avatar)
- [Comment fonctionne le mapping automatique](#comment-fonctionne-le-mapping-automatique)
- [Comment fonctionne MediaPipe Face Landmarker](#comment-fonctionne-mediapipe-face-landmarker)
- [Configuration](#configuration)
- [Publier sur GitHub Pages](#publier-sur-github-pages)
- [Compatibilité](#compatibilité)
- [Résoudre les erreurs courantes](#résoudre-les-erreurs-courantes)
- [Licence](#licence)

## Fonctionnalités

- Chargement automatique d'un modèle `.glb` (GLTFLoader + support Draco).
- Détection automatique de tous les meshes porteurs de morph targets.
- Mapping automatique des 52 catégories ARKit de MediaPipe vers les morph
  targets réellement présents sur l'avatar — par nom, sans configuration.
- Rotation de tête pilotée par la matrice de transformation faciale de
  MediaPipe (bone `Head` si présent, sinon objet racine du modèle).
- Regard animé sur les bones `LeftEye` / `RightEye`, s'ils existent.
- Lissage temps réel (interpolation exponentielle + slerp) indépendant du
  framerate, pour un mouvement fluide même à faible FPS.
- Interface sombre avec statut caméra/MediaPipe, compteur de FPS et nombre
  de blendshapes détectés.
- Aucun crash en cas de blendshape manquant, de modèle sans squelette ou
  d'échec d'initialisation : le projet se dégrade proprement et informe
  l'utilisateur.

## Architecture du projet

```
FaceTracking/
├── index.html              Page principale, import map, interface
├── style.css                Thème sombre de l'interface
├── script.js                 Point d'entrée : assemble tous les modules
├── README.md
├── LICENSE
├── assets/
│   ├── models/               Vos fichiers .glb (ex. LuciaHead.glb)
│   ├── textures/              Textures additionnelles éventuelles
│   └── hdr/                   Environnements .hdr optionnels
└── js/
    ├── scene.js               Création de la THREE.Scene
    ├── camera.js               Caméra perspective
    ├── renderer.js              WebGLRenderer (WebGL2, sRGB, tone mapping)
    ├── lights.js                 Éclairage studio + support HDRI
    ├── avatar.js                  Chargement GLB + détection automatique
    ├── mediapipe.js                 Intégration Face Landmarker + webcam
    ├── blendshapeMapper.js           Table blendshape → mesh/index
    ├── animation.js                   Lissage, rotation de tête, regard
    ├── controls.js                     OrbitControls (souris/tactile)
    └── utils.js                        Fonctions utilitaires partagées
```

Chaque module a une seule responsabilité et n'est construit/parcouru
qu'une fois (au chargement) — la boucle `requestAnimationFrame` ne fait
plus que lire des références déjà résolues, sans jamais re-traverser la
scène ni allouer de nouveaux objets.

## Prise en main

1. Placez un avatar `.glb` exportant des blendshapes ARKit dans
   `assets/models/LuciaHead.glb` (voir section suivante).
2. Servez le dossier via un serveur local (obligatoire : les navigateurs
   bloquent le chargement de fichiers `.glb` et l'accès caméra en `file://`).
   Par exemple :

   ```bash
   npx serve .
   # ou
   python3 -m http.server 8080
   ```

3. Ouvrez l'URL locale affichée, autorisez la caméra, cliquez sur
   **Activer la caméra**.

## Remplacer LuciaHead.glb par un autre avatar

Deux façons de faire, au choix :

- **Le plus simple** : renommez votre fichier en `LuciaHead.glb` et
  remplacez celui du dossier `assets/models/`.
- **Sans renommer** : ouvrez `script.js` et modifiez uniquement cette ligne
  au début du fichier (objet `CONFIG`) :

  ```js
  const CONFIG = {
    modelPath: 'assets/models/VotreAvatar.glb',
    // ...
  };
  ```

Aucune autre modification n'est nécessaire, quel que soit l'avatar : le
nom des meshes, le nombre de blendshapes disponibles et la présence ou non
d'un squelette n'ont aucune importance, tant que le fichier est un `.glb`
valide.

**Exigences côté modèle** (côté outil d'export — Blender, Ready Player Me,
Character Creator, VRoid, etc.) :

- Un ou plusieurs meshes avec des morph targets nommés selon la convention
  ARKit (`eyeBlinkLeft`, `jawOpen`, `mouthSmileLeft`, ...). Les noms non-ARKit
  sont acceptés aussi : ceux qui ne correspondent à aucune catégorie envoyée
  par MediaPipe sont simplement ignorés.
- (Optionnel) Un bone nommé `Head` (ou contenant "head") pour la rotation de
  tête. En son absence, c'est tout l'objet racine du modèle qui tourne à la
  place — pratique pour un buste sans squelette.
- (Optionnel) Des bones nommés `LeftEye` / `RightEye` (ou variantes comme
  `Eye_L`, `eyeLeft`...) pour l'animation du regard.

## Comment fonctionne le mapping automatique

Le mapping se déroule en trois étapes, dont la première seulement se
répète à chaque chargement de modèle (jamais dans la boucle d'animation) :

1. **Détection** (`js/avatar.js`) — après le chargement du GLB, le code
   parcourt une seule fois toute la hiérarchie de la scène
   (`Object3D.traverse`). Pour chaque mesh, il vérifie la présence de
   `mesh.morphTargetDictionary` : si l'objet en possède un, le mesh est
   ajouté à une liste `morphMeshes`. Pour chaque bone, le nom est comparé
   (insensible à la casse et aux séparateurs) à des mots-clés (`head`,
   `lefteye`, `righteye`) pour retrouver automatiquement les bones utiles.

2. **Indexation** (`js/blendshapeMapper.js`) — la liste `morphMeshes` est
   transformée en une `Map` du type :

   ```js
   Map {
     "eyeBlinkLeft" => [{ mesh: <Mesh Head>, index: 25 }],
     "jawOpen"      => [{ mesh: <Mesh Head>, index: 12 }, { mesh: <Mesh Teeth>, index: 3 }],
     // ...
   }
   ```

   Cette table est construite **une seule fois**, juste après le
   chargement, puis réutilisée telle quelle pendant toute la session.

3. **Application** (`js/animation.js`) — à chaque frame, pour chaque
   catégorie renvoyée par MediaPipe (`eyeBlinkLeft`, `jawOpen`, ...), le
   code cherche le même nom dans la `Map` ci-dessus :
   - trouvé → la valeur cible est mise à jour, puis lissée et écrite dans
     `mesh.morphTargetInfluences[index]` ;
   - absent → la catégorie est ignorée avec un avertissement affiché
     **une seule fois** dans la console (jamais de boucle qui spamme).

Le résultat : ajouter, retirer ou renommer des blendshapes côté modèle ne
nécessite aucune modification du code JavaScript.

## Comment fonctionne MediaPipe Face Landmarker

[MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
est un modèle de vision par ordinateur de Google qui tourne entièrement
dans le navigateur (WebAssembly + WebGL), sans envoyer la vidéo à un
serveur. `js/mediapipe.js` l'utilise ainsi :

1. **Initialisation** — `FilesetResolver` télécharge le runtime WASM, puis
   `FaceLandmarker.createFromOptions()` charge le modèle avec :
   - `outputFaceBlendshapes: true` → active les 52 coefficients ARKit ;
   - `outputFacialTransformationMatrixes: true` → active la matrice de
     pose de la tête ;
   - `delegate: "GPU"`, avec repli automatique sur `"CPU"` si le GPU
     échoue (compatibilité maximale, notamment sur Android).

2. **Détection vidéo** — à chaque frame, `detectForVideo(video, timestamp)`
   est appelé **seulement** si l'image vidéo a changé depuis le dernier
   appel (comparaison de `video.currentTime`), pour ne jamais analyser deux
   fois la même image.

3. **Résultats** — chaque détection renvoie :
   - `faceBlendshapes[0].categories` : 52 objets `{ categoryName, score }`,
     un score entre 0 et 1 par expression (voir mapping ci-dessus) ;
   - `facialTransformationMatrixes[0].data` : une matrice 4×4 dont la
     rotation est extraite (`THREE.Matrix4.decompose`) puis appliquée au
     bone de tête.

## Configuration

Toutes les valeurs ajustables se trouvent en un seul endroit, en haut de
`script.js` :

| Option                | Rôle                                                              | Défaut |
| ---------------------- | ------------------------------------------------------------------ | ------ |
| `modelPath`             | Chemin vers le fichier `.glb` à charger                            | `assets/models/LuciaHead.glb` |
| `hdrPath`                 | Environnement HDRI optionnel (reflets), `null` = éclairage studio | `null` |
| `mirrorHeadYaw`             | Inverse la rotation de tête si elle semble inversée               | `false` |
| `blendshapeSmoothing`         | Réactivité du lissage des expressions                          | `22` |
| `headSmoothing`                 | Réactivité du lissage de la rotation de tête                | `14` |
| `eyeSmoothing`                     | Réactivité du lissage du regard                          | `18` |
| `eyeMaxAngleDeg`                     | Amplitude maximale de rotation des yeux (degrés)       | `26` |

Augmenter une valeur de lissage rend le mouvement plus réactif mais plus
saccadé ; la diminuer le rend plus doux mais plus "en retard".

## Publier sur GitHub Pages

1. Créez un dépôt GitHub et poussez-y tout le contenu de ce dossier
   (en incluant votre `.glb` dans `assets/models/`) :

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
   git push -u origin main
   ```

2. Dans GitHub : **Settings → Pages → Build and deployment → Source**,
   choisissez **Deploy from a branch**, puis la branche `main` et le
   dossier `/ (root)`.
3. Après quelques minutes, le site est disponible à l'adresse
   `https://<votre-compte>.github.io/<votre-repo>/`.

Aucune étape de build n'est nécessaire : le projet utilise un *import map*
et charge Three.js / MediaPipe directement depuis un CDN (jsDelivr), ce qui
fonctionne nativement sur GitHub Pages.

> **Note HTTPS** — GitHub Pages sert le site en HTTPS par défaut, ce qui
> est requis par les navigateurs pour autoriser l'accès à la caméra.

## Compatibilité

Testé conceptuellement sur les navigateurs et plateformes suivants (tous
supportent nativement les import maps, WebGL2 et MediaPipe Tasks Vision) :

- Chrome / Edge (desktop et Android)
- Firefox (desktop et Android)
- Android : les performances dépendent du GPU du téléphone ; le repli
  automatique sur le délégué CPU de MediaPipe garantit un fonctionnement
  même sur les appareils les plus anciens (au prix du framerate).

## Résoudre les erreurs courantes

| Symptôme                                            | Cause probable                                                                 | Solution |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Bandeau rouge "Modèle introuvable"                     | `assets/models/LuciaHead.glb` absent, ou `CONFIG.modelPath` incorrect            | Ajoutez le fichier au bon endroit ou corrigez le chemin |
| Page blanche / erreurs CORS ou "fetch" en console        | Le site est ouvert directement en `file://` au lieu d'être servi par un serveur | Servez le dossier via `npx serve .` ou équivalent |
| "MediaPipe n'a pas pu s'initialiser"                        | Pas de connexion réseau (le WASM et le modèle viennent d'un CDN), ou navigateur trop ancien | Vérifiez la connexion ; testez sur Chrome/Edge/Firefox à jour |
| Bouton "Activer la caméra" reste grisé                        | MediaPipe est toujours en cours d'initialisation, ou a échoué                | Attendez le statut "Prêt", ou consultez le bandeau d'erreur |
| "Caméra refusée"                                                  | Permission caméra refusée par le navigateur/l'OS                          | Autorisez la caméra dans les réglages du site |
| Le visage ne bouge pas du tout                                       | L'avatar n'a aucun morph target (compteur "Blendshapes" à 0)         | Vérifiez l'export du modèle (voir section précédente) |
| Certains avertissements "Blendshape absent" en console                  | Normal : le modèle n'a pas cette expression précise                | Sans danger, n'affecte pas les autres blendshapes |
| La tête tourne dans le mauvais sens par rapport à vos mouvements           | Convention d'axes différente selon l'avatar                     | Passez `mirrorHeadYaw` à `true` dans `script.js` |
| Le visage disparaît quand la caméra 3D s'approche ou que la tête tourne       | Culling de la bounding box (déjà corrigé dans ce projet)      | Vérifiez que vous utilisez bien `js/avatar.js` fourni (`frustumCulled = false`) |

## Licence

Code sous licence [MIT](./LICENSE). Les modèles 3D, textures et
environnements HDRI que vous ajoutez dans `assets/` restent soumis à leur
propre licence.
