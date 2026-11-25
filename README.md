# BelleaV — Plateforme de vente de vêtements modestes

Plateforme complète pour vendre des **hijabs, abayas, khimars, robes et ensembles pour femmes**, avec un **petit espace Fillettes** (2–12 ans).

| Dossier | Rôle |
|---|---|
| `boutique/` | Site client, installable comme application (PWA « BelleaV ») |
| `admin/` | Panneau de gestion de la base Firebase (site séparé) |
| `firestore.rules`, `storage.rules` | Règles de sécurité Firebase |
| `firebase.json`, `.firebaserc` | Hébergement des 2 sites sur Firebase Hosting |

Aucune étape de compilation : HTML, CSS et JavaScript purs (modules ES). Le SDK Firebase est chargé depuis le CDN de Google.

---

## 1. Essayer tout de suite (mode démo, sans Firebase)

```bash
cd belleav
python3 -m http.server 8080
```

- Boutique : http://localhost:8080/boutique/
- Admin : http://localhost:8080/admin/ — identifiants démo : `admin@belleav.dz` / `admin123`

En mode démo, tout est stocké dans le navigateur. Les deux sites partagent les mêmes données (même origine) : une commande passée sur la boutique **apparaît en temps réel** dans l'admin, et un produit publié depuis l'admin apparaît sur la boutique.

---

## 2. Architecture : comment le client ne provoque aucune lecture

```
 ADMIN (connecté)                          FIREBASE                          BOUTIQUE (cliente)
 ───────────────                           ────────                          ──────────────────
 Produits, catégories,  ── écrit ──►  Firestore (products, categories,
 promos, paramètres                   promos, settings)
        │
        └── « Publier » ── génère ──►  Storage : catalog/catalog.js  ◄── lu via <script> ── Catalogue, recherche,
                                       (+ catalog.json)                  (fichier statique,     filtres, tri, fiches
                                                                          0 lecture Firestore)  produit, panier
 Commandes (temps réel) ◄── lit ───   Firestore : orders  ◄──────── crée uniquement ─────── Validation de la commande
 Messages               ◄── lit ───   Firestore : messages ◄─────── crée uniquement ─────── Formulaire de contact
```

- **Le catalogue** est un fichier statique publié par l'admin. La boutique le télécharge comme n'importe quelle image : **aucune lecture Firestore**, quel que soit le nombre de visiteuses. Il est mis en cache dans le navigateur (affichage instantané), puis rafraîchi en arrière-plan.
- **Publication automatique** (activée par défaut) : chaque modification (produit, stock, prix, catégorie, promo, paramètres) est mise en ligne environ 3 secondes après. Un bouton « Publier » et un indicateur d'état restent disponibles.
- **Les clientes n'écrivent que** des commandes et des messages (création seule, contenu validé par les règles).
- **Suivi de commande** : seule exception, une lecture ponctuelle d'**un seul** document, déclenchée par la cliente avec son numéro (non devinable) et son téléphone.
- **Codes promo** publiés sous forme chiffrée (SHA-256) : ils ne sont pas lisibles dans le code de la boutique.

---

## 3. Brancher Firebase (quand vous êtes prêt)

