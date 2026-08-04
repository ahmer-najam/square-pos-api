const express = require("express");
const vendorService = require("../services/vendorService");
const { asyncHandler } = require("../utils");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await vendorService.searchVendors({
      query: req.query.q,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      cursor: req.query.cursor,
    });
    res.json(result);
  })
);

router.get(
  "/:vendorId",
  asyncHandler(async (req, res) => {
    const vendor = await vendorService.getVendor(req.params.vendorId);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json({ vendor });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const vendor = await vendorService.createVendor(req.body || {});
    res.status(201).json({ vendor });
  })
);

router.patch(
  "/:vendorId",
  asyncHandler(async (req, res) => {
    const vendor = await vendorService.updateVendor(req.params.vendorId, req.body || {});
    res.json({ vendor });
  })
);

module.exports = router;
