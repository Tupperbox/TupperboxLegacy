const logger = require("winston");
const util = require("util");

logger.configure({
	level: "debug",
	transports: [
		new logger.transports.Console(),
		new logger.transports.File({ filename: "output.log" })
	],
	format: logger.format.combine(
		logger.format((info) => {info.message = util.format(info.message); return info; })(),
		logger.format.colorize(),
		logger.format.printf(info => `${info.level}###${new Date().toUTCString()}###${info.message}`)
	)
});

module.exports = logger;