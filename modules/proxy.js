module.exports = async (ctx) => {
    if(ctx.msg.channel.guild && (!ctx.msg.channel.permissionsOf(ctx.bot.user.id).has("readMessages") || !ctx.msg.channel.permissionsOf(ctx.bot.user.id).has("sendMessages"))) return;
	if(ctx.members[0] && !(ctx.msg.channel.type == 1)) {
		let clean = ctx.msg.cleanContent || ctx.msg.content;
		clean = clean.replace(/(<a?:.+?:\d+?>)|(<@!?\d+?>)/,"cleaned");
		let cleanarr = clean.split("\n");
		let lines = ctx.msg.content.split("\n");
		let replace = [];
		let current = null;
		for(let i = 0; i < lines.length; i++) {
			let found = false;
			ctx.members.forEach(t => {
				let res = ctx.bot.checkMember(ctx.msg, t, cleanarr[i]);
				if(res >= 0) {
					if(t.brackets[res*2+1].length == 0) current = t;
					else current = null;
					found = true;
					replace.push([ctx.msg,ctx.cfg,t,t.show_brackets ? lines[i] : lines[i].substring(t.brackets[res*2].length, lines[i].length-t.brackets[res*2+1].length)]);
				}
			});
			if(!found && current) 
				replace[replace.length-1][3] += "\n"+lines[i];
		}
	
		if(replace.length < 2) replace = [];
	
		if(!replace[0]) {
			for(let t of ctx.members) {
				let res = ctx.bot.checkMember(ctx.msg, t, clean);
				if(res >= 0) {
					replace.push([ctx.msg, ctx.cfg, t, t.show_brackets ? ctx.msg.content : ctx.msg.content.substring(t.brackets[res*2].length, ctx.msg.content.length-t.brackets[res*2+1].length)]);
					break;
				}
			}
		}
	
		if(replace[0] && (!ctx.msg.channel.guild || !(await ctx.bot.db.isBlacklisted(ctx.msg.channel.guild.id,ctx.msg.channel.id,true)))) {
			try {
				if(replace.length > 7) {
					//console.log(`Potential abuse by ${ctx.msg.author.id} - ${replace.length} proxies at once in ${ctx.msg.channel.id}!`);
					return ctx.bot.send(ctx.msg.channel, `Proxy refused: too many proxies in one message!`);
				}
				for(let r of replace) {
					await ctx.bot.replaceMessage(...r);
				}
				let perms = ctx.msg.channel.permissionsOf(ctx.bot.user.id);
				if(perms.has("manageMessages") && perms.has("readMessages"))
					process.send({name: "queueDelete", channelID: ctx.msg.channel.id, messageID: ctx.msg.id}, null, {swallowErrors: false}, err => {
						if(err) console.log(err)
					});
			} catch(e) { 
				if(e.message == "Cannot Send Empty Message") ctx.bot.send(ctx.msg.channel, "Cannot proxy empty message.");
				else if(e.permission == "Manage Webhooks") ctx.bot.send(ctx.msg.channel, "Proxy failed because I don't have 'Manage Webhooks' permission in this channel.");
				else if(e.message == "toolarge") ctx.bot.send(ctx.msg.channel, "Message not proxied because bots can't send attachments larger than 8mb. Sorry!");
				else if(e.message == "autoban") {
					if(e.notify) ctx.bot.send(ctx.msg.channel, "Proxies refused due to spam!");
					console.log(`Potential spam by ${ctx.msg.author.id}!`);
				} else if(e.code != 10008) ctx.bot.err(ctx.msg, e); //discard "Unknown Message" errors
			}
		}
	}
}