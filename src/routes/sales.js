const express = require("express");
const salesService = require("../services/salesService");
const { asyncHandler } = require("../utils");

const router = express.Router();

router.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const result = await salesService.listSalesPayments({
      beginTime: req.query.beginTime,
      endTime: req.query.endTime,
      locationId: req.query.locationId,
      cursor: req.query.cursor,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      sortOrder: req.query.sortOrder || "DESC",
      status: req.query.status,
    });
    res.json(result);
  })
);

router.get(
  "/payments/:paymentId",
  asyncHandler(async (req, res) => {
    const payment = await salesService.getSalesPayment(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json({ payment });
  })
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const summary = await salesService.getSalesSummary({
      beginTime: req.query.beginTime,
      endTime: req.query.endTime,
      locationId: req.query.locationId,
      sortOrder: req.query.sortOrder || "DESC",
    });
    res.json(summary);
  })
);

module.exports = router;
