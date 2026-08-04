const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config");
const { squareClient } = require("./squareClient");

const locationsRouter = require("./routes/locations");
const catalogRouter = require("./routes/catalog");
const vendorsRouter = require("./routes/vendors");
const salesRouter = require("./routes/sales");
const inventoryRouter = require("./routes/inventory");
const purchaseOrdersRouter = require("./routes/purchaseOrders");
const transferOrdersRouter = require("./routes/transferOrders");

const app = express();

app.set("json replacer", (_key, value) =>
  typeof value === "bigint" ? value.toString() : value
);

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const API_INDEX = {
  name: "Square POS Demo API",
  note:
    "Square has no public Purchase Orders API. POs are stored locally and received stock syncs to Square Inventory.",
  endpoints: {
    health: {
      "GET /health": "App health",
      "GET /health/square": "Probe Square API connectivity",
    },
    locations: {
      "GET /api/locations": "List locations",
      "GET /api/locations/:locationId": "Get location",
    },
    catalog: {
      "GET /api/catalog/items": "List/search items (?q=)",
      "POST /api/catalog/items": "Create item + variation",
      "PATCH /api/catalog/items/:objectId": "Update item",
      "GET /api/catalog/:objectId": "Get catalog object",
      "DELETE /api/catalog/:objectId": "Delete catalog object",
    },
    vendors: {
      "GET /api/vendors": "Search vendors (?q=)",
      "POST /api/vendors": "Create vendor",
      "GET /api/vendors/:vendorId": "Get vendor",
      "PATCH /api/vendors/:vendorId": "Update vendor",
    },
    sales: {
      "GET /api/sales/payments": "List sales payments",
      "GET /api/sales/payments/:paymentId": "Get payment detail",
      "GET /api/sales/summary": "Sales totals by period",
    },
    inventory: {
      "GET /api/inventory": "All stock counts (?threshold=&locationId=)",
      "GET /api/inventory/low-stock": "Low stock (?threshold=5)",
      "GET /api/inventory/counts": "Counts by catalogObjectIds",
      "GET /api/inventory/counts/:catalogObjectId": "Counts for one variation",
      "GET /api/inventory/changes": "Inventory change history",
      "GET /api/inventory/adjustments/:adjustmentId": "Get adjustment",
      "GET /api/inventory/transfers/:transferId": "Get transfer",
      "POST /api/inventory/receive": "Receive stock",
      "POST /api/inventory/bulk-receive": "Receive many items",
      "POST /api/inventory/physical-count": "Set absolute on-hand",
      "POST /api/inventory/adjust": "Relative +/- adjust",
    },
    transferOrders: {
      "GET /api/transfer-orders": "Search transfer orders",
      "POST /api/transfer-orders": "Create transfer order (DRAFT)",
      "GET /api/transfer-orders/:id": "Get transfer order",
      "POST /api/transfer-orders/:id/start": "Start transfer (moves stock out)",
      "POST /api/transfer-orders/:id/receive": "Receive transfer at destination",
      "POST /api/transfer-orders/:id/cancel": "Cancel transfer order",
      "DELETE /api/transfer-orders/:id": "Delete DRAFT transfer order",
    },
    purchaseOrders: {
      "GET /api/purchase-orders": "List POs (?status=&vendorId=&q=)",
      "POST /api/purchase-orders": "Create PO (DRAFT)",
      "GET /api/purchase-orders/:id": "Get PO",
      "PATCH /api/purchase-orders/:id": "Update PO",
      "DELETE /api/purchase-orders/:id": "Delete DRAFT/CANCELLED PO",
      "POST /api/purchase-orders/:id/lines": "Add line",
      "PATCH /api/purchase-orders/:id/lines/:lineId": "Update line",
      "DELETE /api/purchase-orders/:id/lines/:lineId": "Remove line",
      "POST /api/purchase-orders/:id/submit": "DRAFT → ORDERED",
      "POST /api/purchase-orders/:id/cancel": "Cancel PO",
      "POST /api/purchase-orders/:id/reopen": "Reopen CANCELLED PO",
      "POST /api/purchase-orders/:id/receive": "Receive → Square inventory",
    },
  },
};

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "square-pos-demo",
    environment: config.square.environment,
    applicationId: config.square.applicationId || null,
    squareConfigured: Boolean(config.square.accessToken),
    locationId: config.square.locationId || null,
  });
});

app.get("/health/square", async (_req, res) => {
  if (!config.square.accessToken) {
    return res.status(503).json({ ok: false, error: "SQUARE_ACCESS_TOKEN not configured" });
  }
  try {
    const response = await squareClient.locations.list();
    const locations = response.locations || [];
    res.json({
      ok: true,
      environment: config.square.environment,
      locationCount: locations.length,
      locations: locations.map((l) => ({ id: l.id, name: l.name, status: l.status })),
    });
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: err.message,
      errors: err.errors || undefined,
    });
  }
});

app.get("/", (_req, res) => {
  res.json(API_INDEX);
});

app.use("/api/locations", locationsRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/sales", salesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/transfer-orders", transferOrdersRouter);
app.use("/api/purchase-orders", purchaseOrdersRouter);

app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  console.error("[error]", err.message, err.errors || "");
  res.status(status).json({
    error: err.message || "Internal server error",
    errors: err.errors || undefined,
  });
});

app.listen(config.port, () => {
  console.log(`Square POS demo listening on http://localhost:${config.port}`);
  console.log(`Environment: ${config.square.environment}`);
});
