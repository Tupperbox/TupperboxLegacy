const cache = require("../modules/redis");

module.exports = async ({msg, bot, members, cfg, dmChannel}) => {

	let targetChannel = dmChannel || msg.channel;
	let content = msg.content.substr(cfg.prefix.length).trim();
	let args = content.split(" ");
	let cmdName = args.shift();
	let cmd = bot.cmds[cmdName];

	if (!cmd || !bot.checkPermissions(bot, cmd, msg, args)) return;

	let key = msg.author.id + cmdName;
	let cd = await cache.cooldowns.get(key);
	if (cd) return bot.send(msg.channel,`You're using that too quickly! Try again in ${Math.ceil((cd - Date.now())/1000)} seconds`);
	if(cmd.cooldown) cache.cooldowns.set(key, cmd.cooldown(msg));

	if(cmd.groupArgs) args = bot.getMatches(content,/“(.+?)”|‘(.+?)’|"(.+?)"|'(.+?)'|(\S+)/gi).slice(1);

	try {
		let output = await cmd.execute(bot, msg, args, cfg, members);
		if(output && (typeof output == "string" || output.embed)) {
			if(dmChannel) {
				let add = "This message sent to you in DM because I am lacking permissions to send messages in the original channel.";
				if(output.embed) output.content = add;
				else output += "\n" + add;
			}
			bot.send(targetChannel,output,null,true,msg.author);
		}
	} catch(e) { 
		bot.err(msg,e);
	}

};