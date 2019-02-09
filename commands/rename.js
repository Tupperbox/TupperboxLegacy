const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Change " + article(cfg) + " " + cfg.lang + "'s name",
	usage: cfg =>  ["rename <name> <newname> - Set a new name for the " + cfg.lang + ""],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["rename"], cfg);
		} 
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		let newTulpa;
		if(args[1]) newTulpa = await bot.db.getTulpa(msg.author.id,args[1]);
		if(!args[1]) {
			out = "Missing argument 'newname'.";
		} else if(args[1].length < 2 || args[1].length > 28) {
			out = "New name must be between 2 and 28 characters.";
		} else if(!tulpa) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(newTulpa) {
			out = "You already have " + article(cfg) + " " + cfg.lang + " with that new name.";
		} else {
			await bot.db.updateTulpa(msg.author.id,args[0],"name",args[1]);
			out = proper(cfg.lang) + " renamed successfully.";
		}
		return bot.send(msg.channel, out);
	}
};