1. **Créer le projet** sur https://console.firebase.google.com → *Ajouter un projet*.
2. **Passer au forfait Blaze** (paiement à l'usage, avec un quota gratuit généreux). Il est obligatoire depuis 2024 pour utiliser Cloud Storage (photos + catalogue). Pour une petite boutique, le coût reste en général nul ou quasi nul.
3. **Activer les services** :
   - *Authentication* → Méthode de connexion → **E-mail/Mot de passe**, puis *Utilisateurs* → *Ajouter un utilisateur* (votre compte admin).
   - *Firestore Database* → Créer (région `europe-west`, mode production).
   - *Storage* → Commencer.
4. **Déclarer l'administratrice** : Firestore → *Commencer une collection* `admins` → ID du document = **UID** de l'utilisateur (visible dans Authentication), avec un champ libre, par ex. `email`. Astuce : si vous vous connectez à l'admin avant cette étape, l'UID s'affiche à l'écran avec un bouton pour le copier.
5. **Coller la configuration Web** (Paramètres du projet → Vos applications → `</>` Web) dans les **deux** fichiers :
   - `boutique/js/config.js` → `export const firebaseConfig = { ... }`
   - `admin/js/config.js` → même objet
6. **Déployer les règles et les sites** (avec [Firebase CLI](https://firebase.google.com/docs/cli)) :

   Remplacez `VOTRE-ID-DE-PROJET` dans `.firebaserc`, puis lancez :

   ```bash
   npm install -g firebase-tools
   ```

   ```bash
   firebase login
   ```

   ```bash
   firebase hosting:sites:create VOTRE-ID-DE-PROJET-admin
   ```

   ```bash
   firebase deploy
   ```

   La boutique sera accessible sur `https://VOTRE-ID-DE-PROJET.web.app`, et l'admin sur `https://VOTRE-ID-DE-PROJET-admin.web.app`.
   Au premier déploiement de `storage.rules`, la CLI vous demande d'autoriser Storage à lire Firestore (nécessaire pour vérifier le statut admin) : acceptez.
7. **Premier remplissage** : dans l'admin, *Paramètres → Données & sauvegarde → Importer les exemples* (32 produits de démonstration), ou créez directement vos propres produits. Le catalogue est publié automatiquement.
8. Dans `admin/js/config.js`, renseignez `SHOP_URL` avec l'adresse de la boutique (pour les liens « Voir sur la boutique »).

> **Alternative sans Storage pour le catalogue** : *Paramètres → Données → Exporter catalog.json*, placez le fichier dans `boutique/data/`, mettez `catalogUrl: 'data/catalog.json'` dans `boutique/js/config.js`, puis lancez `firebase deploy --only hosting:boutique`. Les photos nécessitent toutefois Storage (ou des URL d'images externes).

---

## 4. Fonctionnalités

### Boutique cliente
- Accueil : bannière, univers (catégories), nouveautés, promotions, coups de cœur, **espace Fillettes**, meilleures ventes, vus récemment, arguments de réassurance
- **Recherche instantanée** tolérante aux fautes et aux accents (« abaia » → abaya), synonymes (voile → hijab), recherches récentes, suggestions
- **Filtres** : catégories, tailles disponibles, couleurs, prix (saisie + tranches), en stock, promotions, nouveautés ; filtres actifs sous forme de pastilles ; état conservé dans l'URL (partageable)
- **Tri** : pertinence, nouveautés, meilleures ventes, prix croissant/décroissant, plus fortes remises, A→Z ; chargement progressif
- **Fiche produit** : galerie (swipe mobile, miniatures, zoom), couleurs, tailles avec stock (épuisé barré, « plus que 2 »), quantité, guide des tailles, date de livraison estimée, partage WhatsApp/Facebook, produits similaires, barre d'achat fixe sur mobile
- Ajout rapide depuis les listes, **favoris**, panier latéral + page panier, barre « livraison offerte dès… », **codes promo**
- **Commande en une page** : 58 wilayas, livraison domicile / stop desk avec tarifs par wilaya, validation du téléphone algérien, mémorisation des coordonnées, **paiement à la livraison**
- Page de confirmation + bouton « Confirmer sur WhatsApp », **suivi de commande** avec frise chronologique, historique « Mes commandes » sur l'appareil
- Contact (formulaire → admin), pages Livraison, Retours, Guide des tailles, FAQ, À propos
- **Application installable** (PWA : icône, plein écran, raccourcis, fonctionnement hors-ligne de base), design responsive mobile d'abord, accessibilité clavier

### Panneau d'administration
- Connexion sécurisée (Firebase Auth + liste `admins`), réinitialisation du mot de passe
- **Tableau de bord** : chiffre d'affaires, commandes, panier moyen, taux de livraison (avec évolution), ventes par jour, statuts, meilleures ventes, top wilayas, alertes de stock faible, commandes à traiter
- **Commandes en temps réel** (son et notification à chaque nouvelle commande) : onglets par statut, recherche, filtres wilaya/dates, tri, pagination, actions groupées
  - Fiche commande : étapes (Nouvelle → Confirmée → En préparation → Expédiée → Livrée / Annulée / Retournée), boutons d'appel et messages WhatsApp pré-remplis (confirmation, expédition), historique des clientes (alerte si annulations répétées), alerte si le prix diffère du catalogue, transporteur, n° de suivi, frais modifiables, note interne
  - **Stock automatique** : déduit à la confirmation, restitué en cas d'annulation ou de retour
  - Commande manuelle (téléphone, Instagram…), **impression des bons de commande**, export CSV (Excel)
- **Produits** : recherche, filtres (rupture, stock faible, promo, sans photo…), tri, pagination, activation en un clic, duplication, actions groupées (mettre en ligne, masquer, changer de catégorie, remise %, supprimer)
  - Éditeur : photos multiples (glisser-déposer, réordonner, photo principale, compression WebP automatique), couleurs (nuancier + couleurs personnalisées), tailles prédéfinies (S→XXL, 52→60, fillettes…) avec stock par taille, prix barré avec calcul de la remise, aperçu en direct, raccourci Ctrl+S
- **Catégories** (espaces Femme / Fillettes, ordre du menu, image, visibilité), **clientes** (segments Fidèle / Régulière / Nouvelle / À risque, historique, export), **codes promo** (%, montant fixe, minimum d'achat, expiration, statistiques d'utilisation), **messages** (boîte de réception, réponse via WhatsApp)
- **Paramètres** : infos de la boutique, réseaux sociaux, bandeau d'annonce, bannière d'accueil, **tarifs de livraison des 58 wilayas** (domicile / bureau / désactivation), seuil de livraison offerte, textes des pages, sauvegarde/restauration JSON, export du catalogue, import des données d'exemple, préférences (publication automatique, son)
- Recherche globale (touche `/`), responsive (gestion possible depuis un téléphone)

---

## 5. Obtenir un vrai fichier APK (Android)

La boutique est déjà une PWA installable (bouton « Installer l'application » dans le menu, ou « Ajouter à l'écran d'accueil »). Pour publier un **APK / AAB sur le Play Store** une fois le site en ligne :

- **Le plus simple** : https://www.pwabuilder.com → saisissez l'adresse de la boutique → *Package for stores* → Android. Vous obtenez un APK signé (Trusted Web Activity) nommé « BelleaV ».
- Alternative : Capacitor (`@capacitor/android`), si vous voulez des fonctions natives (notifications push…).

---

## 6. Personnalisation rapide
- Couleurs et polices de la boutique : variables en haut de `boutique/css/style.css`
- Logo / icône : `boutique/icons/icon.svg` (+ PNG 192/512)
- Tarifs de livraison par défaut : `boutique/js/wilayas.js` (modifiables ensuite dans l'admin)
- Tant qu'un produit n'a pas de photo, un visuel élégant est généré automatiquement selon sa catégorie et sa couleur
