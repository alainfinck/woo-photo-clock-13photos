# WooCommerce Photo Clock 13 Photos

Plugin WordPress/WooCommerce permettant de créer des horloges personnalisées avec 12 photos périphériques (une pour chaque heure) et 1 photo centrale.

## 📋 Description

Ce plugin transforme vos produits WooCommerce en configurateurs d'horloges photo interactifs. Les clients peuvent personnaliser leur horloge en :
- Ajoutant 12 photos pour les heures (positions 1 à 12)
- Ajoutant 1 photo centrale
- Ajustant le zoom, la position et la taille de chaque photo
- Personnalisant le style des aiguilles, la couleur, et l'affichage des chiffres
- Prévisualisant leur création en temps réel

## ✨ Fonctionnalités

### Configuration de l'horloge
- **12 photos périphériques** : Une photo pour chaque position horaire (1h à 12h)
- **1 photo centrale** : Photo principale au centre de l'horloge
- **Réglages avancés** :
  - Zoom et positionnement (offset X/Y) pour chaque photo
  - Taille de la photo centrale (diamètre)
  - Taille des photos périphériques (ring_size)

### Personnalisation visuelle
- **Style d'aiguilles** : Classic, Moderne, etc.
- **Couleur des aiguilles** : Sélecteur de couleur personnalisé
- **Chiffres des heures** : Affichage optionnel avec personnalisation
  - Couleur des chiffres
  - Taille des chiffres
  - Distance depuis le centre

### Fonctionnalités avancées
- **Prévisualisation en temps réel** : Visualisation instantanée des modifications
- **Téléchargement JPEG** : Export de l'aperçu en JPEG
- **Export PDF HD** : Génération d'un PDF haute résolution pour la production
- **Intégration Unsplash** : Chargement de photos aléatoires depuis Unsplash
- **Images de démonstration** : Remplissage rapide avec des images de démo
- **Ajout au panier via AJAX** : Ajout sans rechargement de page avec notification
- **Gestion des commandes** : Affichage détaillé dans le backoffice avec vignettes

## 🚀 Installation

### Méthode 1 : Installation manuelle

1. Téléchargez le plugin depuis GitHub
2. Extrayez l'archive dans le dossier `/wp-content/plugins/`
3. Renommez le dossier en `woocommerce-photo-clock-13photos`
4. Activez le plugin depuis le menu **Extensions** de WordPress

### Méthode 2 : Via Git

```bash
cd wp-content/plugins
git clone https://github.com/alainfinck/woo-photo-clock-13photos.git woocommerce-photo-clock-13photos
```

## ⚙️ Configuration

### 1. Activer le configurateur sur un produit

1. Allez dans **Produits** > **Modifier un produit**
2. Dans l'onglet **Horloge Photo 13**, cochez **Activer le configurateur**
3. Configurez les options :
   - Taille minimale de la photo centrale
   - Taille maximale de la photo centrale
   - Taille par défaut des photos périphériques
   - Taille maximale d'upload

### 2. Utilisation côté client

1. Le client accède à la page produit
2. Le configurateur s'affiche avec :
   - L'horloge interactive au centre
   - Les 12 emplacements périphériques
   - Le panneau de configuration à droite
3. Le client peut :
   - Glisser-déposer des images ou cliquer pour sélectionner
   - Ajuster le zoom et la position avec les contrôles
   - Personnaliser les aiguilles et les chiffres
   - Prévisualiser en temps réel
   - Télécharger un aperçu JPEG
   - Générer un PDF HD
   - Ajouter au panier

## 🎨 Interface

### Configurateur frontend

- **Zone centrale** : Aperçu de l'horloge en temps réel
- **12 emplacements périphériques** : Clic ou glisser-déposer pour ajouter des photos
- **Panneau de configuration** :
  - Réglages globaux (style aiguilles, couleur, chiffres)
  - Éditeur de photo centrale
  - Éditeur de photos périphériques
  - Actions (démo, Unsplash, téléchargements)

### Backoffice

- **Détails de commande** : Affichage complet de la configuration
- **Vignettes** : Aperçu de toutes les photos utilisées
- **Modal de debug** : Accès aux données JSON brutes
- **Liens de téléchargement** : Accès aux fichiers JPEG et PDF

## 🔧 Développement

### Structure du plugin

```
woocommerce-photo-clock-13photos/
├── assets/
│   ├── css/
│   │   ├── admin.css
│   │   └── frontend.css
│   ├── js/
│   │   ├── admin.js
│   │   └── frontend-configurator.js
│   └── demo/
│       └── [images de démonstration]
├── includes/
│   ├── class-wc-pc13-admin.php
│   ├── class-wc-pc13-ajax.php
│   ├── class-wc-pc13-assets.php
│   ├── class-wc-pc13-cart.php
│   ├── class-wc-pc13-frontend.php
│   └── class-wc-pc13-product-settings.php
├── templates/
│   └── configurator.php
└── woocommerce-photo-clock-13photos.php
```

### Hooks disponibles

- `woocommerce_before_add_to_cart_button` : Affichage du configurateur
- `woocommerce_add_cart_item_data` : Ajout des données au panier
- `woocommerce_checkout_create_order_line_item` : Enregistrement dans la commande
- `woocommerce_before_order_itemmeta` : Affichage dans le backoffice

### Filtres

- `woocommerce_hidden_order_itemmeta` : Masque les métadonnées techniques
- `woocommerce_order_item_display_meta_key` : Contrôle l'affichage des clés

## 📦 Dépendances

- **WordPress** : 5.0+
- **WooCommerce** : 3.0+
- **PHP** : 7.4+
- **Bibliothèques JavaScript** :
  - HTML2Canvas (pour la génération d'images)
  - jsPDF (pour la génération de PDF)

## 🔐 Sécurité

- Toutes les entrées utilisateur sont sanitizées
- Vérification des nonces pour toutes les requêtes AJAX
- Validation des types de fichiers uploadés
- Échappement de toutes les sorties HTML

## 🌐 Internationalisation

Le plugin est prêt pour la traduction avec le domaine de texte `wc-photo-clock-13`.

## 📝 Licence

GPL v2 or later

## 👤 Auteur

**Alain Finck**

- GitHub: [@alainfinck](https://github.com/alainfinck)
- Repository: [woo-photo-clock-13photos](https://github.com/alainfinck/woo-photo-clock-13photos)

## 🐛 Support

Pour signaler un bug ou demander une fonctionnalité, veuillez créer une [issue](https://github.com/alainfinck/woo-photo-clock-13photos/issues) sur GitHub.

## 📄 Changelog

### 1.0.0
- Version initiale
- Configuration complète de l'horloge avec 13 photos
- Prévisualisation en temps réel
- Export JPEG et PDF HD
- Intégration Unsplash
- Gestion des commandes avec vignettes
- Interface admin complète

## 🎯 Roadmap

- [ ] Support de plusieurs styles d'horloges
- [ ] Templates prédéfinis
- [ ] Export SVG
- [ ] Intégration avec d'autres services d'images
- [ ] Mode sombre pour le configurateur
- [ ] Sauvegarde de configurations favorites

---

**Note** : Ce plugin nécessite WooCommerce pour fonctionner. Assurez-vous que WooCommerce est installé et activé avant d'utiliser ce plugin.




