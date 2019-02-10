const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Toggles whether the brackets are included or stripped in proxied messages for the given " + cfg.lang,
	usage: cfg =>  ["togglebrackets <name> - toggles showing brackets on or off for the given " + cfg.lang],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["togglebrackets"], cfg);
		
		//check arguments
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		
		//update tulpa
		await bot.db.updateTulpa(msg.author.id,args[0],"show_brackets",!tulpa.show_brackets);
		return `Now ${tulpa.show_brackets ? "hiding" : "showing"} brackets in proxied messages for ${tulpa.name}.`;
	}
};