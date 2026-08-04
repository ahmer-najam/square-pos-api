const express = require("express");
const locationService = require("../services/locationService");
const { asyncHandler } = require("../utils");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const locations = await locationService.listLocations();
    res.json({ locations });
  })
);

router.get(
  "/:locationId",
  asyncHandler(async (req, res) => {
    const location = await locationService.getLocation(req.params.locationId);
    if (!location) return res.status(404).json({ error: "Location not found" });
    res.json({ location });
  })
);

module.exports = router;
