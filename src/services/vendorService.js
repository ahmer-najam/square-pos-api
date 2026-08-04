const { v4: uuidv4 } = require("uuid");
const { squareClient } = require("../squareClient");
const { squareError } = require("../utils");

async function searchVendors({ query, limit = 50, cursor } = {}) {
  try {
    const body = {
      limit,
      cursor,
    };

    if (query) {
      body.query = {
        filter: {
          name: [query],
        },
      };
    }

    const response = await squareClient.vendors.search(body);
    return {
      vendors: response.vendors || [],
      cursor: response.cursor || null,
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getVendor(vendorId) {
  try {
    const response = await squareClient.vendors.get({ vendorId });
    return response.vendor || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function createVendor({ name, email, phone, note, address } = {}) {
  if (!name) {
    throw Object.assign(new Error("name is required"), { statusCode: 400 });
  }

  try {
    const response = await squareClient.vendors.create({
      idempotencyKey: uuidv4(),
      vendor: {
        name,
        note: note || undefined,
        address: address || undefined,
        contacts: email || phone
          ? [
              {
                emailAddress: email || undefined,
                phoneNumber: phone || undefined,
                name,
                ordinal: 1,
              },
            ]
          : undefined,
      },
    });
    return response.vendor || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function updateVendor(vendorId, { name, email, phone, note, address, version } = {}) {
  const existing = await getVendor(vendorId);
  if (!existing) {
    throw Object.assign(new Error("Vendor not found"), { statusCode: 404 });
  }

  try {
    const response = await squareClient.vendors.update({
      vendorId,
      body: {
        idempotencyKey: uuidv4(),
        vendor: {
          id: vendorId,
          version: version ?? existing.version,
          name: name !== undefined ? name : existing.name,
          note: note !== undefined ? note : existing.note,
          address: address !== undefined ? address : existing.address,
          contacts:
            email || phone
              ? [
                  {
                    emailAddress: email || undefined,
                    phoneNumber: phone || undefined,
                    name: name || existing.name,
                    ordinal: 1,
                  },
                ]
              : existing.contacts,
        },
      },
    });
    return response.vendor || null;
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

module.exports = {
  searchVendors,
  getVendor,
  createVendor,
  updateVendor,
};
