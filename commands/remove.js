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
			try {
				await bot.send(msg.channel, `Warning: This will remove ALL of your ${cfg.lang}s. Reply 'yes' to continue or anything else to cancel.`);
				let response = await bot.waitMessage(msg);
				if(response.content.toLowerCase() != "yes") return "Canceling operation.";
			} catch(e) {
				if(e == "timeout") return "Response timed out. Canceling.";
				else throw e;
			}
			await bot.db.query("DELETE FROM Members WHERE user_id = $1",[msg.author.id]);
			return `All ${cfg.lang}s removed.`;
		}
		let name = args.join(" ");
		let tulpa = await bot.db.getTulpa(msg.author.id,name);
		if(!tulpa) return "Could not find " + cfg.lang + " with that name registered under your account.";
		
		//delete
		await bot.db.deleteTulpa(msg.author.id,name);
		return proper(cfg.lang) + " unregistered.";
	}
};