require("dotenv").config();

const environment = (process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase();

const rawToken = process.env.SQUARE_ACCESS_TOKEN || "";
const accessToken =
  !rawToken || rawToken === "your_sandbox_access_token" ? "" : rawToken;

const config = {
  port: Number(process.env.PORT) || 3000,
  square: {
    applicationId: process.env.SQUARE_APPLICATION_ID || "",
    accessToken,
    environment,
    locationId: process.env.SQUARE_LOCATION_ID || "",
  },
  dataDir: require("path").join(__dirname, "..", "data"),
};

if (!config.square.accessToken) {
  console.warn(
    "[config] SQUARE_ACCESS_TOKEN is not set. Copy .env.example to .env and add your Square sandbox token."
  );
}

module.exports = config;
