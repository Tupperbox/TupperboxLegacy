const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Change " + article(cfg) + " " + cfg.lang + "'s name",
	usage: cfg =>  ["rename <name> <newname> - Set a new name for the " + cfg.lang + ""],
	desc: cfg => "Use single or double quotes around multi-word names `\"like this\"` or `'like this'`.",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["rename"], cfg);

		//check arguments
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!args[1]) return "Missing argument 'newname'.";
		let newTulpa = await bot.db.getTulpa(msg.author.id,args[1]);
		if(args[1].length < 2 || args[1].length > 28) return "New name must be between 2 and 28 characters.";
		if(!tulpa) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(newTulpa) return "You already have " + article(cfg) + " " + cfg.lang + " with that new name.";
		
		//update tulpa
		await bot.db.updateTulpa(msg.author.id,args[0],"name",bot.noVariation(args[1]));
		return proper(cfg.lang) + " renamed successfully.";
	}
};