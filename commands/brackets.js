const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s brackets",
	usage: cfg =>  ["brackets <name> [brackets] - if brackets are given, change the " + cfg.lang + "'s brackets, if not, simply echo the current one"],
	desc: cfg => "Brackets must be the word 'text' surrounded by any symbols or letters, i.e. `[text]` or `>>text`",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["brackets"], cfg);
		}
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			out = `Brackets for ${args[0]}: ${tulpa.brackets[0]}text${tulpa.brackets[1]}`;
		} else {
			let brackets = msg.content.slice(msg.content.indexOf(args[0])+args[0].length+1).trim().split("text");
			if(brackets.length < 2) {
				out = "No 'text' found to detect brackets with. For the last part of your command, enter the word 'text' surrounded by any characters.\nThis determines how the bot detects if it should replace a message.";
			} else if(!brackets[0] && !brackets[1]) {
				out = "Need something surrounding 'text'.";
			} else {
				await bot.db.updateTulpa(msg.author.id,args[0],"brackets",brackets);
				out = "Brackets updated successfully.";
			}
		}
		bot.send(msg.channel, out);
	}
};