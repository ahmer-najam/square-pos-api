const { v4: uuidv4 } = require("uuid");
const store = require("../store/purchaseOrderStore");
const inventoryService = require("./inventoryService");
const { getDefaultLocationId } = require("./locationService");

const STATUSES = ["DRAFT", "ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"];

function computeLineTotals(line) {
  const qty = Number(line.quantityOrdered) || 0;
  const unitCost = Number(line.unitCost) || 0;
  return {
    ...line,
    quantityOrdered: qty,
    quantityReceived: Number(line.quantityReceived) || 0,
    unitCost,
    lineTotal: Number((qty * unitCost).toFixed(2)),
    quantityRemaining: Math.max(0, qty - (Number(line.quantityReceived) || 0)),
  };
}

function summarize(po) {
  const lines = (po.lines || []).map(computeLineTotals);
  const totalOrdered = lines.reduce((sum, l) => sum + l.quantityOrdered, 0);
  const totalReceived = lines.reduce((sum, l) => sum + l.quantityReceived, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  let status = po.status;
  if (status !== "CANCELLED" && status !== "DRAFT") {
    if (totalReceived <= 0) status = "ORDERED";
    else if (totalReceived < totalOrdered) status = "PARTIAL";
    else status = "RECEIVED";
  }

  return {
    ...po,
    lines,
    totals: {
      lineCount: lines.length,
      quantityOrdered: totalOrdered,
      quantityReceived: totalReceived,
      quantityRemaining: Math.max(0, totalOrdered - totalReceived),
      subtotal: Number(subtotal.toFixed(2)),
      currency: po.currency || "USD",
    },
    status,
  };
}

function normalizeLine(line, existingReceived = 0) {
  return {
    id: line.id || uuidv4(),
    catalogObjectId: line.catalogObjectId,
    itemName: line.itemName || null,
    variationName: line.variationName || null,
    sku: line.sku || null,
    quantityOrdered: Number(line.quantityOrdered),
    quantityReceived: Number(line.quantityReceived ?? existingReceived) || 0,
    unitCost: line.unitCost ?? 0,
  };
}

function validateLines(lines) {
  if (!lines?.length) {
    throw Object.assign(new Error("At least one line item is required"), { statusCode: 400 });
  }
  for (const line of lines) {
    if (!line.catalogObjectId) {
      throw Object.assign(new Error("Each line needs catalogObjectId (item variation id)"), {
        statusCode: 400,
      });
    }
    if (!line.quantityOrdered || Number(line.quantityOrdered) <= 0) {
      throw Object.assign(new Error("Each line needs quantityOrdered > 0"), { statusCode: 400 });
    }
  }
}

function listPurchaseOrders(filters = {}) {
  let orders = store.listPurchaseOrders({ status: filters.status }).map(summarize);

  if (filters.vendorId) {
    orders = orders.filter((po) => po.vendorId === filters.vendorId);
  }
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    orders = orders.filter(
      (po) =>
        po.poNumber?.toLowerCase().includes(q) ||
        po.vendorName?.toLowerCase().includes(q) ||
        po.notes?.toLowerCase().includes(q)
    );
  }

  orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return orders;
}

function getPurchaseOrder(id) {
  const po = store.getPurchaseOrder(id);
  return po ? summarize(po) : null;
}

async function createPurchaseOrder(input = {}) {
  validateLines(input.lines);

  const locationId = input.locationId || (await getDefaultLocationId());
  const now = new Date().toISOString();

  const po = summarize({
    id: uuidv4(),
    poNumber: input.poNumber || `PO-${Date.now()}`,
    status: input.status && STATUSES.includes(input.status) ? input.status : "DRAFT",
    vendorId: input.vendorId || null,
    vendorName: input.vendorName || null,
    locationId,
    currency: input.currency || "USD",
    notes: input.notes || "",
    expectedAt: input.expectedAt || null,
    lines: input.lines.map((line) => normalizeLine(line)),
    receipts: [],
    createdAt: now,
    updatedAt: now,
  });

  return store.savePurchaseOrder(po);
}

function assertEditable(existing, { allowOrdered = false } = {}) {
  if (!existing) {
    throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
  }
  const blocked = allowOrdered
    ? ["RECEIVED", "CANCELLED"]
    : ["ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"];
  // DRAFT always editable; ORDERED/PARTIAL only for limited patches when allowOrdered
  if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
    throw Object.assign(new Error(`Cannot modify a ${existing.status} purchase order`), {
      statusCode: 400,
    });
  }
  if (!allowOrdered && existing.status !== "DRAFT") {
    throw Object.assign(new Error(`Only DRAFT purchase orders can be fully edited`), {
      statusCode: 400,
    });
  }
  return blocked;
}

