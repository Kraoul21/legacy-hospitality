/* ==========================================================================
   Shelter&Co — activités de l'hôtel payables en Legacy Points
   Utilisé par mon-profil.html (Mon portefeuille) et reserver.html.

   Données de démonstration : horaires, tarifs et disponibilités sont à
   remplacer par le vrai planning de l'hôtel.
   ========================================================================== */

window.LHG_ACTIVITES = (function () {
  // Séjours (dates, heures d'arrivée / de départ, solde de Legacy Points)
  const STAYS = {
    '012345': {
      arrival: '2026-10-12', arrivalHour: '15:00',
      departure: '2026-10-15', departureHour: '14:00',
      legacyPoints: 1500,
      loyaltyPoints: 12480, // points de fidélité avant les activités réservées
      tier: 'Silver', nextTier: 'Gold', nextTierAt: 15000,
    },
  };

  // Chaque activité payée en Legacy Points rapporte des points de fidélité :
  // 1 point de fidélité pour 5 LP dépensés
  const LP_PER_POINT = 5;
  const pointsFor = (activity) => Math.round(activity.cost / LP_PER_POINT);

  // slots : heures de début proposées ; duration : durée en minutes
  const ACTIVITIES = [
    { id: 'spa', cat: 'Bien-être', name: 'Accès spa', detail: 'Sauna et hammam · 2 h',
      duration: 120, cost: 300, place: 'Spa, niveau −1',
      slots: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'] },
    { id: 'massage', cat: 'Bien-être', name: 'Massage signature', detail: 'Soin du corps · 60 min',
      duration: 60, cost: 900, place: 'Spa, cabine de soin',
      slots: ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] },
    { id: 'coaching', cat: 'Sport', name: 'Coaching privé', detail: 'Salle de sport · 45 min',
      duration: 45, cost: 450, place: 'Salle de sport',
      slots: ['07:00', '08:00', '09:00', '12:00', '13:00', '18:00', '19:00'] },
    { id: 'degustation', cat: 'Gastronomie', name: 'Dégustation vins & fromages', detail: 'Cave de l’hôtel · 1 h 30',
      duration: 90, cost: 600, place: 'Cave de l’hôtel',
      slots: ['17:30', '19:00', '20:30'] },
    { id: 'atelier', cat: 'Gastronomie', name: 'Atelier cuisine avec le chef', detail: 'Cuisine de l’hôtel · 2 h',
      duration: 120, cost: 1800, place: 'Cuisine du restaurant',
      slots: ['10:00', '16:00'] },
    { id: 'petit-dej', cat: 'En chambre', name: 'Petit-déjeuner en chambre', detail: 'Servi à l’heure de votre choix',
      duration: 30, cost: 150, place: 'Votre chambre',
      slots: ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30'] },
  ];

  const toMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };

  // Jours du séjour : du jour d'arrivée au jour de départ inclus
  function stayDays(stay) {
    const days = [];
    const d = new Date(stay.arrival + 'T12:00:00');
    const end = new Date(stay.departure + 'T12:00:00');
    while (d <= end) {
      days.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  // Créneau « complet » : pseudo-aléatoire mais stable (données de démonstration)
  function isFull(activityId, day, hour) {
    const key = activityId + day + hour;
    let h = 0;
    for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 997;
    return h % 4 === 0;
  }

  // Créneaux d'un jour : après l'arrivée (+30 min) le 1er jour, fin avant le départ le dernier jour
  function slotsFor(activity, stay, day) {
    return activity.slots.map((hour) => {
      const start = toMin(hour);
      const end = start + activity.duration;
      let reason = '';
      if (day === stay.arrival && start < toMin(stay.arrivalHour) + 30) reason = 'avant votre arrivée';
      else if (day === stay.departure && end > toMin(stay.departureHour)) reason = 'après votre départ';
      else if (isFull(activity.id, day, hour)) reason = 'complet';
      return { hour, available: !reason, reason };
    });
  }

  // ---------- réservations confirmées (enregistrées dans le navigateur) ----------
  const key = (ref) => 'lhg-bookings-' + ref;

  function getBookings(ref) {
    try { return JSON.parse(localStorage.getItem(key(ref)) || '[]'); } catch (e) { return []; }
  }

  function addBooking(ref, booking) {
    const activity = ACTIVITIES.find((a) => a.id === booking.activity);
    booking = { pts: activity ? pointsFor(activity) : 0, bookedAt: new Date().toISOString(), ...booking };
    const list = getBookings(ref);
    list.push(booking);
    try { localStorage.setItem(key(ref), JSON.stringify(list)); } catch (e) {}
    return list;
  }

  // Solde restant = solde du séjour − activités réservées
  function balance(ref) {
    const stay = STAYS[ref];
    if (!stay) return 0;
    return stay.legacyPoints - getBookings(ref).reduce((sum, b) => sum + b.cost, 0);
  }

  // Points de fidélité gagnés grâce aux activités réservées
  function earnedPoints(ref) {
    return getBookings(ref).reduce((sum, b) => {
      const a = ACTIVITIES.find((x) => x.id === b.activity);
      return sum + (b.pts != null ? b.pts : a ? pointsFor(a) : 0);
    }, 0);
  }

  // Total des points de fidélité = points du compte + points gagnés avec les activités
  function loyaltyPoints(ref) {
    const stay = STAYS[ref];
    return stay ? stay.loyaltyPoints + earnedPoints(ref) : 0;
  }

  return { STAYS, ACTIVITIES, LP_PER_POINT, pointsFor, stayDays, slotsFor,
    getBookings, addBooking, balance, earnedPoints, loyaltyPoints };
})();
