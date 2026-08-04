/**
 * Seed Sandbox catalog items with inventory tracking enabled.
 * Run: node scripts/seed-catalog.js
 */
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { SquareClient, SquareEnvironment } = require("square");

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    (process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase() === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
});

const PRODUCTS = [
  { name: "Coffee Beans", variationName: "1lb Bag", sku: "COFFEE-1LB", priceCents: 1299 },
  { name: "Paper Cups", variationName: "12oz Pack of 50", sku: "CUPS-12OZ-50", priceCents: 899 },
  { name: "Oat Milk", variationName: "1L Carton", sku: "OAT-1L", priceCents: 349 },
  { name: "Espresso Roast", variationName: "12oz Bag", sku: "ESP-12OZ", priceCents: 1499 },
  { name: "Almond Milk", variationName: "1L Carton", sku: "ALM-1L", priceCents: 399 },
  { name: "Whole Milk", variationName: "1 Gallon", sku: "MILK-GAL", priceCents: 449 },
  { name: "Sugar Packets", variationName: "Box of 200", sku: "SUGAR-200", priceCents: 599 },
  { name: "Stir Sticks", variationName: "Pack of 500", sku: "STIR-500", priceCents: 499 },
  { name: "Napkins", variationName: "Pack of 250", sku: "NAP-250", priceCents: 699 },
  { name: "Lids", variationName: "12oz Pack of 100", sku: "LID-12OZ-100", priceCents: 799 },
  { name: "Hot Chocolate Mix", variationName: "2lb Tin", sku: "COCOA-2LB", priceCents: 1099 },
  { name: "Chai Concentrate", variationName: "32oz Bottle", sku: "CHAI-32OZ", priceCents: 899 },
  { name: "Vanilla Syrup", variationName: "750ml Bottle", sku: "SYR-VAN-750", priceCents: 799 },
  { name: "Caramel Syrup", variationName: "750ml Bottle", sku: "SYR-CAR-750", priceCents: 799 },
  { name: "Croissant", variationName: "Each", sku: "BAK-CROIS", priceCents: 325 },
  { name: "Blueberry Muffin", variationName: "Each", sku: "BAK-MUFF-BLU", priceCents: 295 },
  { name: "Bottled Water", variationName: "500ml", sku: "WAT-500", priceCents: 150 },
  { name: "Orange Juice", variationName: "12oz Bottle", sku: "OJ-12OZ", priceCents: 275 },
  { name: "Cleaning Wipes", variationName: "Canister of 80", sku: "CLEAN-WIPES", priceCents: 649 },
  { name: "Trash Bags", variationName: "Box of 50", sku: "TRASH-50", priceCents: 1299 },
];

async function existingSkus() {
  const skus = new Set();
  let cursor;
  do {
    const page = await client.catalog.search({
      objectTypes: ["ITEM"],
      includeDeletedObjects: false,
      limit: 100,
      cursor,
    });
    for (const obj of page.objects || []) {
      for (const v of obj.itemData?.variations || []) {
        const sku = v.itemVariationData?.sku;
        if (sku) skus.add(sku);
      }
    }
    cursor = page.cursor;
  } while (cursor);
  return skus;
}

async function main() {
  const locRes = await client.locations.list();
  const location = (locRes.locations || []).find((l) => l.status === "ACTIVE");
  if (!location) throw new Error("No active sandbox location found");

  console.log("Location:", location.id, location.name);

  const known = await existingSkus();
  const toCreate = PRODUCTS.filter((p) => !known.has(p.sku));
  if (!toCreate.length) {
    console.log("All seed SKUs already exist. Nothing to create.");
    return;
  }

  console.log(`Creating ${toCreate.length} new items (skipping ${PRODUCTS.length - toCreate.length} existing)...`);

  const objects = toCreate.map((p, index) => {
    const itemId = `#seed-item-${Date.now()}-${index + 1}`;
    const variationId = `#seed-var-${Date.now()}-${index + 1}`;
    return {
      type: "ITEM",
      id: itemId,
      itemData: {
        name: p.name,
        productType: "REGULAR",
        variations: [
          {
            type: "ITEM_VARIATION",
            id: variationId,
            itemVariationData: {
              itemId,
              name: p.variationName,
              sku: p.sku,
              pricingType: "FIXED_PRICING",
              priceMoney: {
                amount: BigInt(p.priceCents),
                currency: location.currency || "USD",
              },
              trackInventory: true,
            },
          },
        ],
      },
    };
  });

  // Square allows up to 10,000 objects per batch upsert request, but keep chunks small.
  const chunkSize = 20;
  const created = [];
  for (let i = 0; i < objects.length; i += chunkSize) {
    const chunk = objects.slice(i, i + chunkSize);
    const response = await client.catalog.batchUpsert({
      idempotencyKey: uuidv4(),
      batches: [{ objects: chunk }],
    });
    if (response.errors?.length) {
      console.error("Errors:", response.errors);
      process.exit(1);
    }
    created.push(...(response.objects || []));
  }

  console.log(`Created ${created.filter((o) => o.type === "ITEM").length} items:`);

  const variations = [];
  for (const obj of created) {
    if (obj.type === "ITEM") {
      console.log("- ITEM", obj.id, obj.itemData?.name);
      for (const v of obj.itemData?.variations || []) {
        console.log(
          "  VARIATION",
          v.id,
          v.itemVariationData?.name,
          v.itemVariationData?.sku
        );
        variations.push({
          itemName: obj.itemData?.name,
          variationId: v.id,
          variationName: v.itemVariationData?.name,
          sku: v.itemVariationData?.sku,
        });
      }
    }
  }

  console.log("\nUse these variation IDs as catalogObjectId in POs / inventory.");
  console.log(JSON.stringify({ locationId: location.id, variations }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
