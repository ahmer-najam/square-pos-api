function squareError(err) {
  const errors = err?.errors || [];
  const statusCode = err?.statusCode || err?.status || 502;

  if (errors.length) {
    return {
      message: errors.map((e) => e.detail || e.code || e.category).join("; "),
      errors,
      statusCode,
    };
  }

  return {
    message: err?.message || "Square API request failed",
    errors: [],
    statusCode: err?.statusCode || err?.status || 500,
  };
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function moneyToCents(amount) {
  if (amount == null) return null;
  if (typeof amount === "number") {
    return Math.round(amount * 100);
  }
  const parsed = Number(amount);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

module.exports = {
  squareError,
  asyncHandler,
  moneyToCents,
};
