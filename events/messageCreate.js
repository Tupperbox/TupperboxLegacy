module.exports = bot => {
	bot.on("messageCreate", async function (msg) {
		if(msg.author.bot) return;
		let cfg = msg.channel.guild && bot.config[msg.channel.guild.id] || { prefix: "tul!", rolesEnabled: false, lang: "tulpa"};
		if (msg.content.startsWith(cfg.prefix) && (!cfg.cmdblacklist || !cfg.cmdblacklist.includes(msg.channel.id))) {
			var args = msg.content.substr(cfg.prefix.length).split(" ");
			var cmd = args.shift();
			if(bot.cmds[cmd] && bot.checkPermissions(cmd,msg,args)) {
				bot.logger.info(`${msg.channel.guild ? msg.channel.guild.id + "###" : "DM###"}${msg.author.id}###${msg.content}`);
				return bot.cmds[cmd].execute(bot, msg, args, cfg);
			}
		} else if(bot.tulpae[msg.author.id] && !(msg.channel.type == 1) && (!cfg.blacklist || !cfg.blacklist.includes(msg.channel.id))) {
			let clean = msg.cleanContent || msg.content;
			clean = clean.replace(/(<:.+?:\d+?>)|(<@!?\d+?>)/,"cleaned");
			let cleanarr = clean.split("\n");
			let lines = msg.content.split("\n");
			let replace = [];
			let current = null;
			for(let i = 0; i < lines.length; i++) {
				let found = false;
				bot.tulpae[msg.author.id].forEach(t => {
					if(bot.checkTulpa(msg, t, cleanarr[i])) {
						if(t.brackets[1].length == 0) current = t;
						else current = null;
						found = true;
						replace.push([msg,cfg,t,t.showbrackets ? lines[i] : lines[i].substring(t.brackets[0].length, lines[i].length-t.brackets[1].length)]);
					}
				});
				if(!found && current) 
					replace[replace.length-1][3] += "\n"+lines[i];
			}
      
			if(replace.length < 2) replace = [];
      
			if(!replace[0]) {
				for(let t of bot.tulpae[msg.author.id]) {
					if(bot.checkTulpa(msg, t, clean)) {
						replace.push([msg, cfg, t, t.showbrackets ? msg.content : msg.content.substring(t.brackets[0].length, msg.content.length-t.brackets[1].length)]);
						break;
					}
				}
			}
        
			if(replace[0]) {
				Promise.all(replace.map(r => bot.replaceMessage(...r)))
					.then(() => {
						if(msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
							msg.delete().catch(e => { if(e.code == 50013) { bot.send(msg.channel, "Warning: I'm missing permissions needed to properly replace messages."); }});
            
					}).catch(e => bot.send(msg.channel, e.toString()));
			}
		}
	});
};