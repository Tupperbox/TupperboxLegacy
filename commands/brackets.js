const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s brackets",
	usage: cfg =>  ["brackets <name> [brackets] - if brackets are given, change the " + cfg.lang + "'s brackets, if not, simply echo the current ones",
		"brackets add <name> <brackets> - add another set of brackets to proxy with",
		"brackets remove <name> <brackets> - remove a set of brackets, unless it's the last one"],
	desc: cfg => "Brackets must be the word 'text' surrounded by any symbols or letters, i.e. `[text]` or `>>text`",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["brackets"], cfg);

		//check arguments
		let name = (args[0] == "add" || args[0] == "remove") ? args[1] : args[0];
		let tulpa = await bot.db.getTulpa(msg.author.id,name);
		if(!tulpa) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(!args[1]) return `Brackets for ${args[0]}: ${bot.getBrackets(tulpa)}`;
		let brackets = msg.content.slice(msg.content.indexOf(name)+name.length+1).trim().split("text");
		if(brackets.length < 2) return "No 'text' found to detect brackets with. For the last part of your command, enter the word 'text' surrounded by any characters.\nThis determines how the bot detects if it should replace a message.";
		if(!brackets[0] && !brackets[1]) return "Need something surrounding 'text'.";
		if(args[0] == "add") {
			tulpa.brackets = tulpa.brackets.concat(brackets);
			await bot.db.updateTulpa(msg.author.id,tulpa.name,"brackets",tulpa.brackets);
			return "Brackets added.";
		} else if(args[0] == "remove") {
			let index = -1;
			for(let i=0; i<tulpa.brackets.length; i+=2) {
				if(tulpa.brackets[i] == brackets[0] && tulpa.brackets[i+1] == brackets[1]) {
					index = i;
					break;
				}
			}
			if(index < 0) return "No matching brackets found.";
			if(tulpa.brackets.length < 3) return "Cannot remove last brackets.";
			tulpa.brackets = tulpa.brackets.slice(0,index).concat(tulpa.brackets.slice(index+2));
			await bot.db.updateTulpa(msg.author.id,tulpa.name,"brackets",tulpa.brackets);
			return "Brackets removed.";
		}

		//update tulpa
		await bot.db.updateTulpa(msg.author.id,tulpa.name,"brackets",brackets);
		return "Brackets set successfully.";
	}
};