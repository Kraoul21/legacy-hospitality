/* ==========================================================================
   Shelter&Co — assistant de conciergerie : 100 questions-réponses
   Hôtel : 24 rue Charlot, 75003 Paris (Haut-Marais).

   Chaque sujet :
     id    identifiant unique (utilisé par « next »)
     cat   thème (voir CATEGORIES)
     q     question type (affichée en suggestion)
     keys  mots-clés reconnus (sans accents) ; « ~ » devant = mot-clé faible (compte pour moitié)
     a(r)  réponse ; r = infos de la réservation (ou null)
     next  3 sujets proposés ensuite

   Les informations propres à l'hôtel (horaires, services, tarifs) sont des
   données de démonstration à faire valider par l'hôtel.
   ========================================================================== */

window.CONCIERGE = (function () {
  const NB = ' '; // espace insécable (« 24 h/24 » reste sur une ligne)

  const CATEGORIES = {
    sejour: 'Votre séjour',
    services: 'Services de l’hôtel',
    chambre: 'Dans votre chambre',
    fidelite: 'Programme de fidélité',
    transports: 'Venir et se déplacer',
    marais: 'Le Haut-Marais',
    paris: 'Découvrir Paris',
    pratique: 'Infos pratiques',
  };

  const topics = [
    // ---------------------------------------------------------------- séjour
    {
      id: 'petit-dej', cat: 'sejour',
      q: 'Horaires du petit-déjeuner',
      keys: ['petit dej', 'petit-dej', 'petit dejeuner', 'breakfast', '~matin'],
      a: (r) => 'Le petit-déjeuner est servi au rez-de-chaussée de 7:00 à 10:30 en semaine, et de 7:30 à 11:00 le week-end.' +
        (r ? `\nEn tant que membre ${r.tier}, il vous est offert chaque matin.` : ''),
      next: ['check-out', 'brunch', 'cafe-quartier'],
    },
    {
      id: 'check-out', cat: 'sejour',
      q: 'À quelle heure dois-je libérer la chambre ?',
      keys: ['check out', 'checkout', 'depart', '~partir', 'liberer', 'quitter', 'rendre la chambre', 'late'],
      a: (r) => r
        ? `Votre départ est prévu le ${r.departure}, avant ${r.checkout} : vous profitez du late check-out, un avantage de votre statut ${r.tier}.\nL’heure de départ standard est 11:00.`
        : 'Le check-out se fait avant 11:00. Les membres Silver et Gold profitent d’un late check-out jusqu’à 14:00.',
      next: ['bagages', 'prolonger', 'cdg'],
    },
    {
      id: 'check-in', cat: 'sejour',
      q: 'À partir de quelle heure puis-je arriver ?',
      keys: ['check in', 'checkin', 'puis je arriver', 'arriver', 'arrivee', 'heure d arrivee', 'recuperer la chambre'],
      a: (r) => (r ? `Votre chambre ${r.room} vous attend le ${r.arrival}, à partir de 15:00.` : 'Le check-in se fait à partir de 15:00.') +
        '\nSi vous arrivez plus tôt, la bagagerie est gratuite : déposez vos valises et partez découvrir le Marais.',
      next: ['arrivee-tot', 'acces', 'quartier'],
    },
    {
      id: 'arrivee-tot', cat: 'sejour',
      q: 'Puis-je arriver plus tôt ?',
      keys: ['arriver plus tot', 'plus tot', 'early check in', 'en avance', 'arrivee anticipee'],
      a: () => 'Nous faisons notre possible pour préparer votre chambre plus tôt, selon les disponibilités du jour : prévenez la réception de votre heure d’arrivée via la page Bienvenue de votre espace.\nEn attendant, la bagagerie est gratuite.',
      next: ['bagages', 'check-in', 'quartier'],
    },
    {
      id: 'bagages', cat: 'sejour',
      q: 'Puis-je laisser mes bagages ?',
      keys: ['bagage', 'valise', 'consigne', 'bagagerie', '~sac'],
      a: () => 'Bien sûr : la bagagerie est gratuite avant votre check-in et après votre check-out. Adressez-vous simplement à la réception.',
      next: ['check-out', 'shopping', 'quartier'],
    },
    {
      id: 'chambre', cat: 'sejour',
      q: 'Comment est ma chambre ?',
      keys: ['ma chambre', 'suite', 'taille de la chambre', 'superficie', 'm2', 'lit king', 'type de chambre'],
      a: (r) => r
        ? `Vous séjournez en chambre ${r.room} : 38 m² au dernier étage, un lit king size, une salle d’eau avec douche à l’italienne, un dressing et une vue sur les toits de Paris jusqu’à la tour Eiffel.`
        : 'Nos chambres des derniers étages offrent une vue sur les toits de Paris, une salle d’eau avec douche à l’italienne et un dressing.',
      next: ['vue', 'surclassement', 'salle-bain'],
    },
    {
      id: 'vue', cat: 'sejour',
      q: 'Peut-on voir la tour Eiffel ?',
      keys: ['tour eiffel', 'eiffel', 'vue', 'panorama', 'fenetre'],
      a: (r) => (r
        ? `Oui ! Votre chambre ${r.room}, au dernier étage, offre une vue sur les toits du Marais jusqu’à la tour Eiffel.`
        : 'Oui : les chambres des derniers étages offrent une vue sur les toits du Marais jusqu’à la tour Eiffel.') +
        '\nElle scintille 5 minutes toutes les heures, à la tombée de la nuit.',
      next: ['eiffel-visite', 'rooftop', 'quartier'],
    },
    {
      id: 'surclassement', cat: 'sejour',
      q: 'Puis-je être surclassé ?',
      keys: ['surclassement', 'surclasse', 'upgrade', 'chambre superieure', 'plus grande chambre'],
      a: (r) => (r ? `En tant que membre ${r.tier}, ` : '') + 'vous pouvez demander un surclassement, accordé selon les disponibilités le jour de votre arrivée. Signalez-le à la réception ou via la page Bienvenue.',
      next: ['avantages', 'chambre', 'gold'],
    },
    {
      id: 'modifier', cat: 'sejour',
      q: 'Comment modifier ma réservation ?',
      keys: ['annuler', 'annulation', 'modifier', 'changer mes dates', 'changer la date', 'decaler'],
      a: () => 'Pour modifier vos dates ou annuler votre réservation, contactez la réception : elle vous indiquera les conditions de votre tarif.\nVous pouvez aussi lui écrire depuis la page Bienvenue de votre espace.',
      next: ['prolonger', 'reception', 'facture'],
    },
    {
      id: 'prolonger', cat: 'sejour',
      q: 'Puis-je prolonger mon séjour ?',
      keys: ['prolonger', 'nuit de plus', 'nuit supplementaire', 'une nuit en plus', 'rester une nuit'],
      a: () => 'Avec plaisir, selon les disponibilités : demandez-le à la réception, qui vous confirmera le tarif. Vos avantages de membre s’appliquent aussi aux nuits ajoutées.',
      next: ['modifier', 'check-out', 'paiement'],
    },
    {
      id: 'facture', cat: 'sejour',
      q: 'Comment obtenir ma facture ?',
      keys: ['facture', 'recu', 'justificatif', 'note d hotel'],
      a: () => 'Votre facture vous est remise à votre départ. Elle peut aussi vous être envoyée par e-mail, sur simple demande à la réception.',
      next: ['paiement', 'check-out', 'caution'],
    },
    {
      id: 'paiement', cat: 'sejour',
      q: 'Quels moyens de paiement acceptez-vous ?',
      keys: ['moyen de paiement', 'moyens de paiement', 'payer par', 'carte bancaire', 'american express', 'amex', 'apple pay', 'paiement', 'payer'],
      a: () => 'Nous acceptons les cartes Visa, Mastercard et American Express, le paiement sans contact (Apple Pay, Google Pay) et les espèces.\nVos Legacy Points servent aussi à régler les activités de l’hôtel.',
      next: ['caution', 'facture', 'legacy-points'],
    },
    {
      id: 'caution', cat: 'sejour',
      q: 'Faut-il laisser une caution ?',
      keys: ['caution', 'depot de garantie', 'empreinte bancaire', 'preautorisation', 'garantie'],
      a: () => 'Une empreinte bancaire est demandée à l’arrivée pour couvrir les éventuels extras (minibar, room service). Elle est libérée à votre départ.',
      next: ['paiement', 'minibar', 'facture'],
    },

    // -------------------------------------------------------------- services
    {
      id: 'wifi', cat: 'services',
      q: 'Comment me connecter au Wi-Fi ?',
      keys: ['wifi', 'wi fi', 'internet', 'connexion', 'reseau', 'mot de passe'],
      a: (r) => 'Connectez-vous au réseau « Shelter&Co », sans mot de passe : il est gratuit dans tout l’hôtel.' +
        (r ? `\nVotre statut ${r.tier} inclut le Wi-Fi premium très haut débit.` : ''),
      next: ['travail', 'imprimer', 'adaptateur'],
    },
    {
      id: 'spa', cat: 'services',
      q: 'Quels sont les horaires du spa ?',
      keys: ['spa', 'sauna', 'hammam', 'detente', 'bien etre'],
      a: (r) => 'Le spa (sauna et hammam) est ouvert de 9:00 à 21:00, sur réservation auprès de la réception.' +
        (r ? '\nPensez à votre bon cadeau Spa −20 %, valable jusqu’au 31 décembre 2026.' : ''),
      next: ['massage', 'yoga', 'activites-lp'],
    },
    {
      id: 'massage', cat: 'services',
      q: 'Puis-je réserver un massage ?',
      keys: ['massage', 'masser', 'soin', 'soin du corps', 'modelage', 'esthetique'],
      a: () => 'Oui : le massage signature de 60 minutes se réserve depuis Mon profil › Mon portefeuille (900 Legacy Points) ou auprès de la réception. D’autres soins sont proposés à la carte du spa.',
      next: ['spa', 'activites-lp', 'legacy-points'],
    },
    {
      id: 'sport', cat: 'services',
      q: 'Y a-t-il une salle de sport ?',
      keys: ['sport', 'fitness', 'gym', 'salle de sport', 'musculation', 'courir', 'running', 'jogging', 'coaching'],
      a: () => `Oui, la salle de sport est ouverte 24${NB}h/24, avec votre carte de chambre. Un coaching privé de 45 minutes est aussi proposé (450 Legacy Points).\nPour courir, les quais de Seine et l’île Saint-Louis sont à 15 minutes.`,
      next: ['yoga', 'seine', 'spa'],
    },
    {
      id: 'yoga', cat: 'services',
      q: 'Proposez-vous des cours de yoga ?',
      keys: ['yoga', 'pilates', 'meditation', 'stretching'],
      a: () => 'Un cours de yoga est proposé le samedi et le dimanche à 9:00 dans la salle de sport, sur inscription auprès de la réception. Des tapis sont aussi disponibles pour pratiquer en chambre.',
      next: ['sport', 'spa', 'massage'],
    },
    {
      id: 'room-service', cat: 'services',
      q: 'Le room service est-il disponible ?',
      keys: ['room service', 'commander', 'manger dans la chambre', 'repas en chambre', 'faim', 'plateau'],
      a: () => 'Le room service est disponible de 7:00 à 23:00. Commandez directement depuis le téléphone de votre chambre.\nLe petit-déjeuner peut aussi être servi en chambre (150 Legacy Points).',
      next: ['restaurant-hotel', 'minibar', 'petit-dej'],
    },
    {
      id: 'restaurant-hotel', cat: 'services',
      q: 'L’hôtel a-t-il un restaurant ?',
      keys: ['restaurant de l hotel', 'hotel a t il un restaurant', 'resto de l hotel', 'resto a l hotel', 'restaurant dans l hotel', 'restaurant a l hotel', 'diner a l hotel', 'manger a l hotel', 'menu'],
      a: (r) => 'Le restaurant de l’hôtel vous accueille pour le dîner de 19:00 à 22:30, avec une cuisine de saison et des produits du marché des Enfants-Rouges.' +
        (r ? '\nVotre bon « Dîner pour deux » y est valable jusqu’au 15 octobre : pensez à réserver auprès de la réception.' : ''),
      next: ['bar-hotel', 'restaurant-quartier', 'room-service'],
    },
    {
      id: 'bar-hotel', cat: 'services',
      q: 'Y a-t-il un bar dans l’hôtel ?',
      keys: ['bar de l hotel', 'bar dans l hotel', 'bar a l hotel', 'lobby bar', 'verre a l hotel'],
      a: () => 'Le bar du rez-de-chaussée est ouvert à tous de 17:00 à minuit : cocktails signature, vins nature et planches à partager.\nLe rooftop du dernier étage est réservé aux membres Gold.',
      next: ['rooftop', 'bar-quartier', 'restaurant-hotel'],
    },
    {
      id: 'rooftop', cat: 'services',
      q: 'Peut-on accéder au rooftop ?',
      keys: ['rooftop', 'toit', 'terrasse', 'dernier etage'],
      a: (r) => 'Le rooftop du dernier étage, avec vue sur les toits de Paris, est ouvert de 18:00 à 1:00 et réservé aux membres Gold.' +
        (r ? `\nPlus que ${r.toGold} points pour y accéder !` : ''),
      next: ['gold', 'bar-hotel', 'vue'],
    },
    {
      id: 'pressing', cat: 'services',
      q: 'Y a-t-il un service de pressing ?',
      keys: ['pressing', 'blanchisserie', 'laver', 'linge', 'lessive', 'laverie', 'nettoyer mes vetements'],
      a: () => 'Oui : déposez votre linge à la réception avant 10:00, il vous est rendu le soir même.',
      next: ['fer', 'menage', 'oreillers'],
    },
    {
      id: 'fer', cat: 'services',
      q: 'Puis-je avoir un fer à repasser ?',
      keys: ['repasser', '~fer', 'fer a repasser', 'planche', 'repassage', 'froisse'],
      a: () => 'Un fer et une planche à repasser vous sont apportés en chambre sur simple demande à la réception.',
      next: ['pressing', 'menage', 'oreillers'],
    },
    {
      id: 'menage', cat: 'services',
      q: 'À quelle heure est fait le ménage ?',
      keys: ['menage', 'nettoyage', 'femme de chambre', '~draps', 'ne pas deranger', 'faire la chambre'],
      a: () => 'Le ménage est fait chaque jour entre 10:00 et 15:00.\nAccrochez le panneau « Ne pas déranger » si vous préférez être tranquille, ou demandez un passage à une autre heure à la réception.',
      next: ['oreillers', 'pressing', 'check-out'],
    },
    {
      id: 'reveil', cat: 'services',
      q: 'Peut-on me réveiller le matin ?',
      keys: ['reveil', 'reveiller', 'wake up', 'alarme'],
      a: () => 'Avec plaisir : composez le 9 depuis le téléphone de la chambre et indiquez à la réception l’heure souhaitée.',
      next: ['petit-dej', 'taxi', 'check-out'],
    },
    {
      id: 'parapluie', cat: 'services',
      q: 'Puis-je emprunter un parapluie ?',
      keys: ['parapluie', 'emprunter un parapluie', 'impermeable'],
      a: () => 'Des parapluies Shelter&Co sont à votre disposition à la réception : servez-vous et rapportez-les à votre retour.',
      next: ['pluie', 'musee', 'promenade'],
    },
    {
      id: 'imprimer', cat: 'services',
      q: 'Puis-je imprimer un document ?',
      keys: ['imprimer', 'impression', 'imprimante', 'carte d embarquement', 'scanner'],
      a: () => 'Bien sûr : envoyez votre document à la réception, qui l’imprime gratuitement (carte d’embarquement, billets…).',
      next: ['travail', 'wifi', 'cdg'],
    },
    {
      id: 'travail', cat: 'services',
      q: 'Y a-t-il un espace pour travailler ?',
      keys: ['travailler', 'espace de travail', 'coworking', 'bureau', 'salle de reunion', 'reunion', 'visio'],
      a: () => 'Le salon du rez-de-chaussée offre de grandes tables, des prises et un Wi-Fi rapide. Une petite salle de réunion (6 personnes) se réserve à la réception.',
      next: ['wifi', 'imprimer', 'cafe-quartier'],
    },
    {
      id: 'reception', cat: 'services',
      q: 'Comment joindre la réception ?',
      keys: ['reception', 'joindre', 'appeler', 'contacter', 'numero', 'telephone', 'parler a quelqu un'],
      a: () => `La réception est ouverte 24${NB}h/24 : composez le 9 depuis le téléphone de votre chambre, ou passez nous voir au rez-de-chaussée.`,
      next: ['langue', 'bruit', 'objets-trouves'],
    },

    // ------------------------------------------------------------- chambre
    {
      id: 'coffre', cat: 'chambre',
      q: 'Y a-t-il un coffre-fort ?',
      keys: ['coffre', 'coffre fort', 'objets de valeur', 'passeport'],
      a: () => 'Chaque chambre dispose d’un coffre-fort, dans le dressing. Choisissez un code à 4 chiffres et validez avec la touche « Lock ».',
      next: ['clim', 'menage', 'securite'],
    },
    {
      id: 'clim', cat: 'chambre',
      q: 'Comment régler la climatisation ?',
      keys: ['clim', 'climatisation', 'chauffage', 'temperature de la chambre', 'thermostat', 'froid', 'chaud'],
      a: () => 'La climatisation et le chauffage se règlent avec le thermostat situé près de l’entrée de la chambre.\nSi la température ne vous convient pas, la réception vous envoie un technicien.',
      next: ['oreillers', 'bruit', 'coffre'],
    },
    {
      id: 'oreillers', cat: 'chambre',
      q: 'Puis-je avoir des oreillers en plus ?',
      keys: ['oreiller', 'serviette', 'couverture', 'couette', 'supplementaire', 'peignoir', 'chaussons'],
      a: () => 'Bien sûr : demandez-les à la réception, ou via la page Bienvenue de votre espace.\nUne carte des oreillers est aussi disponible : ferme, moelleux ou à mémoire de forme.',
      next: ['menage', 'enfants', 'clim'],
    },
    {
      id: 'minibar', cat: 'chambre',
      q: 'Que contient le minibar ?',
      keys: ['minibar', 'mini bar', 'frigo', 'refrigerateur', 'boissons en chambre'],
      a: () => 'Le minibar propose eaux, softs, bières artisanales parisiennes et quelques douceurs. Les eaux sont offertes ; le reste est ajouté à votre note.',
      next: ['cafe-chambre', 'room-service', 'caution'],
    },
    {
      id: 'cafe-chambre', cat: 'chambre',
      q: 'Y a-t-il une machine à café en chambre ?',
      keys: ['machine a cafe', 'nespresso', 'capsule', 'bouilloire', 'the en chambre', 'cafe en chambre'],
      a: () => 'Oui : chaque chambre a une machine à café à capsules et une bouilloire avec une sélection de thés. Les recharges sont offertes chaque jour.',
      next: ['minibar', 'petit-dej', 'cafe-quartier'],
    },
    {
      id: 'salle-bain', cat: 'chambre',
      q: 'Quels produits dans la salle d’eau ?',
      keys: ['produits de toilette', 'shampoing', 'gel douche', 'seche cheveux', 'brosse a dents', 'rasoir', 'salle d eau', 'salle de bain'],
      a: () => 'La salle d’eau est équipée de produits de soin naturels, d’un sèche-cheveux et de peignoirs. Brosse à dents, rasoir ou kit de couture sont disponibles gratuitement à la réception.',
      next: ['oreillers', 'pharmacie', 'chambre'],
    },
    {
      id: 'adaptateur', cat: 'chambre',
      q: 'Avez-vous un adaptateur de prise ?',
      keys: ['adaptateur', 'prise electrique', 'prise de courant', 'brancher', 'chargeur', 'cable', 'usb'],
      a: () => 'Les chambres ont des prises USB-A et USB-C près du lit. Adaptateurs internationaux et chargeurs de téléphone sont prêtés gratuitement par la réception.',
      next: ['wifi', 'travail', 'imprimer'],
    },
    {
      id: 'bruit', cat: 'chambre',
      q: 'Que faire en cas de bruit ?',
      keys: ['bruit', 'bruyant', 'voisin', 'calme', 'insonorisation', 'dormir', 'bouchons d oreilles'],
      a: () => `Prévenez la réception à tout moment (le 9, 24${NB}h/24) : elle intervient rapidement. Des bouchons d’oreilles et un masque de nuit sont aussi à votre disposition.`,
      next: ['reception', 'clim', 'oreillers'],
    },
    {
      id: 'enfants', cat: 'chambre',
      q: 'Les enfants sont-ils les bienvenus ?',
      keys: ['enfant', 'bebe', 'lit bebe', 'poussette', 'chaise haute', 'famille'],
      a: () => 'Les enfants sont les bienvenus ! Un lit bébé et une chaise haute sont fournis gratuitement sur demande.\nIndiquez-le via la page Bienvenue de votre espace ou à la réception.',
      next: ['babysitting', 'jardin', 'oreillers'],
    },
    {
      id: 'babysitting', cat: 'chambre',
      q: 'Proposez-vous une baby-sitter ?',
      keys: ['baby sitter', 'babysitter', 'babysitting', 'garde d enfant', 'nounou'],
      a: () => 'Oui, la réception peut réserver une baby-sitter de confiance, idéalement 24 heures à l’avance.',
      next: ['enfants', 'restaurant-hotel', 'spectacle'],
    },
    {
      id: 'animaux', cat: 'chambre',
      q: 'Les animaux sont-ils acceptés ?',
      keys: ['animal', 'animaux', 'chien', 'chat', 'toutou'],
      a: () => 'Les chiens de moins de 10 kg sont les bienvenus, sur demande préalable auprès de la réception. Les autres animaux ne sont malheureusement pas acceptés.',
      next: ['jardin', 'acces', 'enfants'],
    },
    {
      id: 'accessibilite', cat: 'chambre',
      q: 'L’hôtel est-il accessible en fauteuil ?',
      keys: ['pmr', 'fauteuil', 'handicap', 'mobilite reduite', 'accessible', 'ascenseur'],
      a: () => 'L’hôtel dispose d’un ascenseur qui dessert tous les étages et de chambres adaptées aux personnes à mobilité réduite. Précisez vos besoins via la page Bienvenue pour que tout soit prêt.',
      next: ['chambre', 'acces', 'reception'],
    },
    {
      id: 'fumer', cat: 'chambre',
      q: 'Peut-on fumer à l’hôtel ?',
      keys: ['fumer', 'fumeur', 'cigarette', 'vapoter', 'tabac'],
      a: () => 'Shelter&Co est entièrement non-fumeur, chambres comprises.\nDes cendriers sont à votre disposition devant l’entrée de l’hôtel.',
      next: ['bar-hotel', 'rooftop', 'wifi'],
    },

    // ------------------------------------------------------------- fidélité
    {
      id: 'points', cat: 'fidelite',
      q: 'Combien ai-je de points de fidélité ?',
      keys: ['point', 'fidelite', 'solde', 'statut', 'silver', 'niveau'],
      a: (r) => r
        ? `Vous avez ${r.points} points : vous êtes membre ${r.tier}.\nIl vous manque ${r.toGold} points pour devenir membre Gold.`
        : 'Votre solde de points est visible dans Mon profil, onglet Points de fidélité.',
      next: ['avantages', 'gold', 'legacy-points'],
    },
    {
      id: 'avantages', cat: 'fidelite',
      q: 'Quels sont mes avantages ?',
      keys: ['avantage', 'privilege', 'offert', 'inclus'],
      a: (r) => r
        ? `En tant que membre ${r.tier} : late check-out jusqu’à 14:00, petit-déjeuner offert, Wi-Fi premium et surclassement sur demande, selon disponibilité.`
        : 'Les membres Silver profitent du late check-out, du petit-déjeuner offert, du Wi-Fi premium et du surclassement sur demande.',
      next: ['bons-cadeaux', 'gold', 'surclassement'],
    },
    {
      id: 'gold', cat: 'fidelite',
      q: 'Comment devenir membre Gold ?',
      keys: ['gold', 'devenir gold', 'passer gold', 'statut gold', 'membre gold', 'niveau superieur'],
      a: (r) => 'Le statut Gold s’obtient à partir de 15 000 points de fidélité : il ajoute l’accès au rooftop du dernier étage.' +
        (r ? `\nAvec ${r.points} points, il ne vous en manque plus que ${r.toGold}.` : ''),
      next: ['points', 'rooftop', 'gagner-points'],
    },
    {
      id: 'gagner-points', cat: 'fidelite',
      q: 'Comment gagner des points ?',
      keys: ['gagner des points', 'cumuler', 'accumuler', 'obtenir des points', 'parrainage', 'parrainer'],
      a: () => 'Vous gagnez des points à chaque nuit passée dans un hôtel du groupe, lors de vos dépenses au restaurant et au spa, et en parrainant vos proches (1 000 points par ami).',
      next: ['points', 'gold', 'legacy-points'],
    },
    {
      id: 'bons-cadeaux', cat: 'fidelite',
      q: 'Quels sont mes bons cadeaux ?',
      keys: ['bon cadeau', 'bons cadeaux', 'cadeau', 'voucher', 'reduction'],
      a: (r) => r
        ? 'Vous avez deux bons cadeaux :\n– Spa −20 %, valable jusqu’au 31 décembre 2026 ;\n– un dîner pour deux, valable jusqu’au 15 octobre 2026, donc pendant votre séjour.'
        : 'Vos bons cadeaux sont visibles dans Mon profil, onglet Mes avantages.',
      next: ['restaurant-hotel', 'spa', 'avantages'],
    },
    {
      id: 'legacy-points', cat: 'fidelite',
      q: 'Que sont les Legacy Points ?',
      keys: ['legacy', 'legacy point', 'lp', 'monnaie', 'portefeuille', 'credit'],
      a: (r) => 'Les Legacy Points sont la monnaie virtuelle du groupe Legacy Hospitality.' +
        (r ? ` Vous en avez ${r.lp}.` : '') +
        '\nUtilisez-les pour réserver des activités dans l’hôtel, depuis Mon profil › Mon portefeuille.',
      next: ['activites-lp', 'points', 'massage'],
    },
    {
      id: 'activites-lp', cat: 'fidelite',
      q: 'Quelles activités avec mes Legacy Points ?',
      keys: ['activites avec mes legacy points', 'activites avec mes points', 'activites de l hotel', 'activite a l hotel', 'utiliser mes points', 'depenser mes points', 'reserver une activite', 'payer avec mes points'],
      a: () => 'Avec vos Legacy Points : accès spa (300), massage signature (900), coaching privé (450), dégustation vins et fromages (600), atelier cuisine avec le chef (1 800) et petit-déjeuner en chambre (150).\nRéservez-les depuis Mon profil › Mon portefeuille.',
      next: ['massage', 'legacy-points', 'spa'],
    },

    // ----------------------------------------------------------- transports
    {
      id: 'acces', cat: 'transports',
      q: 'Comment venir à l’hôtel ?',
      keys: ['~venir', 'acces', '~aller', 'adresse', 'itineraire', 'ou se trouve l hotel', 'ou est l hotel'],
      a: () => 'L’hôtel se trouve au 24 rue Charlot, 75003 Paris, au cœur du Haut-Marais.\nMétro : Filles du Calvaire ou Saint-Sébastien–Froissart (ligne 8), à 4 minutes à pied.\nEn taxi : environ 15 minutes depuis la gare de Lyon ou la gare du Nord.',
      next: ['metro', 'cdg', 'gares'],
    },
    {
      id: 'metro', cat: 'transports',
      q: 'Quelle est la station de métro la plus proche ?',
      keys: ['metro', 'station', 'ligne 8', 'transport en commun', 'rer'],
      a: () => 'Les stations les plus proches :\n– Filles du Calvaire et Saint-Sébastien–Froissart (ligne 8), à 4–5 minutes ;\n– Arts et Métiers (lignes 3 et 11), à 7 minutes ;\n– République (5 lignes), à 10 minutes à pied.',
      next: ['navigo', 'acces', 'louvre'],
    },
    {
      id: 'navigo', cat: 'transports',
      q: 'Quel titre de transport acheter ?',
      keys: ['ticket', 'ticket de metro', 'navigo', 'titre de transport', 'carte de transport', 'paris visite', 'billet de metro'],
      a: () => 'Le plus simple : la carte Navigo Easy, rechargeable en station, ou votre téléphone via l’application Bonjour RATP. Pour plusieurs jours de visite, le pass Navigo Semaine ou Paris Visite est avantageux.',
      next: ['metro', 'velo', 'cdg'],
    },
    {
      id: 'cdg', cat: 'transports',
      q: 'Comment aller à l’aéroport Charles-de-Gaulle ?',
      keys: ['charles de gaulle', 'cdg', 'roissy', '~aeroport'],
      a: () => 'Comptez environ 45 minutes en taxi ou en transfert privé.\nEn transports : RER B depuis Châtelet ou gare du Nord, environ 50 minutes au total.',
      next: ['transfert', 'orly', 'taxi'],
    },
    {
      id: 'orly', cat: 'transports',
      q: 'Comment aller à l’aéroport d’Orly ?',
      keys: ['orly', 'aeroport d orly'],
      a: () => 'Comptez environ 40 minutes en taxi ou en transfert privé.\nEn transports : la ligne 14 du métro relie Châtelet à Orly en une trentaine de minutes.',
      next: ['transfert', 'cdg', 'taxi'],
    },
    {
      id: 'gares', cat: 'transports',
      q: 'Comment rejoindre les gares ?',
      keys: ['la gare', 'gare de', 'gare du', 'gares', 'eurostar', 'tgv', 'train'],
      a: () => 'Gare de Lyon, gare du Nord et gare de l’Est sont à environ 15 minutes en taxi. En métro, la gare de l’Est et la gare du Nord sont accessibles depuis République.',
      next: ['taxi', 'transfert', 'bagages'],
    },
    {
      id: 'taxi', cat: 'transports',
      q: 'Pouvez-vous me réserver un taxi ?',
      keys: ['taxi', 'vtc', 'uber', 'chauffeur', 'voiture avec chauffeur'],
      a: () => 'La réception réserve volontiers un taxi ou un VTC pour vous.\nUne station de taxis se trouve aussi à 3 minutes à pied, boulevard des Filles-du-Calvaire.',
      next: ['transfert', 'cdg', 'gares'],
    },
    {
      id: 'transfert', cat: 'transports',
      q: 'Proposez-vous un transfert aéroport ?',
      keys: ['transfert', 'transfert aeroport', 'navette', 'chauffeur aeroport'],
      a: () => 'Oui, un transfert privé vers les aéroports et les gares peut être organisé : faites-en la demande via la page Bienvenue de votre espace ou auprès de la réception.',
      next: ['cdg', 'orly', 'taxi'],
    },
    {
      id: 'parking', cat: 'transports',
      q: 'Où puis-je me garer ?',
      keys: ['parking', 'garer', 'voiture', 'stationner', 'stationnement'],
      a: () => 'L’hôtel n’a pas de parking privé, mais un parking public partenaire se trouve à 300 m. Présentez votre carte de chambre pour bénéficier d’un tarif réduit.',
      next: ['taxi', 'acces', 'velo'],
    },
    {
      id: 'velo', cat: 'transports',
      q: 'Où louer un vélo ?',
      keys: ['velo', 'velib', 'trottinette', 'pedaler', 'deux roues'],
      a: () => 'Une station Vélib’ se trouve à une centaine de mètres de l’hôtel : idéal pour rejoindre les quais de Seine ou le canal Saint-Martin.\nTéléchargez l’application Vélib’ pour débloquer un vélo.',
      next: ['seine', 'canal', 'promenade'],
    },

    // --------------------------------------------------------------- marais
    {
      id: 'quartier', cat: 'marais',
      q: 'Que faire autour de l’hôtel ?',
      keys: ['~visiter', 'activite', 'quartier', 'autour', 'alentour', '~proximite', '~sortir', 'decouvrir', '~voir', '~faire'],
      a: () => 'Le Haut-Marais est l’un des quartiers les plus en vue de Paris :\n– le marché des Enfants-Rouges et la rue de Bretagne, à 3 minutes ;\n– les galeries d’art et boutiques de créateurs de la rue Charlot et de la rue de Turenne ;\n– le musée Picasso, à 5 minutes ;\n– la place des Vosges, à 10 minutes à pied.',
      next: ['enfants-rouges', 'galeries', 'place-vosges'],
    },
    {
      id: 'marais', cat: 'marais',
      q: 'Pourquoi le Marais est-il si prisé ?',
      keys: ['marais', 'haut marais', 'quartier du marais', 'histoire du quartier', 'rue charlot'],
      a: () => 'Le Marais mêle hôtels particuliers du XVIIe siècle, ruelles pavées et une scène créative très vivante : galeries, créateurs, concept stores, cafés et bars à cocktails. Le Haut-Marais, autour de la rue Charlot, en est la partie la plus tendance.',
      next: ['quartier', 'shopping', 'galeries'],
    },
    {
      id: 'place-vosges', cat: 'marais',
      q: 'Comment aller place des Vosges ?',
      keys: ['place des vosges', 'vosges', 'maison de victor hugo', 'victor hugo'],
      a: () => 'La place des Vosges, la plus ancienne place de Paris, est à 10 minutes à pied par la rue de Turenne. Ne manquez pas la maison de Victor Hugo, à l’un de ses angles.',
      next: ['carnavalet', 'promenade', 'patisserie'],
    },
    {
      id: 'enfants-rouges', cat: 'marais',
      q: 'Qu’est-ce que le marché des Enfants-Rouges ?',
      keys: ['enfants rouges', 'marche couvert', 'rue de bretagne'],
      a: () => 'C’est le plus ancien marché couvert de Paris, à 3 minutes de l’hôtel, rue de Bretagne : on y déjeune au comptoir de stands du monde entier. Il est fermé le lundi.',
      next: ['marche', 'restaurant-quartier', 'brunch'],
    },
    {
      id: 'marche', cat: 'marais',
      q: 'Y a-t-il un marché à proximité ?',
      keys: ['marche', 'produit', 'fromage', 'fruit', 'courses'],
      a: () => 'Le marché des Enfants-Rouges est à 3 minutes, rue de Bretagne, avec ses primeurs, fromagers et stands de cuisine du monde. La rue de Bretagne compte aussi de très bons commerces de bouche.',
      next: ['enfants-rouges', 'patisserie', 'superette'],
    },
    {
      id: 'shopping', cat: 'marais',
      q: 'Où faire du shopping ?',
      keys: ['shopping', 'boutique', 'magasin', 'vetements', 'mode', 'createur', 'concept store', 'soldes'],
      a: () => 'Le Haut-Marais est le quartier des créateurs : rue Charlot, rue de Poitou et rue de Turenne pour la mode et le design, rue Vieille-du-Temple et rue des Francs-Bourgeois pour les grandes marques. La plupart des boutiques ouvrent aussi le dimanche.',
      next: ['galeries', 'dimanche', 'patisserie'],
    },
    {
      id: 'galeries', cat: 'marais',
      q: 'Où voir des galeries d’art ?',
      keys: ['galerie', 'galeries', 'art contemporain', 'design', 'artiste'],
      a: () => 'Le Marais est le cœur de l’art contemporain parisien : de nombreuses galeries internationales se trouvent rue de Turenne, rue Debelleyme et rue Vieille-du-Temple, à quelques minutes de l’hôtel. L’entrée est libre.',
      next: ['picasso', 'musee', 'shopping'],
    },
    {
      id: 'musee', cat: 'marais',
      q: 'Un musée ou une exposition à voir ?',
      keys: ['musee', 'expo', 'exposition', 'culture', 'art'],
      a: () => 'À deux pas :\n– le musée Picasso, à 5 minutes ;\n– le musée Carnavalet, consacré à l’histoire de Paris (collections permanentes gratuites) ;\n– le musée Cognacq-Jay et la maison de Victor Hugo.\nPensez à vérifier les horaires et à réserver en ligne.',
      next: ['picasso', 'carnavalet', 'orsay'],
    },
    {
      id: 'picasso', cat: 'marais',
      q: 'Le musée Picasso est-il loin ?',
      keys: ['picasso', 'musee picasso'],
      a: () => 'Non : le musée national Picasso-Paris, installé dans l’hôtel Salé, est à 5 minutes à pied, rue de Thorigny. Réservez un créneau en ligne pour éviter l’attente.',
      next: ['carnavalet', 'galeries', 'musee'],
    },
    {
      id: 'carnavalet', cat: 'marais',
      q: 'Qu’est-ce que le musée Carnavalet ?',
      keys: ['carnavalet', 'musee carnavalet', 'histoire de paris'],
      a: () => 'C’est le musée de l’histoire de Paris, installé dans deux hôtels particuliers du Marais, à 8 minutes à pied. Ses collections permanentes sont gratuites.',
      next: ['place-vosges', 'picasso', 'musee'],
    },
    {
      id: 'restaurant-quartier', cat: 'marais',
      q: 'Un restaurant près de l’hôtel ?',
      keys: ['~restaurant', 'restaurant pres', 'diner', 'dejeuner le midi', '~manger', 'bistrot', 'table', 'gastronomie', 'cuisine'],
      a: (r) => 'Le Haut-Marais regorge de bonnes tables : les stands du marché des Enfants-Rouges, les bistrots de la rue de Bretagne et de jeunes chefs autour de la rue Charlot.' +
        (r ? '\nVotre bon « Dîner pour deux » est aussi valable au restaurant de l’hôtel jusqu’au 15 octobre.' : '') +
        '\nPour une table sur mesure, la réception connaît les meilleures adresses du moment.',
      next: ['falafel', 'vegetarien', 'bar-quartier'],
    },
    {
      id: 'brunch', cat: 'marais',
      q: 'Où bruncher le dimanche ?',
      keys: ['brunch', 'bruncher', 'dimanche matin'],
      a: () => 'Le Marais est le quartier du brunch : de nombreux cafés proposent des formules le week-end autour de la rue de Bretagne et du marché des Enfants-Rouges. Réservez ou arrivez avant 11:00.',
      next: ['cafe-quartier', 'patisserie', 'dimanche'],
    },
    {
      id: 'cafe-quartier', cat: 'marais',
      q: 'Un café sympa pour travailler ou lire ?',
      keys: ['cafe sympa', 'coffee shop', 'bon cafe', 'torrefacteur', 'salon de the', 'cafe du quartier'],
      a: () => 'Les coffee shops de spécialité sont nombreux dans le Haut-Marais, notamment autour de la rue de Bretagne et de la rue Charlot : parfaits pour un flat white et un moment de lecture.',
      next: ['travail', 'patisserie', 'brunch'],
    },
    {
      id: 'bar-quartier', cat: 'marais',
      q: 'Où boire un verre le soir ?',
      keys: ['verre', 'bar', 'boire', 'cocktail', '~soir', 'soiree', 'apero', 'vin'],
      a: () => 'Vous êtes au bon endroit : la rue Charlot, la rue Vieille-du-Temple et la rue de Bretagne comptent parmi les meilleurs bars à cocktails de Paris.\nLe bar de l’hôtel est aussi ouvert jusqu’à minuit.',
      next: ['bar-hotel', 'nuit', 'restaurant-quartier'],
    },
    {
      id: 'vegetarien', cat: 'marais',
      q: 'Des restaurants végétariens ou sans gluten ?',
      keys: ['vegetarien', 'vegan', 'vegetalien', 'sans gluten', 'halal', 'casher', 'kasher', 'allergie'],
      a: () => 'Le Marais est très bien fourni en adresses végétariennes, vegan et sans gluten, et la rue des Rosiers en adresses casher. Signalez aussi vos allergies à la réception : le restaurant de l’hôtel adapte ses plats.',
      next: ['falafel', 'restaurant-quartier', 'restaurant-hotel'],
    },
    {
      id: 'falafel', cat: 'marais',
      q: 'Où manger un falafel ?',
      keys: ['falafel', 'rue des rosiers', 'street food', 'sandwich', 'sur le pouce'],
      a: () => 'Direction la rue des Rosiers, à 10 minutes à pied : c’est l’adresse mythique du falafel à Paris. Attendez-vous à un peu de queue le midi.',
      next: ['restaurant-quartier', 'patisserie', 'vegetarien'],
    },
    {
      id: 'patisserie', cat: 'marais',
      q: 'Une bonne pâtisserie ou boulangerie ?',
      keys: ['patisserie', 'boulangerie', 'croissant', 'viennoiserie', 'gateau', 'dessert', 'chocolat', 'pain'],
      a: () => 'Le Marais compte plusieurs pâtissiers et boulangers réputés, notamment rue de Bretagne et rue Vieille-du-Temple. La réception vous indiquera ses favoris du moment.',
      next: ['brunch', 'cafe-quartier', 'marche'],
    },
    {
      id: 'promenade', cat: 'marais',
      q: 'Où se promener ?',
      keys: ['promener', 'promenade', 'balade', 'marcher', 'flaner', 'pied'],
      a: () => 'Trois belles balades depuis l’hôtel :\n– les ruelles du Marais jusqu’à la place des Vosges ;\n– les quais de Seine et l’île Saint-Louis, à 15 minutes ;\n– le canal Saint-Martin, à 15 minutes.',
      next: ['seine', 'canal', 'place-vosges'],
    },
    {
      id: 'jardin', cat: 'marais',
      q: 'Un parc ou un jardin à proximité ?',
      keys: ['parc', 'jardin', 'square', 'espace vert', 'nature', 'aire de jeux'],
      a: () => 'Le square du Temple, avec son bassin et son aire de jeux, est à 5 minutes. Les jardins de la place des Vosges et le jardin de l’hôtel Salé (musée Picasso) sont aussi tout proches.',
      next: ['promenade', 'enfants', 'place-vosges'],
    },
    {
      id: 'seine', cat: 'marais',
      q: 'Comment rejoindre les quais de Seine ?',
      keys: ['seine', 'quais', 'ile saint louis', 'berges', 'bateau', 'croisiere'],
      a: () => 'Les quais de Seine et l’île Saint-Louis sont à 15 minutes à pied, en traversant le Marais. Les croisières sur la Seine partent notamment du pont Neuf et de la tour Eiffel.',
      next: ['notre-dame', 'promenade', 'velo'],
    },
    {
      id: 'canal', cat: 'marais',
      q: 'Le canal Saint-Martin est-il loin ?',
      keys: ['canal', 'saint martin', 'canal saint martin'],
      a: () => 'Non : le canal Saint-Martin est à 15 minutes à pied, au-delà de la place de la République. Idéal pour flâner au bord de l’eau et prendre un verre en terrasse.',
      next: ['promenade', 'bar-quartier', 'velo'],
    },
    {
      id: 'dimanche', cat: 'marais',
      q: 'Qu’est-ce qui est ouvert le dimanche ?',
      keys: ['dimanche', 'ouvert le dimanche', 'jour ferie', 'ferme le lundi'],
      a: () => 'Le Marais est l’un des rares quartiers de Paris où la plupart des boutiques ouvrent le dimanche. Les musées aussi, mais beaucoup ferment le lundi (Picasso, Carnavalet, Orsay) ou le mardi (Louvre).',
      next: ['brunch', 'shopping', 'musee'],
    },

    // ---------------------------------------------------------------- paris
    {
      id: 'incontournables', cat: 'paris',
      q: 'Quels sont les incontournables de Paris ?',
      keys: ['incontournable', 'monument', 'touristique', 'a ne pas manquer', 'premiere fois a paris'],
      a: () => 'Depuis l’hôtel, les grands sites sont faciles d’accès :\n– Notre-Dame et l’île de la Cité, à 20 minutes à pied ;\n– le Louvre, à 25 minutes à pied ou 15 minutes en métro ;\n– Montmartre et le Sacré-Cœur, à 25 minutes en métro ;\n– la tour Eiffel, à 30 minutes en métro.',
      next: ['louvre', 'notre-dame', 'montmartre'],
    },
    {
      id: 'louvre', cat: 'paris',
      q: 'Comment aller au Louvre ?',
      keys: ['louvre', 'tuileries', 'joconde'],
      a: () => 'Le Louvre est à environ 25 minutes à pied à travers le Marais, ou 15 minutes en métro. La réservation d’un créneau en ligne est obligatoire. Fermé le mardi.',
      next: ['orsay', 'seine', 'notre-dame'],
    },
    {
      id: 'notre-dame', cat: 'paris',
      q: 'Comment visiter Notre-Dame ?',
      keys: ['notre dame', 'ile de la cite', 'sainte chapelle', 'cathedrale'],
      a: () => 'Notre-Dame, rouverte après sa restauration, est à 20 minutes à pied par l’île Saint-Louis. L’entrée est gratuite ; réservez un créneau en ligne pour éviter la file. La Sainte-Chapelle est juste à côté.',
      next: ['seine', 'louvre', 'incontournables'],
    },
    {
      id: 'montmartre', cat: 'paris',
      q: 'Comment aller à Montmartre ?',
      keys: ['montmartre', 'sacre coeur', 'abbesses', 'pigalle'],
      a: () => 'Montmartre est à environ 25 minutes en métro. Montez jusqu’au Sacré-Cœur pour la vue, puis flânez vers la place du Tertre et les Abbesses.',
      next: ['incontournables', 'spectacle', 'eiffel-visite'],
    },
    {
      id: 'eiffel-visite', cat: 'paris',
      q: 'Comment visiter la tour Eiffel ?',
      keys: ['visiter la tour eiffel', 'monter a la tour eiffel', 'sommet', 'trocadero'],
      a: () => 'La tour Eiffel est à environ 30 minutes en métro. Réservez votre montée en ligne à l’avance, surtout pour le sommet. Pour la plus belle photo, passez par le Trocadéro.',
      next: ['vue', 'seine', 'orsay'],
    },
    {
      id: 'orsay', cat: 'paris',
      q: 'Quels grands musées visiter ?',
      keys: ['orsay', 'orangerie', 'monet', 'impressionniste', 'grands musees'],
      a: () => 'Incontournables : le Louvre, le musée d’Orsay (impressionnistes) et l’Orangerie (les Nymphéas de Monet), tous à 20–30 minutes. Orsay ferme le lundi, le Louvre le mardi.',
      next: ['louvre', 'musee', 'pluie'],
    },
    {
      id: 'spectacle', cat: 'paris',
      q: 'Voir un spectacle ou un concert ?',
      keys: ['spectacle', 'opera', 'theatre', 'concert', 'cabaret', 'moulin rouge', 'ballet'],
      a: () => 'Le Cirque d’Hiver et plusieurs théâtres sont à deux pas de l’hôtel. L’Opéra Bastille est à 15 minutes, l’Opéra Garnier à 25 minutes en métro. La réception peut vous aider à trouver des places.',
      next: ['nuit', 'restaurant-quartier', 'montmartre'],
    },
    {
      id: 'versailles', cat: 'paris',
      q: 'Comment aller à Versailles ou Disneyland ?',
      keys: ['versailles', 'chateau', 'disney', 'disneyland', 'excursion', 'hors de paris'],
      a: () => 'Versailles : environ 1 heure en RER C, ou 45 minutes en voiture avec chauffeur.\nDisneyland Paris : environ 50 minutes en RER A depuis Châtelet.\nLa réception peut organiser un transfert privé.',
      next: ['transfert', 'taxi', 'incontournables'],
    },
    {
      id: 'pluie', cat: 'paris',
      q: 'Que faire quand il pleut ?',
      keys: ['il pleut', 'pluie', 'mauvais temps', 'temps gris', 'activite interieure'],
      a: () => 'Par temps de pluie : les musées du quartier (Picasso, Carnavalet), les galeries d’art, le marché couvert des Enfants-Rouges, ou un moment au spa de l’hôtel.\nDes parapluies sont à votre disposition à la réception.',
      next: ['musee', 'spa', 'parapluie'],
    },
    {
      id: 'nuit', cat: 'paris',
      q: 'Où sortir danser ?',
      keys: ['boite de nuit', 'club', 'danser', 'clubbing', 'soiree dansante', 'faire la fete'],
      a: () => 'Le quartier compte plusieurs clubs et bars dansants, notamment autour de la rue Vieille-du-Temple et de République. Pigalle et le canal Saint-Martin sont aussi très animés le soir.',
      next: ['bar-quartier', 'taxi', 'securite'],
    },

    // ------------------------------------------------------------- pratique
    {
      id: 'pharmacie', cat: 'pratique',
      q: 'Où trouver une pharmacie ou un médecin ?',
      keys: ['pharmacie', 'medecin', 'docteur', 'malade', 'medicament', 'urgence', 'sante', 'mal a'],
      a: () => 'Une pharmacie se trouve à 3 minutes à pied, rue de Bretagne, et la réception peut appeler un médecin à tout moment.\nEn cas d’urgence, composez le 15 (SAMU) ou le 112.',
      next: ['reception', 'superette', 'securite'],
    },
    {
      id: 'distributeur', cat: 'pratique',
      q: 'Où retirer de l’argent ?',
      keys: ['distributeur', 'dab', 'retirer', 'especes', 'liquide', 'cash', 'banque', 'bureau de change'],
      a: () => 'Un distributeur de billets se trouve à 2 minutes à pied, rue de Bretagne.\nLa plupart des commerces du quartier acceptent aussi la carte bancaire et le sans-contact.',
      next: ['paiement', 'superette', 'pourboire'],
    },
    {
      id: 'superette', cat: 'pratique',
      q: 'Y a-t-il une supérette à côté ?',
      keys: ['superette', 'supermarche', 'un en cas', 'grignoter', 'snack', 'bouteille d eau', 'ouvert tard', 'epicerie'],
      a: () => 'Plusieurs supérettes et épiceries ouvertes tard se trouvent à moins de 5 minutes à pied, autour de la rue de Bretagne. Pour des produits frais, le marché des Enfants-Rouges est incontournable.',
      next: ['marche', 'distributeur', 'minibar'],
    },
    {
      id: 'poste', cat: 'pratique',
      q: 'Où envoyer un courrier ou un colis ?',
      keys: ['poste', 'colis', 'courrier', 'timbre', 'lettre', 'carte postale'],
      a: () => 'La réception peut poster vos cartes et lettres (timbres en vente sur place) et organiser l’envoi de vos colis. Un bureau de poste se trouve aussi à 5 minutes à pied.',
      next: ['shopping', 'imprimer', 'reception'],
    },
    {
      id: 'securite', cat: 'pratique',
      q: 'Le quartier est-il sûr ?',
      keys: ['securite', 'dangereux', 'pickpocket', 'est il sur', 'quartier sur', 'rentrer tard', 'la nuit dehors'],
      a: () => 'Le Marais est un quartier très animé et agréable, de jour comme de nuit. Comme partout à Paris, restez attentif à vos affaires dans le métro et les lieux très fréquentés.',
      next: ['taxi', 'coffre', 'nuit'],
    },
    {
      id: 'langue', cat: 'pratique',
      q: 'Parlez-vous anglais ?',
      keys: ['anglais', 'english', 'langue', 'espagnol', 'italien', 'allemand', 'parlez vous'],
      a: () => 'Oui : notre équipe parle français et anglais, et plusieurs membres parlent aussi espagnol, italien ou allemand.',
      next: ['reception', 'incontournables', 'navigo'],
    },
    {
      id: 'objets-trouves', cat: 'pratique',
      q: 'J’ai oublié ou perdu un objet',
      keys: ['oublie', 'perdu', 'objets trouves', 'retrouver', 'egare'],
      a: () => 'Contactez la réception : les objets trouvés sont conservés 3 mois et peuvent vous être renvoyés par la poste.',
      next: ['reception', 'poste', 'coffre'],
    },
    {
      id: 'pourboire', cat: 'pratique',
      q: 'Faut-il laisser un pourboire ?',
      keys: ['pourboire', 'tip', 'service compris'],
      a: () => 'En France, le service est toujours compris. Un pourboire n’est pas obligatoire, mais quelques euros pour un service apprécié sont toujours bienvenus.',
      next: ['restaurant-quartier', 'paiement', 'taxi'],
    },
  ];

  return {
    CATEGORIES,
    topics,
    start: ['quartier', 'petit-dej', 'check-out', 'restaurant-quartier'],
    popular: ['quartier', 'petit-dej', 'check-out', 'wifi', 'restaurant-hotel', 'taxi', 'enfants-rouges', 'legacy-points'],
    fallback: `Je n’ai pas encore la réponse à cette question. La réception se fera un plaisir de vous aider, 24${NB}h/24, au 9 depuis le téléphone de votre chambre.\nVoici quelques sujets sur lesquels je peux vous renseigner :`,
  };
})();
