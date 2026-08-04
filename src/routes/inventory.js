const express = require("express");
const inventoryService = require("../services/inventoryService");
const { asyncHandler } = require("../utils");

const router = express.Router();

/** GET /api/inventory — all counts (optional ?threshold=&locationId=) */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await inventoryService.getAllCounts({
      locationId: req.query.locationId,
      threshold: req.query.threshold != null ? Number(req.query.threshold) : undefined,
    });
    res.json(result);
  })
);

/** GET /api/inventory/low-stock?threshold=5 */
router.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const threshold = req.query.threshold != null ? Number(req.query.threshold) : 5;
    const result = await inventoryService.getAllCounts({
      locationId: req.query.locationId,
      threshold,
    });
    res.json(result);
  })
);

/** GET /api/inventory/counts?catalogObjectIds=id1,id2&locationIds=loc1 */
router.get(
  "/counts",
  asyncHandler(async (req, res) => {
    const catalogObjectIds = String(req.query.catalogObjectIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const locationIds = req.query.locationIds
      ? String(req.query.locationIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const counts = await inventoryService.getCounts({ catalogObjectIds, locationIds });
    res.json({ counts });
  })
);

/** GET /api/inventory/counts/:catalogObjectId */
router.get(
  "/counts/:catalogObjectId",
  asyncHandler(async (req, res) => {
    const counts = await inventoryService.getCountForItem(
      req.params.catalogObjectId,
      req.query.locationId
    );
    res.json({ counts });
  })
);

/** GET /api/inventory/changes */
router.get(
  "/changes",
  asyncHandler(async (req, res) => {
    const catalogObjectIds = req.query.catalogObjectIds
      ? String(req.query.catalogObjectIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const locationIds = req.query.locationIds
      ? String(req.query.locationIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const changes = await inventoryService.getChanges({
      catalogObjectIds,
      locationIds,
      types: req.query.types ? String(req.query.types).split(",") : undefined,
      states: req.query.states ? String(req.query.states).split(",") : undefined,
      updatedAfter: req.query.updatedAfter,
      updatedBefore: req.query.updatedBefore,
    });
    res.json({ changes });
  })
);

/** GET /api/inventory/adjustments/:adjustmentId */
router.get(
  "/adjustments/:adjustmentId",
  asyncHandler(async (req, res) => {
    const adjustment = await inventoryService.getAdjustment(req.params.adjustmentId);
    if (!adjustment) return res.status(404).json({ error: "Adjustment not found" });
    res.json({ adjustment });
  })
);

/** GET /api/inventory/transfers/:transferId — legacy inventory transfer record */
router.get(
  "/transfers/:transferId",
  asyncHandler(async (req, res) => {
    const transfer = await inventoryService.getTransfer(req.params.transferId);
    if (!transfer) return res.status(404).json({ error: "Transfer not found" });
    res.json({ transfer });
  })
);

/** POST /api/inventory/receive */
router.post(
  "/receive",
  asyncHandler(async (req, res) => {
    const result = await inventoryService.receiveStock(req.body || {});
    res.status(201).json(result);
  })
);

/** POST /api/inventory/bulk-receive */
router.post(
  "/bulk-receive",
  asyncHandler(async (req, res) => {
    const { items, locationId, vendorId, referenceId } = req.body || {};
    const result = await inventoryService.bulkReceive(items, {
      locationId,
      vendorId,
      referenceId,
    });
    res.status(201).json(result);
  })
);

/** POST /api/inventory/physical-count */
router.post(
  "/physical-count",
  asyncHandler(async (req, res) => {
    const result = await inventoryService.setPhysicalCount(req.body || {});
    res.status(201).json(result);
  })
);

/** POST /api/inventory/adjust */
router.post(
  "/adjust",
  asyncHandler(async (req, res) => {
    const result = await inventoryService.adjustStock(req.body || {});
    res.status(201).json(result);
  })
);

module.exports = router;
