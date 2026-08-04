const express = require("express");
const transferOrderService = require("../services/transferOrderService");
const { asyncHandler } = require("../utils");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await transferOrderService.searchTransferOrders({
      sourceLocationIds: req.query.sourceLocationId
        ? [req.query.sourceLocationId]
        : undefined,
      destinationLocationIds: req.query.destinationLocationId
        ? [req.query.destinationLocationId]
        : undefined,
      statuses: req.query.status ? [req.query.status] : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      cursor: req.query.cursor,
    });
    res.json(result);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const transferOrder = await transferOrderService.createTransferOrder(req.body || {});
    res.status(201).json({ transferOrder });
  })
);

router.get(
  "/:transferOrderId",
  asyncHandler(async (req, res) => {
    const transferOrder = await transferOrderService.getTransferOrder(
      req.params.transferOrderId
    );
    if (!transferOrder) return res.status(404).json({ error: "Transfer order not found" });
    res.json({ transferOrder });
  })
);

router.post(
  "/:transferOrderId/start",
  asyncHandler(async (req, res) => {
    const transferOrder = await transferOrderService.startTransferOrder(
      req.params.transferOrderId,
      req.body?.version
    );
    res.json({ transferOrder });
  })
);

router.post(
  "/:transferOrderId/receive",
  asyncHandler(async (req, res) => {
    const transferOrder = await transferOrderService.receiveTransferOrder(
      req.params.transferOrderId,
      req.body || {}
    );
    res.json({ transferOrder });
  })
);

router.post(
  "/:transferOrderId/cancel",
  asyncHandler(async (req, res) => {
    const transferOrder = await transferOrderService.cancelTransferOrder(
      req.params.transferOrderId,
      req.body?.version
    );
    res.json({ transferOrder });
  })
);

router.delete(
  "/:transferOrderId",
  asyncHandler(async (req, res) => {
    const result = await transferOrderService.deleteTransferOrder(
      req.params.transferOrderId,
      req.query.version || req.body?.version
    );
    res.json(result);
  })
);

module.exports = router;
