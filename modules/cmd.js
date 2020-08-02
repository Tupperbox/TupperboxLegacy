module.exports = async (ctx) => {
	if(ctx.msg.content == `<@${ctx.bot.user.id}>` || ctx.msg.content == `<@!${ctx.bot.user.id}>`) {
		await ctx.bot.send(ctx.msg.channel,
			`Hello! ${ctx.msg.channel.guild ? "This server's" : "My"} prefix is \`${ctx.cfg.prefix}\`. Try \`${ctx.cfg.prefix}help\` for help${ctx.msg.channel.guild ? ` or \`${ctx.cfg.prefix}ctx.cfg prefix ${process.env.DEFAULT_PREFIX}\` to reset the prefix.` : "."}`
		);
	}
	if(ctx.msg.content.startsWith(ctx.cfg.prefix) && (!ctx.msg.channel.guild || (!(await ctx.bot.db.isBlacklisted(ctx.msg.channel.guild.id,ctx.msg.channel.id,false)) || ctx.msg.member.permission.has("manageGuild")))) {
		let content = ctx.msg.content.substr(ctx.cfg.prefix.length).trim();
		let args = content.split(" ");
		let cmdName = args.shift();
		let cmd = ctx.bot.cmds[cmdName];
		if(cmd && ctx.bot.checkPermissions(cmd,ctx.msg,args)) {
			let cooldownKey = ctx.msg.author.id + cmdName;
			if(ctx.bot.cooldowns[cooldownKey]) {
				return ctx.bot.send(ctx.msg.channel,`You're using that too quickly! Try again in ${Math.ceil((ctx.bot.cooldowns[cooldownKey] - Date.now())/1000)} seconds`);
			}
			let noPerms = false;
			if(ctx.msg.channel.type != 1) {
				let perms = ctx.msg.channel.permissionsOf(ctx.bot.user.id);
				if(!perms.has("readMessages") || !perms.has("sendMessages")) {
					noPerms = true;
				}
			}
			if(cmd.groupArgs) args = ctx.bot.getMatches(content,/“(.+?)”|‘(.+?)’|"(.+?)"|'(.+?)'|(\S+)/gi).slice(1);
			let targetChannel = ctx.msg.channel;
			if(noPerms) {
				try {
					targetChannel = await ctx.bot.getDMChannel(ctx.msg.author.id);
				} catch(e) {
					if(e.code != 50007) ctx.bot.err(ctx.msg,e,false);
					return;
				}
			}
			try {
				let output = await cmd.execute(ctx.bot, ctx.msg, args, ctx.cfg, ctx.members);
				if(cmd.cooldown) {
					let cd = cmd.cooldown(ctx.msg);
					setTimeout(() => ctx.bot.cooldowns[cooldownKey] = null,cd);
					ctx.bot.cooldowns[cooldownKey] = Date.now()+cd;
				}
				if(output && (typeof output == "string" || output.embed)) {
					if(noPerms) {
						let add = "This message sent to you in DM because I am lacking permissions to send messages in the original channel.";
						if(output.embed) output.content = add;
						else output += "\n" + add;
					}
					try {
						await ctx.bot.send(targetChannel,output,null,true,ctx.msg.author);
					} catch(e) {
						if(e.code != 50013) throw e;
					}
				}
			} catch(e) { 
				ctx.bot.err(ctx.msg,e);
			}
		}
		return;
	}
	if(ctx.bot.dialogs[ctx.msg.channel.id + ctx.msg.author.id]) {
		ctx.bot.dialogs[ctx.msg.channel.id+ctx.msg.author.id](ctx.msg);
		delete ctx.bot.dialogs[ctx.msg.channel.id+ctx.msg.author.id];
	}
}