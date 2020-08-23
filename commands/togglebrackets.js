const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Toggles whether the brackets are included or stripped in proxied messages for the given " + cfg.lang,
	usage: cfg =>  ["togglebrackets <name> - toggles showing brackets on or off for the given " + cfg.lang],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["togglebrackets"], cfg);
		
		//check arguments
		let member = await bot.db.members.get(msg.author.id,args[0]);
		if(!member) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		
		//update member
		await bot.db.members.update(msg.author.id,args[0],"show_brackets",!member.show_brackets);
		return `Now ${member.show_brackets ? "hiding" : "showing"} brackets in proxied messages for ${member.name}.`;
	}
};