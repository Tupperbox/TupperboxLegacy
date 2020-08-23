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
		let member = await bot.db.members.get(msg.author.id,args[0]);
		if(!args[1]) return "Missing argument 'newname'.";
		let newname = bot.sanitizeName(args[1]);
		let newMember = await bot.db.members.get(msg.author.id,newname);
		if(newname.length < 1 || newname.length > 76) return "New name must be between 1 and 76 characters.";
		if(!member) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(newMember && newMember.id != member.id) return "You already have " + article(cfg) + " " + cfg.lang + " with that new name.";
		
		//update member
		await bot.db.members.update(msg.author.id,args[0],"name",newname);
		return proper(cfg.lang) + " renamed successfully.";
	}
};
