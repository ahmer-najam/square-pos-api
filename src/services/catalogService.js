const { v4: uuidv4 } = require("uuid");
const { squareClient } = require("../squareClient");
const { getDefaultLocationId } = require("./locationService");
const { squareError, moneyToCents } = require("../utils");

async function searchCatalogItems({ query, limit = 50, cursor } = {}) {
  try {
    const body = {
      limit,
      cursor,
      objectTypes: ["ITEM"],
    };

    if (query) {
      body.query = {
        textQuery: {
          keywords: [query],
        },
      };
    }

    const response = await squareClient.catalog.search(body);
    return {
      objects: response.objects || [],
      cursor: response.cursor || null,
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function listAllItemVariations() {
  const all = [];
  let cursor;
  do {
    const page = await searchCatalogItems({ limit: 100, cursor });
    all.push(...flattenItemVariations(page.objects));
    cursor = page.cursor;
  } while (cursor);
  return all;
}

async function getCatalogObject(objectId) {
  try {
    const response = await squareClient.catalog.object.get({
      objectId,
      includeRelatedObjects: true,
    });
    return {
      object: response.object || null,
      relatedObjects: response.relatedObjects || [],
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

function flattenItemVariations(objects = []) {
  const items = [];

  for (const obj of objects) {
    if (obj.type !== "ITEM" || !obj.itemData) continue;

    const variations = obj.itemData.variations || [];
    for (const variation of variations) {
      const priceMoney = variation.itemVariationData?.priceMoney;
      items.push({
        itemId: obj.id,
        itemName: obj.itemData.name,
        variationId: variation.id,
        variationName: variation.itemVariationData?.name || "Regular",
        sku: variation.itemVariationData?.sku || null,
        trackInventory: variation.itemVariationData?.trackInventory !== false,
        priceMoney: priceMoney || null,
      });
    }
  }

  return items;
}

async function createItem({
  name,
  variationName = "Regular",
  sku,
  price,
  currency = "USD",
  trackInventory = true,
  description,
} = {}) {
  if (!name) {
    throw Object.assign(new Error("name is required"), { statusCode: 400 });
  }

  const locationId = await getDefaultLocationId();
  const loc = await squareClient.locations.get({ locationId });
  const currencyCode = loc.location?.currency || currency;
  const priceCents = moneyToCents(price ?? 0) ?? 0;

  const itemId = `#item-${uuidv4()}`;
  const variationId = `#var-${uuidv4()}`;

  try {
    const response = await squareClient.catalog.batchUpsert({
      idempotencyKey: uuidv4(),
      batches: [
        {
          objects: [
            {
              type: "ITEM",
              id: itemId,
              itemData: {
                name,
                description: description || undefined,
                productType: "REGULAR",
                variations: [
                  {
                    type: "ITEM_VARIATION",
                    id: variationId,
                    itemVariationData: {
                      itemId,
                      name: variationName,
                      sku: sku || undefined,
                      pricingType: "FIXED_PRICING",
                      priceMoney: {
                        amount: BigInt(priceCents),
                        currency: currencyCode,
                      },
                      trackInventory: Boolean(trackInventory),
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    if (response.errors?.length) {
      throw Object.assign(new Error(response.errors.map((e) => e.detail).join("; ")), {
        statusCode: 400,
        errors: response.errors,
      });
    }

    const item = (response.objects || []).find((o) => o.type === "ITEM");
    return {
      item,
      variations: flattenItemVariations(response.objects || []),
    };
  } catch (err) {
    if (err.statusCode) throw err;
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function updateItem(objectId, { name, description } = {}) {
  const current = await getCatalogObject(objectId);
  if (!current.object || current.object.type !== "ITEM") {
    throw Object.assign(new Error("Item not found"), { statusCode: 404 });
  }

  const obj = current.object;
  try {
    const response = await squareClient.catalog.object.upsert({
      idempotencyKey: uuidv4(),
      object: {
        type: "ITEM",
        id: obj.id,
        version: obj.version,
        itemData: {
          ...obj.itemData,
          name: name !== undefined ? name : obj.itemData.name,
          description:
            description !== undefined ? description : obj.itemData.description,
          variations: obj.itemData.variations,
        },
      },
    });

    return {
      object: response.catalogObject || response.object || null,
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function deleteCatalogObject(objectId) {
  try {
    const response = await squareClient.catalog.object.delete({ objectId });
    return {
      deletedObjectIds: response.deletedObjectIds || [],
      deletedAt: response.deletedAt || null,
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

module.exports = {
  searchCatalogItems,
  listAllItemVariations,
  getCatalogObject,
  flattenItemVariations,
  createItem,
  updateItem,
  deleteCatalogObject,
};
