const express = require("express");
const purchaseOrderService = require("../services/purchaseOrderService");
const { asyncHandler } = require("../utils");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const purchaseOrders = purchaseOrderService.listPurchaseOrders({
      status: req.query.status,
      vendorId: req.query.vendorId,
      q: req.query.q,
    });
    res.json({
      purchaseOrders,
      statuses: purchaseOrderService.STATUSES,
      count: purchaseOrders.length,
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.getPurchaseOrder(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    res.json({ purchaseOrder });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const purchaseOrder = await purchaseOrderService.createPurchaseOrder(req.body || {});
    res.status(201).json({ purchaseOrder });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.updatePurchaseOrder(
      req.params.id,
      req.body || {}
    );
    res.json({ purchaseOrder });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = purchaseOrderService.deletePurchaseOrder(req.params.id);
    res.json(result);
  })
);

router.post(
  "/:id/lines",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.addLine(req.params.id, req.body || {});
    res.status(201).json({ purchaseOrder });
  })
);

router.patch(
  "/:id/lines/:lineId",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.updateLine(
      req.params.id,
      req.params.lineId,
      req.body || {}
    );
    res.json({ purchaseOrder });
  })
);

router.delete(
  "/:id/lines/:lineId",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.removeLine(req.params.id, req.params.lineId);
    res.json({ purchaseOrder });
  })
);

router.post(
  "/:id/submit",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.submitPurchaseOrder(req.params.id);
    res.json({ purchaseOrder });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.cancelPurchaseOrder(req.params.id);
    res.json({ purchaseOrder });
  })
);

router.post(
  "/:id/reopen",
  asyncHandler(async (req, res) => {
    const purchaseOrder = purchaseOrderService.reopenPurchaseOrder(req.params.id);
    res.json({ purchaseOrder });
  })
);

router.post(
  "/:id/receive",
  asyncHandler(async (req, res) => {
    const result = await purchaseOrderService.receivePurchaseOrder(
      req.params.id,
      req.body || {}
    );
    res.status(201).json(result);
  })
);

module.exports = router;
