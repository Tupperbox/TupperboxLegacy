module.exports = {
	help: cfg => "Get the bot's invite URL",
	usage: cfg =>  ["invite - sends the bot's oauth2 URL in this channel"],
	permitted: (msg) => true,
	execute: (bot, msg, args, cfg) => {
		return `https://discordapp.com/oauth2/authorize?client_id=431544605209788416&scope=bot&permissions=536996928`;
	}
};