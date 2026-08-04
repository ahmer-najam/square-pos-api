const { SquareClient, SquareEnvironment } = require("square");
const config = require("./config");

const environment =
  config.square.environment === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

const squareClient = new SquareClient({
  token: config.square.accessToken,
  environment,
});

module.exports = { squareClient, SquareEnvironment };
