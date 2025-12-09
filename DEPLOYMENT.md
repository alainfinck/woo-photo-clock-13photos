# Guide de déploiement en production

## Installation sur un serveur de production

### Méthode 1 : Clone Git (recommandé)

```bash
# Se placer dans le dossier des plugins WordPress
cd /chemin/vers/wp-content/plugins/

# Cloner le dépôt
git clone https://github.com/alainfinck/woo-photo-clock-13photos.git woocommerce-photo-clock-13photos

# Se placer dans le dossier du plugin
cd woocommerce-photo-clock-13photos

# Vérifier que tout est bien là
ls -la
```

### Méthode 2 : Clone avec authentification (si le dépôt est privé)

```bash
# Avec token GitHub
git clone https://ghp_VOTRE_TOKEN@github.com/alainfinck/woo-photo-clock-13photos.git woocommerce-photo-clock-13photos

# Ou avec SSH (si configuré)
git clone git@github.com:alainfinck/woo-photo-clock-13photos.git woocommerce-photo-clock-13photos
```

### Méthode 3 : Téléchargement ZIP

```bash
# Télécharger depuis GitHub
wget https://github.com/alainfinck/woo-photo-clock-13photos/archive/refs/heads/main.zip

# Extraire
unzip main.zip

# Renommer
mv woo-photo-clock-13photos-main woocommerce-photo-clock-13photos

# Nettoyer
rm main.zip
```

## Mise à jour du plugin

### Via Git (si déjà cloné)

```bash
# Se placer dans le dossier du plugin
cd /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos

# Récupérer les dernières modifications
git pull origin main
```

### Via téléchargement

```bash
# Supprimer l'ancienne version (sauvegarder d'abord les données si nécessaire)
rm -rf /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos

# Re-cloner ou re-télécharger (voir méthodes ci-dessus)
```

## Vérifications post-installation

```bash
# Vérifier les permissions
chmod -R 755 /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos

# Vérifier que le fichier principal existe
ls -la woocommerce-photo-clock-13photos.php

# Vérifier la structure
tree -L 2 woocommerce-photo-clock-13photos
```

## Activation du plugin

1. Connectez-vous à l'administration WordPress
2. Allez dans **Extensions** > **Extensions installées**
3. Trouvez "WooCommerce Photo Clock 13 Photos"
4. Cliquez sur **Activer**

## Configuration des permissions (si nécessaire)

```bash
# Propriétaire et groupe (ajustez selon votre configuration)
chown -R www-data:www-data /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos

# Permissions pour les fichiers
find /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos -type f -exec chmod 644 {} \;

# Permissions pour les dossiers
find /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos -type d -exec chmod 755 {} \;
```

## Script de déploiement automatique

Créez un fichier `deploy.sh` :

```bash
#!/bin/bash

# Configuration
PLUGIN_DIR="/chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos"
REPO_URL="https://github.com/alainfinck/woo-photo-clock-13photos.git"

# Aller dans le dossier
cd "$PLUGIN_DIR" || exit

# Sauvegarder les modifications locales (si nécessaire)
git stash

# Récupérer les dernières modifications
git pull origin main

# Appliquer les modifications locales (si nécessaire)
git stash pop

# Vérifier les permissions
chmod -R 755 "$PLUGIN_DIR"

echo "Déploiement terminé !"
```

Rendez-le exécutable :
```bash
chmod +x deploy.sh
```

## Dépannage

### Erreur : "fatal: not a git repository"

```bash
# Si le dossier existe mais n'est pas un dépôt Git
cd /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos
git init
git remote add origin https://github.com/alainfinck/woo-photo-clock-13photos.git
git fetch
git checkout -b main origin/main
```

### Erreur de permissions

```bash
# Vérifier le propriétaire
ls -la /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos

# Corriger si nécessaire
chown -R www-data:www-data /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos
```

### Vérifier la version installée

```bash
cd /chemin/vers/wp-content/plugins/woocommerce-photo-clock-13photos
git log --oneline -5
git describe --tags 2>/dev/null || git rev-parse --short HEAD
```

