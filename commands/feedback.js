module.exports = {
	help: cfg => "Get a link to the official support server!",
	usage: cfg => ["feedback - get a link to the support server"],
	permitted: msg => true,
	execute: (bot, msg, args, cfg) => {
		return "https://discord.gg/6WF6Z5m";
	}
};