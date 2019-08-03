module.exports = {
	help: cfg => "Get the bot's invite URL",
	usage: cfg =>  ["invite - sends the bot's oauth2 URL in this channel"],
	permitted: (msg) => true,
	execute: (bot, msg, args, cfg) => {
		return `https://discordapp.com/oauth2/authorize?client_id=${process.env.DISCORD_INVITE}&scope=bot&permissions=536996928`;
	}
};