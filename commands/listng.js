module.exports = {
	help: cfg => "Like list, but without showing group info.",
	usage: cfg =>  ["list [user] - Sends a list of the user's registered " + cfg.lang + "s, their brackets, post count, and birthday (if set). If user is not specified it defaults to the message author. If user is not specified it defaults to the message author.\nThe bot will provide reaction emoji controls for navigating long lists: Arrows navigate through pages, # jumps to a specific page, ABCD jumps to a specific " + cfg.lang + ", and the stop button deletes the message"],
	permitted: () => true,
	execute: async (bot, msg, args, cfg) => {
		return bot.cmds.list.execute(bot,msg,args,cfg,true);
	}
};
