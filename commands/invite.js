const auth = require("../auth.json");

module.exports = {
	help: cfg => "Get the bot's invite URL",
	usage: cfg =>  ["invite - sends the bot's oauth2 URL in this channel"],
	permitted: (msg) => true,
	execute: (bot, msg, args, cfg) => {
		bot.send(msg.channel, `https://discordapp.com/api/oauth2/authorize?client_id=${auth.inviteCode}&permissions=805432384&scope=bot`);
	}
};