function updatePurchaseOrder(id, patch = {}) {
  const existing = store.getPurchaseOrder(id);
  if (!existing) {
    throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
  }
  if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
    throw Object.assign(new Error(`Cannot update a ${existing.status} purchase order`), {
      statusCode: 400,
    });
  }

  const next = {
    ...existing,
    vendorId: patch.vendorId !== undefined ? patch.vendorId : existing.vendorId,
    vendorName: patch.vendorName !== undefined ? patch.vendorName : existing.vendorName,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    expectedAt: patch.expectedAt !== undefined ? patch.expectedAt : existing.expectedAt,
    locationId: patch.locationId || existing.locationId,
    updatedAt: new Date().toISOString(),
  };

  if (patch.status) {
    if (!STATUSES.includes(patch.status)) {
      throw Object.assign(new Error(`Invalid status. Use one of: ${STATUSES.join(", ")}`), {
        statusCode: 400,
      });
    }
    next.status = patch.status;
  }

  if (patch.lines) {
    if (existing.status !== "DRAFT") {
      throw Object.assign(new Error("Lines can only be replaced on DRAFT purchase orders"), {
        statusCode: 400,
      });
    }
    validateLines(patch.lines);
    next.lines = patch.lines.map((line) => normalizeLine(line));
  }

  return store.savePurchaseOrder(summarize(next));
}

function addLine(id, lineInput = {}) {
  const existing = store.getPurchaseOrder(id);
  assertEditable(existing);
  validateLines([lineInput]);

  const next = {
    ...existing,
    lines: [...existing.lines, normalizeLine(lineInput)],
    updatedAt: new Date().toISOString(),
  };
  return store.savePurchaseOrder(summarize(next));
}

function updateLine(id, lineId, patch = {}) {
  const existing = store.getPurchaseOrder(id);
  assertEditable(existing);

  const index = existing.lines.findIndex((l) => l.id === lineId);
  if (index < 0) {
    throw Object.assign(new Error("Line not found"), { statusCode: 404 });
  }

  const current = existing.lines[index];
  const updated = normalizeLine(
    {
      ...current,
      ...patch,
      id: current.id,
      quantityReceived: current.quantityReceived,
    },
    current.quantityReceived
  );

  if (!updated.catalogObjectId || updated.quantityOrdered <= 0) {
    throw Object.assign(new Error("catalogObjectId and quantityOrdered > 0 are required"), {
      statusCode: 400,
    });
  }

  const lines = [...existing.lines];
  lines[index] = updated;

  return store.savePurchaseOrder(
    summarize({ ...existing, lines, updatedAt: new Date().toISOString() })
  );
}

function removeLine(id, lineId) {
  const existing = store.getPurchaseOrder(id);
  assertEditable(existing);

  const lines = existing.lines.filter((l) => l.id !== lineId);
  if (lines.length === existing.lines.length) {
    throw Object.assign(new Error("Line not found"), { statusCode: 404 });
  }
  if (!lines.length) {
    throw Object.assign(new Error("Purchase order must keep at least one line"), {
      statusCode: 400,
    });
  }

  return store.savePurchaseOrder(
    summarize({ ...existing, lines, updatedAt: new Date().toISOString() })
  );
}

function submitPurchaseOrder(id) {
  const existing = store.getPurchaseOrder(id);
  if (!existing) {
    throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT") {
    throw Object.assign(new Error("Only DRAFT purchase orders can be submitted"), {
      statusCode: 400,
    });
  }
  if (!existing.lines?.length) {
    throw Object.assign(new Error("Cannot submit a purchase order with no lines"), {
      statusCode: 400,
    });
  }

  return store.savePurchaseOrder(
    summarize({
      ...existing,
      status: "ORDERED",
      updatedAt: new Date().toISOString(),
    })
  );
}

function cancelPurchaseOrder(id) {
  const existing = store.getPurchaseOrder(id);
  if (!existing) {
    throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
  }
  if (existing.status === "RECEIVED") {
    throw Object.assign(new Error("Cannot cancel a fully received purchase order"), {
      statusCode: 400,
    });
  }

  return store.savePurchaseOrder({
    ...existing,
    status: "CANCELLED",
    updatedAt: new Date().toISOString(),
  });
}

