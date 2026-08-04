const { squareClient } = require("../squareClient");
const { squareError } = require("../utils");

async function listLocations() {
  try {
    const response = await squareClient.locations.list();
    return response.locations || [];
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getLocation(locationId) {
  try {
    const response = await squareClient.locations.get({ locationId });
    return response.location || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getDefaultLocationId() {
  const config = require("../config");
  if (config.square.locationId) return config.square.locationId;
  const locations = await listLocations();
  const active = locations.find((loc) => loc.status === "ACTIVE") || locations[0];
  if (!active?.id) {
    throw Object.assign(new Error("No Square location found. Set SQUARE_LOCATION_ID."), {
      statusCode: 400,
    });
  }
  return active.id;
}

module.exports = {
  listLocations,
  getLocation,
  getDefaultLocationId,
};
