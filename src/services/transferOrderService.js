const { v4: uuidv4 } = require("uuid");
const { squareClient } = require("../squareClient");
const { squareError } = require("../utils");

async function createTransferOrder({
  sourceLocationId,
  destinationLocationId,
  lineItems,
  notes,
  expectedAt,
  trackingNumber,
} = {}) {
  if (!sourceLocationId || !destinationLocationId) {
    throw Object.assign(new Error("sourceLocationId and destinationLocationId are required"), {
      statusCode: 400,
    });
  }
  if (!lineItems?.length) {
    throw Object.assign(new Error("lineItems are required"), { statusCode: 400 });
  }

  try {
    const response = await squareClient.transferOrders.create({
      idempotencyKey: uuidv4(),
      transferOrder: {
        sourceLocationId,
        destinationLocationId,
        notes: notes || undefined,
        expectedAt: expectedAt || undefined,
        trackingNumber: trackingNumber || undefined,
        lineItems: lineItems.map((line) => ({
          itemVariationId: line.itemVariationId || line.catalogObjectId,
          quantityOrdered: String(line.quantityOrdered || line.quantity),
        })),
      },
    });
    return response.transferOrder || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function searchTransferOrders({
  sourceLocationIds,
  destinationLocationIds,
  statuses,
  limit = 50,
  cursor,
} = {}) {
  try {
    const request = {
      limit,
      cursor,
    };
    if (sourceLocationIds || destinationLocationIds || statuses) {
      request.query = {
        filter: {
          sourceLocationIds,
          destinationLocationIds,
          statuses,
        },
      };
    }

    const response = await squareClient.transferOrders.search(request);
    return {
      transferOrders: response.data || response.transferOrders || [],
      cursor: response.response?.cursor || null,
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getTransferOrder(transferOrderId) {
  try {
    const response = await squareClient.transferOrders.get({ transferOrderId });
    return response.transferOrder || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function startTransferOrder(transferOrderId, version) {
  try {
    const response = await squareClient.transferOrders.start({
      transferOrderId,
      idempotencyKey: uuidv4(),
      version: version != null ? BigInt(version) : undefined,
    });
    return response.transferOrder || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function receiveTransferOrder(transferOrderId, { version, lineItems } = {}) {
  try {
    const response = await squareClient.transferOrders.receive({
      transferOrderId,
      idempotencyKey: uuidv4(),
      version: version != null ? BigInt(version) : undefined,
      receipt: lineItems
        ? {
            lineItems: lineItems.map((line) => ({
              transferOrderLineUid: line.transferOrderLineUid || line.uid,
              quantityReceived: String(line.quantityReceived || line.quantity || 0),
              quantityCanceled: line.quantityCanceled != null ? String(line.quantityCanceled) : undefined,
              quantityDamaged: line.quantityDamaged != null ? String(line.quantityDamaged) : undefined,
            })),
          }
        : undefined,
    });
    return response.transferOrder || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function cancelTransferOrder(transferOrderId, version) {
  try {
    const response = await squareClient.transferOrders.cancel({
      transferOrderId,
      idempotencyKey: uuidv4(),
      version: version != null ? BigInt(version) : undefined,
    });
    return response.transferOrder || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function deleteTransferOrder(transferOrderId, version) {
  try {
    await squareClient.transferOrders.delete({
      transferOrderId,
      version: version != null ? BigInt(version) : undefined,
    });
    return { deleted: true, transferOrderId };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

module.exports = {
  createTransferOrder,
  searchTransferOrders,
  getTransferOrder,
  startTransferOrder,
  receiveTransferOrder,
  cancelTransferOrder,
  deleteTransferOrder,
};
