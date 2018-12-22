const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Change " + article(cfg) + " " + cfg.lang + "'s name",
	usage: cfg =>  ["rename <name> <newname> - Set a new name for the " + cfg.lang + ""],
	permitted: () => true,
	execute: (bot, msg, args, cfg) => {
		let out = "";
		args = bot.getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["rename"], cfg);
		} else if(!args[1]) {
			out = "Missing argument 'newname'.";
		} else if(args[1].length < 2 || args[1].length > 28) {
			out = "New name must be between 2 and 28 characters.";
		} else if(!bot.tulpae[msg.author.id] || !bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[1].toLowerCase() && t.name.toLowerCase() != args[0].toLowerCase())) {
			out = "You already have " + article(cfg) + " " + cfg.lang + " with that new name.";
		} else {
			bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).name = args[1];
			out = proper(cfg.lang) + " renamed successfully.";
		}
		bot.send(msg.channel, out);
	}
};