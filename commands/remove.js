const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Unregister " + article(cfg) + " " + cfg.lang + "",
	usage: cfg =>  ["remove <name> - Unregister the named " + cfg.lang + " from your list"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["remove"], cfg);
		
		//check arguments
		let name = args.join(" ");
		let tulpa = await bot.db.getTulpa(msg.author.id,name);
		if(!tulpa) return "Could not find " + cfg.lang + " with that name registered under your account.";
		
		//delete
		await bot.db.deleteTulpa(msg.author.id,name);
		return proper(cfg.lang) + " unregistered.";
	}
};