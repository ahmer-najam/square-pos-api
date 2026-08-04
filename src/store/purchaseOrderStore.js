const fs = require("fs");
const path = require("path");
const config = require("../config");

const DATA_FILE = path.join(config.dataDir, "purchase-orders.json");

function ensureStore() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ purchaseOrders: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function listPurchaseOrders({ status } = {}) {
  const { purchaseOrders } = readStore();
  if (!status) return purchaseOrders;
  return purchaseOrders.filter((po) => po.status === status);
}

function getPurchaseOrder(id) {
  return listPurchaseOrders().find((po) => po.id === id) || null;
}

function savePurchaseOrder(po) {
  const store = readStore();
  const index = store.purchaseOrders.findIndex((item) => item.id === po.id);
  if (index >= 0) {
    store.purchaseOrders[index] = po;
  } else {
    store.purchaseOrders.push(po);
  }
  writeStore(store);
  return po;
}

function deletePurchaseOrder(id) {
  const store = readStore();
  const before = store.purchaseOrders.length;
  store.purchaseOrders = store.purchaseOrders.filter((item) => item.id !== id);
  if (store.purchaseOrders.length === before) return false;
  writeStore(store);
  return true;
}

module.exports = {
  listPurchaseOrders,
  getPurchaseOrder,
  savePurchaseOrder,
  deletePurchaseOrder,
};
