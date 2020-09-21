const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Unregister " + article(cfg) + " " + cfg.lang + "",
	usage: cfg =>  ["remove <name> - Unregister the named " + cfg.lang + " from your list",
		"remove * - Unregister ALL of your " + cfg.lang + "s (requires confirmation)"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["remove"], cfg);

		//check arguments
		if(args[0] == "*") {
			let confirm = await bot.confirm(msg, `Warning: This will remove ALL of your ${cfg.lang}s. Reply 'yes' to continue or anything else to cancel.`);
			if (confirm !== true) return confirm;
			await bot.db.members.clear(msg.author.id);
			return `All ${cfg.lang}s removed.`;
		}
		let name = args.join(" ");
		let member = await bot.db.members.get(msg.author.id,name);
		if(!member) return "Could not find " + cfg.lang + " with that name registered under your account.";
		
		//delete
		await bot.db.members.delete(msg.author.id,name);
		return proper(cfg.lang) + " unregistered.";
	}
};