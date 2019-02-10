module.exports = {
	help: cfg => "Like list, but without showing group info.",
	usage: cfg =>  ["list [user] - Sends a list of the user's registered " + cfg.lang + "s, their brackets, post count, and birthday (if set). If user is not specified it defaults to the message author. If 'all' or '*' is given, gives a short form list of all tuppers in the server."],
	permitted: () => true,
	execute: async (bot, msg, args, cfg) => {
		return bot.cmds.list.execute(bot,msg,args,cfg,true);
	}
};