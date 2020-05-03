module.exports = async (msg,bot) => {
	if(msg.author.bot) return;
	if(bot.blacklist.includes(msg.author.id)) return;
	let guild = msg.channel.guild;
	let cfg = await bot.getConfig(guild);
	if (msg.content.startsWith(cfg.prefix) && (!guild || (!(await bot.db.isBlacklisted(guild.id,msg.channel.id,false)) || msg.member.permission.has("manageGuild")))) {
		let content = msg.content.substr(cfg.prefix.length).trim();
		let args = content.split(/\s+/g);
		let cmd = bot.cmds[args.shift()];
		if(cmd && bot.checkPermissions(cmd,msg,args)) {
			let noPerms = false;
			if(msg.channel.type != 1) {
				let perms = msg.channel.permissionsOf(bot.user.id);
				if(!perms.has("readMessages") || !perms.has("sendMessages")) {
					noPerms = true;
				}
			}
			if(cmd.groupArgs) args = bot.getMatches(content,/“(.+?)”|‘(.+?)’|"(.+?)"|'(.+?)'|(\S+)/gi).slice(1);
			let targetChannel = msg.channel;
			if(noPerms) {
				try {
					targetChannel = await bot.getDMChannel(msg.author.id);
				} catch(e) {
					if(e.code != 50007) bot.err(msg,e,false);
					return;
				}
			}
			try {
				let output = await cmd.execute(bot, msg, args, cfg);
				if(output && (typeof output == "string" || output.embed)) {
					if(noPerms) {
						let add = "This message sent to you in DM because I am lacking permissions to send messages in the original channel.";
						if(output.embed) output.content = add;
						else output += "\n" + add;
					}
					try {
						await bot.send(targetChannel,output,null,true,msg.author);
					} catch(e) {
						if(e.code != 50013) throw e;
					}
				}
			} catch(e) { 
				bot.err(msg,e);
			}
		}
		return;
	}
	if(bot.dialogs[msg.channel.id + msg.author.id]) {
		bot.dialogs[msg.channel.id+msg.author.id](msg);
		delete bot.dialogs[msg.channel.id+msg.author.id];
	}
	if(msg.channel.guild && (!msg.channel.permissionsOf(bot.user.id).has("readMessages") || !msg.channel.permissionsOf(bot.user.id).has("sendMessages"))) return;
	let members = (await bot.db.query("SELECT * FROM Members WHERE user_id = $1 ORDER BY position", [msg.author.id])).rows;
	if(members[0] && !(msg.channel.type == 1)) {
		let clean = msg.cleanContent || msg.content;
		clean = clean.replace(/(<a?:.+?:\d+?>)|(<@!?\d+?>)/,"cleaned");
		let cleanarr = clean.split("\n");
		let lines = msg.content.split("\n");
		let replace = [];
		let current = null;
		for(let i = 0; i < lines.length; i++) {
			let found = false;
			members.forEach(t => {
				let res = bot.checkMember(msg, t, cleanarr[i]);
				if(res >= 0) {
					if(t.brackets[res*2+1].length == 0) current = t;
					else current = null;
					found = true;
					replace.push([msg,cfg,t,t.show_brackets ? lines[i] : lines[i].substring(t.brackets[res*2].length, lines[i].length-t.brackets[res*2+1].length)]);
				}
			});
			if(!found && current) 
				replace[replace.length-1][3] += "\n"+lines[i];
		}
	
		if(replace.length < 2) replace = [];
	
		if(!replace[0]) {
			for(let t of members) {
				let res = bot.checkMember(msg, t, clean);
				if(res >= 0) {
					replace.push([msg, cfg, t, t.show_brackets ? msg.content : msg.content.substring(t.brackets[res*2].length, msg.content.length-t.brackets[res*2+1].length)]);
					break;
				}
			}
		}
	
		if(replace[0] && (!guild || !(await bot.db.isBlacklisted(guild.id,msg.channel.id,true)))) {
			try {
				if(replace.length > 7) {
					//console.log(`Potential abuse by ${msg.author.id} - ${replace.length} proxies at once in ${msg.channel.id}!`);
					return bot.send(msg.channel, `Proxy refused: too many proxies in one message! The proxy limit has been reduced to 3 due to constant abuse, sorry!`);
				}
				for(let r of replace) {
					await bot.replaceMessage(...r);
				}
				let perms = msg.channel.permissionsOf(bot.user.id);
				if(perms.has("manageMessages") && perms.has("readMessages"))
					process.send({name: "queueDelete", channelID: msg.channel.id, messageID: msg.id}, null, {swallowErrors: false}, err => {
						if(err) console.log(err)
					});
			} catch(e) { 
				if(e.message == "Cannot Send Empty Message") bot.send(msg.channel, "Cannot proxy empty message.");
				else if(e.permission == "Manage Webhooks") bot.send(msg.channel, "Proxy failed because I don't have 'Manage Webhooks' permission in this channel.");
				else if(e.message == "toolarge") bot.send(msg.channel, "Message not proxied because bots can't send attachments larger than 8mb. Sorry!");
				else if(e.message == "autoban") {
					if(e.notify) bot.send(msg.channel, "Proxies refused due to spam!");
					console.log(`Potential spam by ${msg.author.id}!`);
				} else if(e.code != 10008) bot.err(msg, e); //discard "Unknown Message" errors
			}
		}
	}
};
