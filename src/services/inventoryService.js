const { v4: uuidv4 } = require("uuid");
const { squareClient } = require("../squareClient");
const { getDefaultLocationId } = require("./locationService");
const catalogService = require("./catalogService");
const { squareError, moneyToCents } = require("../utils");

async function applyChanges(changes, { ignoreUnchangedCounts } = {}) {
  try {
    const response = await squareClient.inventory.batchCreateChanges({
      idempotencyKey: uuidv4(),
      changes,
      ignoreUnchangedCounts,
    });
    return {
      counts: response.counts || [],
      changes: response.changes || [],
      errors: response.errors || [],
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getCounts({ catalogObjectIds, locationIds } = {}) {
  try {
    const ids = Array.isArray(catalogObjectIds)
      ? catalogObjectIds
      : catalogObjectIds
        ? [catalogObjectIds]
        : [];

    if (!ids.length) {
      throw Object.assign(new Error("catalogObjectIds is required"), { statusCode: 400 });
    }

    const locations = locationIds
      ? Array.isArray(locationIds)
        ? locationIds
        : [locationIds]
      : [await getDefaultLocationId()];

    const response = await squareClient.inventory.batchGetCounts({
      catalogObjectIds: ids,
      locationIds: locations,
    });

    return response.data || response.counts || [];
  } catch (err) {
    if (err.statusCode) throw err;
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getCountForItem(catalogObjectId, locationId) {
  const locationIds = locationId ? [locationId] : undefined;
  return getCounts({
    catalogObjectIds: [catalogObjectId],
    locationIds,
  });
}

async function getAllCounts({ locationId, threshold } = {}) {
  const variations = await catalogService.listAllItemVariations();
  const tracked = variations.filter((v) => v.trackInventory !== false);
  if (!tracked.length) return { items: [], counts: [] };

  const locId = locationId || (await getDefaultLocationId());
  const ids = tracked.map((v) => v.variationId);

  // Square batchGetCounts accepts up to 1000 IDs; chunk to be safe.
  const counts = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const page = await getCounts({ catalogObjectIds: chunk, locationIds: [locId] });
    counts.push(...page);
  }

  const byId = new Map();
  for (const c of counts) {
    if (c.state === "IN_STOCK") byId.set(c.catalogObjectId, c);
  }

  let items = tracked.map((v) => {
    const count = byId.get(v.variationId);
    const quantity = count ? Number(count.quantity || 0) : 0;
    return {
      ...v,
      locationId: locId,
      quantity,
      calculatedAt: count?.calculatedAt || null,
    };
  });

  if (threshold != null) {
    const max = Number(threshold);
    items = items.filter((i) => i.quantity <= max);
  }

  return { items, counts };
}

async function getChanges({
  catalogObjectIds,
  locationIds,
  types,
  states,
  updatedAfter,
  updatedBefore,
} = {}) {
  try {
    const response = await squareClient.inventory.batchGetChanges({
      catalogObjectIds,
      locationIds,
      types,
      states,
      updatedAfter,
      updatedBefore,
    });
    return response.data || response.changes || [];
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getAdjustment(adjustmentId) {
  try {
    const response = await squareClient.inventory.getAdjustment({ adjustmentId });
    return response.adjustment || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getTransfer(transferId) {
  try {
    const response = await squareClient.inventory.getTransfer({ transferId });
    return response.transfer || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function receiveStock({
  catalogObjectId,
  quantity,
  locationId,
  vendorId,
  costAmount,
  currency = "USD",
  referenceId,
  occurredAt,
} = {}) {
  if (!catalogObjectId) {
    throw Object.assign(new Error("catalogObjectId is required"), { statusCode: 400 });
  }
  if (!quantity || Number(quantity) <= 0) {
    throw Object.assign(new Error("quantity must be a positive number"), { statusCode: 400 });
  }

  const locId = locationId || (await getDefaultLocationId());
  const costCents = moneyToCents(costAmount);

  const adjustment = {
    catalogObjectId,
    fromState: "NONE",
    toState: "IN_STOCK",
    fromLocationId: locId,
    toLocationId: locId,
    quantity: String(quantity),
    occurredAt: occurredAt || new Date().toISOString(),
    referenceId: referenceId || undefined,
  };

  if (vendorId) adjustment.vendorId = vendorId;
  if (costCents != null) {
    adjustment.costMoney = {
      amount: BigInt(costCents),
      currency,
    };
  }

  try {
    return await applyChanges([{ type: "ADJUSTMENT", adjustment }]);
  } catch (err) {
    const detail = (err.errors || []).map((e) => e.detail || e.code).join(" ");
    const needsRetry =
      (adjustment.vendorId || adjustment.costMoney) &&
      /subscription|cost or vendor/i.test(detail || err.message || "");

    if (needsRetry) {
      const { vendorId: _v, costMoney: _c, ...quantityOnly } = adjustment;
      const result = await applyChanges([{ type: "ADJUSTMENT", adjustment: quantityOnly }]);
      return {
        ...result,
        warning:
          "Square rejected cost/vendor (subscription required). Received quantity only.",
      };
    }

    throw err;
  }
}

async function bulkReceive(items = [], { locationId, vendorId, referenceId } = {}) {
  if (!Array.isArray(items) || !items.length) {
    throw Object.assign(new Error("items array is required"), { statusCode: 400 });
  }

  const results = [];
  for (const item of items) {
    const result = await receiveStock({
      ...item,
      locationId: item.locationId || locationId,
      vendorId: item.vendorId || vendorId,
      referenceId: item.referenceId || referenceId,
    });
    results.push({ catalogObjectId: item.catalogObjectId, ...result });
  }
  return { results };
}

async function setPhysicalCount({
  catalogObjectId,
  quantity,
  locationId,
  referenceId,
  occurredAt,
} = {}) {
  if (!catalogObjectId) {
    throw Object.assign(new Error("catalogObjectId is required"), { statusCode: 400 });
  }
  if (quantity == null || Number(quantity) < 0) {
    throw Object.assign(new Error("quantity must be >= 0"), { statusCode: 400 });
  }

  const locId = locationId || (await getDefaultLocationId());

  return applyChanges(
    [
      {
        type: "PHYSICAL_COUNT",
        physicalCount: {
          catalogObjectId,
          state: "IN_STOCK",
          locationId: locId,
          quantity: String(quantity),
          occurredAt: occurredAt || new Date().toISOString(),
          referenceId: referenceId || undefined,
        },
      },
    ],
    { ignoreUnchangedCounts: true }
  );
}

async function adjustStock({
  catalogObjectId,
  quantityDelta,
  locationId,
  toState = "WASTE",
  referenceId,
  occurredAt,
} = {}) {
  if (!catalogObjectId) {
    throw Object.assign(new Error("catalogObjectId is required"), { statusCode: 400 });
  }
  const delta = Number(quantityDelta);
  if (!delta) {
    throw Object.assign(new Error("quantityDelta must be a non-zero number"), { statusCode: 400 });
  }

  const locId = locationId || (await getDefaultLocationId());
  const isAdd = delta > 0;

  const adjustment = {
    catalogObjectId,
    fromState: isAdd ? "NONE" : "IN_STOCK",
    toState: isAdd ? "IN_STOCK" : toState,
    fromLocationId: locId,
    toLocationId: locId,
    quantity: String(Math.abs(delta)),
    occurredAt: occurredAt || new Date().toISOString(),
    referenceId: referenceId || undefined,
  };

  return applyChanges([{ type: "ADJUSTMENT", adjustment }]);
}

module.exports = {
  getCounts,
  getCountForItem,
  getAllCounts,
  getChanges,
  getAdjustment,
  getTransfer,
  receiveStock,
  bulkReceive,
  setPhysicalCount,
  adjustStock,
};
