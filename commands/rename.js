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
		let member = await bot.db.getMember(msg.author.id,args[0]);
		if(!args[1]) return "Missing argument 'newname'.";
		let newMember = await bot.db.getMember(msg.author.id,args[1]);
		if(args[1].length < 1 || args[1].length > 76) return "New name must be between 1 and 76 characters.";
		if(!member) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(newMember) return "You already have " + article(cfg) + " " + cfg.lang + " with that new name.";
		
		//update member
		await bot.db.updateMember(msg.author.id,args[0],"name",bot.noVariation(args[1]));
		return proper(cfg.lang) + " renamed successfully.";
	}
};