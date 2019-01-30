const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s brackets",
	usage: cfg =>  ["brackets <name> [brackets] - if brackets are given, change the " + cfg.lang + "'s brackets, if not, simply echo the current one"],
	desc: cfg => "Brackets must be the word 'text' surrounded by any symbols or letters, i.e. `[text]` or `>>text`",
	permitted: () => true,
	execute: (bot, msg, args, cfg) => {
		let out = "";
		args = bot.getMatches(msg.content.slice(cfg.prefix.length),/['](.*?)[']|(\S+)/gi).slice(1);
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["brackets"], cfg);
		} else if(!bot.tulpae[msg.author.id] || !bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			let brackets = bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).brackets;
			out = `Brackets for ${args[0]}: ${brackets[0]}text${brackets[1]}`;
		} else {
			let brackets = msg.content.slice(msg.content.indexOf(args[0])+args[0].length+1).trim().split("text");
			if(brackets.length < 2) {
				out = "No 'text' found to detect brackets with. For the last part of your command, enter the word 'text' surrounded by any characters.\nThis determines how the bot detects if it should replace a message.";
			} else if(!brackets[0] && !brackets[1]) {
				out = "Need something surrounding 'text'.";
			} else {
				bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).brackets = brackets;
				out = "Brackets updated successfully.";
			}
		}
		bot.send(msg.channel, out);
	}
};