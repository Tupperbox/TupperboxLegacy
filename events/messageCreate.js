module.exports = async (msg,bot) => {
	if(msg.author.bot) return;
	let cfg;
	let guild = msg.channel.guild;
	if(guild) cfg = await bot.db.getCfg(guild.id);
	if(!cfg) cfg = { prefix: "tul!", lang: "tulpa"};
	if (msg.content.startsWith(cfg.prefix) && (!guild || (!(await bot.db.isBlacklisted(guild.id,msg.channel.id,false)) || msg.member.permission.has("manageGuild")))) {
		let content = msg.content.substr(cfg.prefix.length).trim();
		let args = content.split(" ");
		let cmd = bot.cmds[args.shift()];
		if(cmd && bot.checkPermissions(cmd,msg,args)) {
			if(cmd.groupArgs) args = bot.getMatches(content,/['](.*?)[']|(\S+)/gi).slice(1);
			try {
				let output = await cmd.execute(bot, msg, args, cfg);
				if(output && (typeof output == "string" || output.embed)) await bot.send(msg.channel,output);
			} catch(e) { 
				if(e.name == "PermissionsError") {
					let errorMsg = `This message was sent to you in DMs because I am lacking '${e.permission}' permissions in the channel you ran the command.`;
					if(e.original.embed) e.original.content = errorMsg;
					else e.original += `\n${errorMsg}`;
					try {
						await bot.send(await msg.author.getDMChannel(), e.original);
					} catch(e) {
						if(e.code != 50007) bot.err(msg,e);
					}
				}
				else bot.err(msg,e);
			}
		}
		return;
	}
	if(bot.dialogs[msg.channel.id + msg.author.id]) {
		bot.dialogs[msg.channel.id+msg.author.id](msg);
		delete bot.dialogs[msg.channel.id+msg.author.id];
	}
	let tulpae = (await bot.db.query("SELECT * FROM Members WHERE user_id = $1 ORDER BY position", [msg.author.id])).rows;
	if(tulpae[0] && !(msg.channel.type == 1) && (!guild || !(await bot.db.isBlacklisted(guild.id,msg.channel.id,true)))) {
		let clean = msg.cleanContent || msg.content;
		clean = clean.replace(/(<a?:.+?:\d+?>)|(<@!?\d+?>)/,"cleaned");
		let cleanarr = clean.split("\n");
		let lines = msg.content.split("\n");
		let replace = [];
		let current = null;
		for(let i = 0; i < lines.length; i++) {
			let found = false;
			tulpae.forEach(t => {
				let res = bot.checkTulpa(msg, t, cleanarr[i]);
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
			for(let t of tulpae) {
				let res = bot.checkTulpa(msg, t, clean);
				if(res >= 0) {
					replace.push([msg, cfg, t, t.show_brackets ? msg.content : msg.content.substring(t.brackets[res*2].length, msg.content.length-t.brackets[res*2+1].length)]);
					break;
				}
			}
		}
	
		if(replace[0]) {
			try {
				for(let r of replace) {
					await bot.replaceMessage(...r);
				}
				if(msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
					await msg.delete();
			} catch(e) { 
				if(e.permission) bot.send(msg.channel, `Unable to process proxy due to missing permission: '${e.permission}'`);
				else if(e.message == "Cannot Send Empty Message") bot.send(msg.channel, `Cannot proxy empty message.`);
				else if(e.message = "toolarge") bot.send(msg.channel, "Message not proxied because bots can't send attachments larger than 8mb. Sorry!");
				else if(e.code != 10008 && e.code != 500 && e.code != 50001) bot.err(msg, e); 
			}
		}
	}
};