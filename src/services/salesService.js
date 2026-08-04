const { squareClient } = require("../squareClient");
const { getDefaultLocationId } = require("./locationService");
const { squareError } = require("../utils");

function asNumber(amount) {
  if (amount == null) return 0;
  if (typeof amount === "bigint") return Number(amount);
  return Number(amount) || 0;
}

function startOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoISO(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function mapPayment(payment) {
  return {
    id: payment.id,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    status: payment.status,
    sourceType: payment.sourceType,
    locationId: payment.locationId,
    orderId: payment.orderId,
    referenceId: payment.referenceId,
    receiptNumber: payment.receiptNumber,
    receiptUrl: payment.receiptUrl,
    amountMoney: payment.amountMoney || null,
    tipMoney: payment.tipMoney || null,
    totalMoney: payment.totalMoney || null,
    refundedMoney: payment.refundedMoney || null,
  };
}

async function listSalesPayments({
  beginTime,
  endTime,
  locationId,
  cursor,
  limit = 50,
  sortOrder = "DESC",
  status,
} = {}) {
  try {
    const effectiveLocationId = locationId || (await getDefaultLocationId());
    const response = await squareClient.payments.list({
      beginTime: beginTime || daysAgoISO(30),
      endTime: endTime || new Date().toISOString(),
      locationId: effectiveLocationId,
      cursor: cursor || undefined,
      limit: Math.min(Math.max(Number(limit) || 50, 1), 100),
      sortOrder,
      sortField: "CREATED_AT",
    });

    let payments = (response.data || []).map(mapPayment);
    if (status) {
      const wanted = String(status).toUpperCase();
      payments = payments.filter((p) => String(p.status || "").toUpperCase() === wanted);
    }

    return {
      payments,
      cursor: response.response?.cursor || null,
      query: {
        beginTime: beginTime || daysAgoISO(30),
        endTime: endTime || new Date().toISOString(),
        locationId: effectiveLocationId,
        sortOrder,
        limit: Math.min(Math.max(Number(limit) || 50, 1), 100),
        status: status || null,
      },
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getSalesPayment(paymentId) {
  try {
    const response = await squareClient.payments.get({ paymentId });
    if (!response.payment) return null;
    return mapPayment(response.payment);
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

async function getSalesSummary({
  beginTime,
  endTime,
  locationId,
  sortOrder = "DESC",
} = {}) {
  try {
    const effectiveLocationId = locationId || (await getDefaultLocationId());
    const page = await squareClient.payments.list({
      beginTime: beginTime || startOfDayISO(),
      endTime: endTime || new Date().toISOString(),
      locationId: effectiveLocationId,
      limit: 100,
      sortOrder,
      sortField: "CREATED_AT",
    });

    const payments = [];
    for await (const payment of page) {
      payments.push(payment);
    }

    const byStatus = {};
    const byDay = {};
    let grossCents = 0;
    let tipCents = 0;
    let refundedCents = 0;
    let netCents = 0;

    for (const p of payments) {
      const total = asNumber(p.totalMoney?.amount);
      const tip = asNumber(p.tipMoney?.amount);
      const refunded = asNumber(p.refundedMoney?.amount);
      const net = total - refunded;
      const status = p.status || "UNKNOWN";
      const day = (p.createdAt || "").slice(0, 10) || "unknown";

      grossCents += total;
      tipCents += tip;
      refundedCents += refunded;
      netCents += net;

      byStatus[status] = (byStatus[status] || 0) + 1;
      byDay[day] = byDay[day] || {
        day,
        count: 0,
        grossAmount: 0,
        refundedAmount: 0,
        netAmount: 0,
      };
      byDay[day].count += 1;
      byDay[day].grossAmount += total;
      byDay[day].refundedAmount += refunded;
      byDay[day].netAmount += net;
    }

    const currency = payments[0]?.totalMoney?.currency || "USD";

    return {
      totals: {
        paymentCount: payments.length,
        grossAmount: grossCents,
        tipAmount: tipCents,
        refundedAmount: refundedCents,
        netAmount: netCents,
        currency,
      },
      byStatus,
      byDay: Object.values(byDay).sort((a, b) => String(a.day).localeCompare(String(b.day))),
      query: {
        beginTime: beginTime || startOfDayISO(),
        endTime: endTime || new Date().toISOString(),
        locationId: effectiveLocationId,
        sortOrder,
      },
    };
  } catch (err) {
    throw Object.assign(new Error(squareError(err).message), squareError(err));
  }
}

module.exports = {
  listSalesPayments,
  getSalesPayment,
  getSalesSummary,
};