function reopenPurchaseOrder(id) {
  const existing = store.getPurchaseOrder(id);
  if (!existing) {
    throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
  }
  if (existing.status !== "CANCELLED") {
    throw Object.assign(new Error("Only CANCELLED purchase orders can be reopened"), {
      statusCode: 400,
    });
  }

  const hasReceipts = (existing.receipts || []).length > 0;
  return store.savePurchaseOrder(
    summarize({
      ...existing,
      status: hasReceipts ? "ORDERED" : "DRAFT",
      updatedAt: new Date().toISOString(),
    })
  );
}

function deletePurchaseOrder(id) {
  const existing = store.getPurchaseOrder(id);
  if (!existing) {
    throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT" && existing.status !== "CANCELLED") {
    throw Object.assign(new Error("Only DRAFT or CANCELLED purchase orders can be deleted"), {
      statusCode: 400,
    });
  }
  store.deletePurchaseOrder(id);
  return { deleted: true, id };
}

async function receivePurchaseOrder(id, input = {}) {
  const existing = store.getPurchaseOrder(id);
  if (!existing) {
    throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
  }
  if (["CANCELLED", "DRAFT", "RECEIVED"].includes(existing.status)) {
    throw Object.assign(
      new Error(`Cannot receive against a ${existing.status} purchase order. Submit it first.`),
      { statusCode: 400 }
    );
  }

  const syncToSquare = input.syncToSquare !== false;
  const receiptLines = [];
  const squareResults = [];

  const requested = new Map(
    (input.lines || []).map((l) => [l.lineId || l.catalogObjectId, Number(l.quantity)])
  );

  const updatedLines = [];

  for (const line of existing.lines) {
    const remaining = Number(line.quantityOrdered) - Number(line.quantityReceived || 0);
    let toReceive = 0;

    if (requested.size > 0) {
      const byId = requested.get(line.id);
      const byCatalog = requested.get(line.catalogObjectId);
      toReceive = Number(byId ?? byCatalog ?? 0);
    } else {
      toReceive = remaining;
    }

    if (toReceive < 0) {
      throw Object.assign(new Error(`Invalid receive qty for line ${line.id}`), { statusCode: 400 });
    }
    if (toReceive > remaining) {
      throw Object.assign(
        new Error(
          `Cannot receive ${toReceive} for ${line.catalogObjectId}; only ${remaining} remaining`
        ),
        { statusCode: 400 }
      );
    }

    if (toReceive > 0) {
      const costForQty = Number(line.unitCost || 0) * toReceive;
      receiptLines.push({
        lineId: line.id,
        catalogObjectId: line.catalogObjectId,
        quantity: toReceive,
        unitCost: line.unitCost,
        costTotal: Number(costForQty.toFixed(2)),
      });

      if (syncToSquare) {
        const result = await inventoryService.receiveStock({
          catalogObjectId: line.catalogObjectId,
          quantity: toReceive,
          locationId: existing.locationId,
          vendorId: existing.vendorId || undefined,
          costAmount: costForQty,
          currency: existing.currency || "USD",
          referenceId: existing.poNumber,
        });
        squareResults.push({
          catalogObjectId: line.catalogObjectId,
          quantity: toReceive,
          square: result,
        });
      }
    }

    updatedLines.push({
      ...line,
      quantityReceived: Number(line.quantityReceived || 0) + toReceive,
    });
  }

  if (!receiptLines.length) {
    throw Object.assign(new Error("Nothing to receive"), { statusCode: 400 });
  }

  const receipt = {
    id: uuidv4(),
    receivedAt: new Date().toISOString(),
    syncedToSquare: syncToSquare,
    lines: receiptLines,
    squareResults,
  };

  store.savePurchaseOrder(
    summarize({
      ...existing,
      lines: updatedLines,
      receipts: [...(existing.receipts || []), receipt],
      updatedAt: new Date().toISOString(),
    })
  );

  return {
    purchaseOrder: getPurchaseOrder(id),
    receipt,
  };
}

module.exports = {
  STATUSES,
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  addLine,
  updateLine,
  removeLine,
  submitPurchaseOrder,
  cancelPurchaseOrder,
  reopenPurchaseOrder,
  deletePurchaseOrder,
  receivePurchaseOrder,
};
