const cache = require("../modules/redis");

const dialogStuff = (bot, msg) => {
	if(bot.dialogs[msg.channel.id + msg.author.id]) {
		bot.dialogs[msg.channel.id+msg.author.id](msg);
		delete bot.dialogs[msg.channel.id+msg.author.id];
		return "dialogs";
	}
	return false;
}

module.exports = async ({msg,bot,members,cfg,dmChannel}) => {
	if(msg.content == `<@${bot.user.id}>` || msg.content == `<@!${bot.user.id}>`) {
		bot.send(msg.channel,
			`Hello! ${msg.channel.guild ? "This server's" : "My"} prefix is \`${cfg.prefix}\`. Try \`${cfg.prefix}help\` for help${msg.channel.guild ? ` or \`${cfg.prefix}cfg prefix ${process.env.DEFAULT_PREFIX}\` to reset the prefix.` : "."}`
		);
		return false;
	}

	if(!msg.content.startsWith(cfg.prefix)) return dialogStuff(bot, msg);

	let targetChannel = dmChannel || msg.channel;
	let content = msg.content.substr(cfg.prefix.length).trim();
	let args = content.split(" ");
	let cmdName = args.shift();
	let cmd = bot.cmds[cmdName];

	if (!(cmd && bot.checkPermissions(cmd,msg,args))) return false;

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
}
