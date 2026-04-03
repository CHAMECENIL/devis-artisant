const axios = require('axios');
const db = require('../database/db');

async function calculateDistance(originAddress, destinationAddress) {
  const settings = db.prepare('SELECT google_maps_key FROM settings WHERE id = 1').get();
  const apiKey = settings?.google_maps_key || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    // Estimation locale si pas de clé API
    return estimateDistanceLocally(originAddress, destinationAddress);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json`;
    const response = await axios.get(url, {
      params: {
        origins: originAddress,
        destinations: destinationAddress,
        units: 'metric',
        key: apiKey,
        language: 'fr',
        mode: 'driving'
      }
    });

    const data = response.data;

    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0];
      return {
        distanceKm: element.distance.value / 1000,
        durationMin: element.duration.value / 60,
        distanceText: element.distance.text,
        durationText: element.duration.text
      };
    } else {
      return estimateDistanceLocally(originAddress, destinationAddress);
    }
  } catch (error) {
    console.error('Erreur Google Maps:', error.message);
    return estimateDistanceLocally(originAddress, destinationAddress);
  }
}

function estimateDistanceLocally(origin, destination) {
  // Estimation basique si pas d'API (extraction de villes)
  console.log(`Distance estimation locale: ${origin} → ${destination}`);
  return {
    distanceKm: 25, // valeur par défaut
    durationMin: 30,
    distanceText: '~25 km (estimation)',
    durationText: '~30 min (estimation)',
    estimated: true
  };
}

module.exports = { calculateDistance };
