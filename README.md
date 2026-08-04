# Square POS Demo (Inventory + Purchase Orders)

Node.js Express demo for [Square](https://developer.squareup.com/) **inventory**, **catalog**, **locations**, **vendors**, plus a local **purchase-order** workflow.

> Square does **not** publish a public Purchase Orders API. POs are stored in `data/purchase-orders.json`. Receiving a PO syncs stock into Square Inventory.

## Setup

```bash
cp .env.example .env
# set SQUARE_ACCESS_TOKEN (Sandbox) and optional SQUARE_LOCATION_ID / SQUARE_APPLICATION_ID
npm install
npm run seed    # optional sample catalog
npm run dev
```

Server: `http://localhost:3000` — full route map at `GET /`.

## Endpoints

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | App health + config flags |
| GET | `/health/square` | Live Square connectivity probe |

### Locations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/locations` | List locations |
| GET | `/api/locations/:locationId` | Get one location |

### Catalog
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/catalog/items` | List/search items (`?q=`) |
| POST | `/api/catalog/items` | Create item + variation |
| PATCH | `/api/catalog/items/:objectId` | Update item name/description |
| GET | `/api/catalog/:objectId` | Get catalog object |
| DELETE | `/api/catalog/:objectId` | Delete catalog object |

### Vendors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vendors` | Search vendors (`?q=`) |
| POST | `/api/vendors` | Create vendor |
| GET | `/api/vendors/:vendorId` | Get vendor |
| PATCH | `/api/vendors/:vendorId` | Update vendor |

### Sales
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sales/payments` | List payments (`?beginTime=&endTime=&locationId=&limit=&cursor=&status=`) |
| GET | `/api/sales/payments/:paymentId` | Payment details |
| GET | `/api/sales/summary` | Aggregate totals (`?beginTime=&endTime=&locationId=`) |

### Inventory
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory` | All stock counts (`?threshold=&locationId=`) |
| GET | `/api/inventory/low-stock` | Low stock (`?threshold=5`) |
| GET | `/api/inventory/counts` | Counts for `catalogObjectIds` |
| GET | `/api/inventory/counts/:catalogObjectId` | Counts for one variation |
| GET | `/api/inventory/changes` | Change history |
| GET | `/api/inventory/adjustments/:adjustmentId` | Get adjustment |
| GET | `/api/inventory/transfers/:transferId` | Get legacy inventory transfer |
| POST | `/api/inventory/receive` | Receive stock |
| POST | `/api/inventory/bulk-receive` | Receive many items |
| POST | `/api/inventory/physical-count` | Set absolute on-hand |
| POST | `/api/inventory/adjust` | Relative +/- adjust |

### Transfer orders (Square Transfer Orders API)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transfer-orders` | Search |
| POST | `/api/transfer-orders` | Create (`DRAFT`) |
| GET | `/api/transfer-orders/:id` | Get |
| POST | `/api/transfer-orders/:id/start` | Start (moves stock out of source) |
| POST | `/api/transfer-orders/:id/receive` | Receive at destination |
| POST | `/api/transfer-orders/:id/cancel` | Cancel |
| DELETE | `/api/transfer-orders/:id` | Delete draft |

### Purchase orders (local + Square sync on receive)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchase-orders` | List (`?status=&vendorId=&q=`) |
| POST | `/api/purchase-orders` | Create (`DRAFT`) |
| GET | `/api/purchase-orders/:id` | Get PO |
| PATCH | `/api/purchase-orders/:id` | Update PO |
| DELETE | `/api/purchase-orders/:id` | Delete `DRAFT`/`CANCELLED` |
| POST | `/api/purchase-orders/:id/lines` | Add line |
| PATCH | `/api/purchase-orders/:id/lines/:lineId` | Update line |
| DELETE | `/api/purchase-orders/:id/lines/:lineId` | Remove line |
| POST | `/api/purchase-orders/:id/submit` | `DRAFT` → `ORDERED` |
| POST | `/api/purchase-orders/:id/cancel` | Cancel |
| POST | `/api/purchase-orders/:id/reopen` | Reopen cancelled |
| POST | `/api/purchase-orders/:id/receive` | Receive → Square inventory |

PO statuses: `DRAFT` → `ORDERED` → `PARTIAL` / `RECEIVED` (or `CANCELLED`).

## Quick PO flow

```bash
# 1) pick a variationId
curl http://localhost:3000/api/catalog/items

# 2) create + submit + receive
curl -X POST http://localhost:3000/api/purchase-orders \
  -H 'Content-Type: application/json' \
  -d '{"vendorName":"Acme","lines":[{"catalogObjectId":"VARIATION_ID","quantityOrdered":10,"unitCost":5}]}'

curl -X POST http://localhost:3000/api/purchase-orders/PO_ID/submit
curl -X POST http://localhost:3000/api/purchase-orders/PO_ID/receive -H 'Content-Type: application/json' -d '{}'

curl 'http://localhost:3000/api/inventory/counts/VARIATION_ID'
```

## Notes

- Use Sandbox tokens (`SQUARE_ENVIRONMENT=sandbox`).
- Cost/vendor on inventory receive needs Square Retail+/Restaurants+; the app falls back to quantity-only.
- Transfer needs multiple locations in the Square account.
- PO data is demo-local JSON; swap the store for a DB in production.
- Sales values are returned in smallest currency units (for USD, cents).
