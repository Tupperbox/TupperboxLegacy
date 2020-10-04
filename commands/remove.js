const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Unregister " + article(cfg) + " " + cfg.lang + "",
	usage: cfg =>  ["remove <name> - Unregister the named " + cfg.lang + " from your list",
		"remove * - Unregister ALL of your " + cfg.lang + "s (requires confirmation)"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg, members) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["remove"], cfg);

		//check arguments
		if(args[0] == "*") {
			if (members.length == 0) return "You don't have anything to remove.";
			let confirm = await bot.confirm(msg, `Warning: This will remove ALL of your ${cfg.lang}s. Reply 'yes' to continue or anything else to cancel.`);
			if (confirm !== true) return confirm;
			await bot.db.members.clear(msg.author.id);
			return `All ${cfg.lang}s removed.`;
		}
		else if (args.length == 1) {
			let name = args.join(" ");
			let member = await bot.db.members.get(msg.author.id,name);
			if(!member) return `You don't have ${article(cfg)} ${cfg.lang} named '${name}' registered.`;
			await bot.db.members.delete(msg.author.id, name);
			return proper(cfg.lang) + " unregistered.";
		} else {
			let removedMessage = `${proper(cfg.lang)}s removed:`;
			let notRemovedMessage = `${proper(cfg.lang)}s not found:`;
			let baseLength = 2000 - (removedMessage.length + notRemovedMessage.length);
			let rOriginalLength = { removedMessage: removedMessage.length, notRemovedMessage: notRemovedMessage.length, };

			for (let arg of args) {
				let tup = await bot.db.members.get(msg.author.id, arg);
				if (tup) {
					await bot.db.members.delete(msg.author.id, arg);
					if ((removedMessage.length + notRemovedMessage.length + arg.length) < baseLength) removedMessage += ` '${arg}'`; else removedMessage += " (...)";
				} else {
					if ((removedMessage.length + notRemovedMessage.length + arg.length) < baseLength) notRemovedMessage += ` '${arg}'`; else notRemovedMessage += " (...)";
				}
			}
			if (removedMessage.length == rOriginalLength.removedMessage) return `No ${cfg.lang}s found.`;
			if (notRemovedMessage.length == rOriginalLength.notRemovedMessage) return removedMessage;
			return `${removedMessage}\n${notRemovedMessage}`;
		}
	}
};