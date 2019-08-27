const request = require("got");
const strlen = require("string-length");
const { PermissionsError, EmptyError } = require("./errors");

let tagRegex = /(@[\s\S]+?#0000|@\S+)/g;

module.exports = bot => {  

	bot.replaceMessage = async (msg, cfg, member, content, retry = true) => {
		const hook = await bot.fetchWebhook(msg.channel);
		let groupTag;
		if(member.group_id) groupTag = (await bot.db.query("SELECT tag FROM Groups WHERE id = $1",[member.group_id])).rows[0].tag;
		const data = {
			wait: true,
			content: bot.recent[msg.channel.id] ? content.replace(tagRegex,match => {
				let includesDiscrim = match.endsWith("#0000");
				let found = bot.recent[msg.channel.id].find(r => (includesDiscrim ? r.name == match.slice(1,-5) : r.rawname.toLowerCase() == match.slice(1).toLowerCase()));
				return found ? `${includesDiscrim ? match.slice(0,-5) : match} (<@${found.user_id}>)` : match;
			}) : content,
			username: `${member.name}${member.tag ? " " + member.tag : ""}${bot.checkMemberBirthday(member) ? "\uD83C\uDF70" : ""}${groupTag ? " " + groupTag : ""}`.trim(),
			avatarURL: member.avatar_url,
		};

		//discord treats astral characters (many emojis) as one character, so add an invisible char to make it two
		let len = strlen(data.username);
		if(len == 0) data.username += "\u17B5\u17B5";
		else if(len == 1) data.username += "\u17B5";
		//discord collapses same-name messages, so if two would be sent by different users, break them up with a tiny space

		if(bot.recent[msg.channel.id] && msg.author.id !== bot.recent[msg.channel.id][0].user_id && data.username === bot.recent[msg.channel.id][0].name) {
			data.username = data.username.substring(0,1) + "\u200a" + data.username.substring(1);
		}
		//discord prevents the name 'clyde' being used in a webhook, so break it up with a tiny space
		let c = data.username.toLowerCase().indexOf("clyde");
		if(c > -1) data.username = data.username.substring(0,c+1) + "\u200a" + data.username.substring(c+1);
		if(data.username.length > 32) data.username = data.username.slice(0,30) + "..";

		if(msg.attachments[0]) {
			return bot.sendAttachmentsWebhook(msg, cfg, data, content, hook, member);
		}
		if(data.content.trim().length == 0) throw new EmptyError();

		let webmsg;
		try {
			webmsg = await bot.executeWebhook(hook.id,hook.token,data);
		} catch (e) {
			if(e.code === 10015) {
				await bot.db.query("DELETE FROM Webhooks WHERE channel_id = $1", [msg.channel.id]);
				const hook = await bot.fetchWebhook(msg.channel);
				webmsg = await bot.executeWebhook(hook.id,hook.token,data);
			} else if(e.code == 504 && retry) {
				return await bot.replaceMessage(msg,cfg,member,content,false);
			} else throw e;
		}

		if(cfg.log_channel && msg.channel.guild.channels.has(cfg.log_channel)) {
			let logchannel = msg.channel.guild.channels.get(cfg.log_channel);
			if(!logchannel.permissionsOf(bot.user.id).has("sendMessages") || !logchannel.permissionsOf(bot.user.id).has("readMessages")) {
				bot.send(msg.channel, "Warning: There is a log channel configured but I do not have permission to send messages to it. Logging has been disabled.");
				await bot.db.updateCfg(msg.channel.guild.id,"log_channel",null);
			}
			else bot.send(logchannel, `Name: ${member.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
		}

		bot.db.updateMember(member.user_id,member.name,"posts",member.posts+1);
		if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages")) {
			bot.send(msg.channel, "Warning: I do not have permission to delete messages. Both the original message and proxied message will show.");
		}
		bot.updateRecent(msg, {
			user_id: msg.author.id,
			name: data.username,
			rawname: member.name,
			id: webmsg.id,
			tag: `${msg.author.username}#${msg.author.discriminator}`
		});
	};

	bot.err = (msg, error, tell = true) => {
		if(error.message.startsWith("Request timed out") || error.code == 500) return;
		console.error(`[ERROR ch:${msg.channel.id} usr:${msg.author ? msg.author.id : "UNKNOWN"}]\n(${error.code}) ${error.stack} `);
		if(tell && msg.channel) bot.send(msg.channel,`There was an error performing the operation. Please report this to the support server if issues persist. (${error.code || error.message})`).catch(e => {});
		bot.sentry.captureException(error);
	};

	bot.checkMember = (msg, member, clean) => {
		for(let i=0; i<member.brackets.length/2; i++) {
			if(clean.startsWith(member.brackets[i*2]) && clean.endsWith(member.brackets[i*2+1]) && ((clean.length == (member.brackets[i*2].length + member.brackets[i*2+1].length) && msg.attachments[0]) || clean.length > (member.brackets[i*2].length + member.brackets[i*2+1].length)))
				return i;
		}
		return -1;
	};

	bot.sendAttachmentsWebhook = async (msg, cfg, data, content, hook, member) => {
		let files = [];
		for(let i = 0; i < msg.attachments.length; i++) {
			let head;
			try {
				head = await request.head(msg.attachments[i].url);
			} catch(e) { }
			if(head && head.headers["content-length"] && Number(head.headers["content-length"]) > 8000000) throw new Error("toolarge");
			files.push({ file: await bot.attach(msg.attachments[i].url), name: msg.attachments[i].filename });
		}
		data.file = files;
		try {
			let webmsg = await bot.executeWebhook(hook.id,hook.token,data);
			if(cfg.log_channel && msg.channel.guild.channels.has(cfg.log_channel)) {
				let logchannel = msg.channel.guild.channels.get(cfg.log_channel);
				if(!logchannel.permissionsOf(bot.user.id).has("sendMessages") || !logchannel.permissionsOf(bot.user.id).has("readMessages")) {
					bot.send(msg.channel, "Warning: There is a log channel configured but I do not have permission to send messages to it. Logging has been disabled.");
					await bot.db.updateCfg(msg.channel.guild.id,"log_channel",null);
				}
				else bot.send(logchannel, `Name: ${member.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
			}
			bot.db.updateMember(member.user_id,member.name,"posts",member.posts+1);
			if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
				bot.send(msg.channel, "Warning: I do not have permission to delete messages. Both the original message and " + cfg.lang + " webhook message will show.");
			bot.updateRecent(msg, {
				user_id: msg.author.id,
				name: data.username,
				rawname: member.name,
				id: webmsg.id,
				tag: `${msg.author.username}#${msg.author.discriminator}`
			});
		} catch(e) {
			if(e.code == 10015) {
				await bot.db.query("DELETE FROM Webhooks WHERE channel_id = $1", [msg.channel.id]);
				let hook = await bot.fetchWebhook(msg.channel);
				return bot.executeWebhook(hook.id,hook.token,data);
			} else throw e;
		}
	};

	bot.updateRecent = (msg, data) => {
		if(!bot.recent[msg.channel.id]) {
			bot.recent[msg.channel.id] = [];
		}
		bot.recent[msg.channel.id].unshift(data);
		if(bot.recent[msg.channel.id].length > 5) bot.recent[msg.channel.id] = bot.recent[msg.channel.id].slice(0,5);
	};

	bot.fetchWebhook = async channel => {
		let q = await bot.db.query("SELECT * FROM Webhooks WHERE channel_id = $1", [channel.id]);
		if(q.rows[0])
			return q.rows[0];
		else if(!channel.permissionsOf(bot.user.id).has("manageWebhooks"))
			throw new PermissionsError("Manage Webhooks");
		else {
			let hook;
			try {
				hook = await channel.createWebhook({ name: "Tupperhook" });
			} catch(e) {
				if(e.code == 30007) {
					let wbhooks = await channel.getWebhooks();
					for(let i=0; i<wbhooks.length; i++) {
						if(wbhooks[i].user.id == bot.user.id) await bot.deleteWebhook(wbhooks[i].id,wbhooks[i].token);
					}
					if(wbhooks.length == 10) hook = wbhooks[9];
					else hook = await channel.createWebhook({ name: "Tupperhook" });
				} else throw e;
			}
			let wbhk = { id: hook.id, channel_id: channel.id, token: hook.token };
			await bot.db.query("INSERT INTO Webhooks VALUES ($1,$2,$3)", [hook.id,channel.id,hook.token]);
			return wbhk;
		}
	};

	bot.attach = async (url) => {
		return (await request(url, {encoding: null})).body;
	};
  
	bot.updateStatus = async () => {
		bot.editStatus({ name: `tul!help | ${(await bot.db.query("SELECT COUNT(*) FROM Members")).rows[0].count} registered`});
	};

	bot.generatePages = async (arr, fieldGen, extra = {}) => {
		let embeds = [];
		let current = { embed: {
			title: extra.title,
			author: extra.author,
			description: extra.description,
			footer: extra.footer,
			fields: []
		}};
		
		for(let i=0; i<arr.length; i++) {
			if(current.embed.fields.length < 5) {
				current.embed.fields.push(await fieldGen(arr[i],embeds.length+1));
			} else {
				embeds.push(current);
				current = { embed: {
					title: extra.title,
					author: extra.author,
					description: extra.description,
					footer: extra.footer,
					fields: [await fieldGen(arr[i],embeds.length+1)]
				}};
			}
		}
		embeds.push(current);
		if(embeds.length > 1) {
			for(let i = 0; i < embeds.length; i++)
				embeds[i].embed.title += ` (page ${i+1}/${embeds.length}, ${arr.length} total)`;
		}
		return embeds;
	};

	bot.generateMemberField = (member,group = null) => {
		let out = {
			name: member.name.trim().length < 1 ? member.name + "\u200b" : member.name,
			value: `${(group != null) ? "Group: " + group.name + "\n" : ""}${member.tag ? ("Tag: " + member.tag + "\n") : ""}Brackets: ${bot.getBrackets(member)}\nAvatar URL: ${member.avatar_url}${member.birthday ? ("\nBirthday: "+member.birthday.toDateString()) : ""}\nTotal messages sent: ${member.posts}${member.description ? ("\n"+member.description) : ""}`
		};
		if(out.value.length > 1023) out.value = out.value.slice(0,1020) + "...";
		return out;
	};

	bot.getBrackets = member => {
		let out = [];
		for(let i=0; i<member.brackets.length; i+=2) {
			out.push(member.brackets[i] + "text" + member.brackets[i+1]);
		}
		return out.join(" | ");
	};

	let buttons = ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9", "\u0023\u20e3"];
	bot.paginate = async (msg, data) => {
		if(!(msg.channel.type == 1)) {
			let perms = msg.channel.permissionsOf(bot.user.id);
			if(!perms.has("readMessages") || !perms.has("sendMessages") || !perms.has("embedLinks")) return;
			if(!perms.has("addReactions") || !perms.has("readMessageHistory")) {
				await bot.send(msg.channel, data[0]);
				if(!perms.has("addReactions")) return "'Add Reactions' permission missing, cannot use reaction buttons. Only first page shown.";
				else return "'Read Message History' permission missing, cannot use reaction buttons. (Discord requires this permission to add reactions.) Only first page shown.";
			}
		}
		let m = await bot.send(msg.channel, data[0]);
		for(let i=0; i<buttons.length; i++)
			await bot.addMessageReaction(msg.channel.id,m.id,buttons[i]);
		bot.pages[m.id] = {
			user: msg.author.id,
			pages: data,
			index: 0
		};
		setTimeout(() => {
			if(!bot.pages[m.id]) return;
			if(!(msg.channel.type == 1))
				bot.removeMessageReactions(msg.channel.id,m.id).catch(e => { }); 
			delete bot.pages[m.id];
		}, 900000);
	};

	bot.checkMemberBirthday = member => {
		if(!member.birthday) return false;
		let now = new Date();
		return member.birthday.getUTCDate() == now.getUTCDate() && member.birthday.getUTCMonth() == now.getUTCMonth();
	};

	bot.resolveUser = (msg, text) => {
		let target = bot.users.get(/<@!?(\d+)>/.test(text) && text.match(/<@!?(\d+)>/)[1]) || bot.users.get(text) || msg.channel.guild.members.find(m => m.username.toLowerCase() == text.toLowerCase() || (m.nick && m.nick.toLowerCase()) == text.toLowerCase() || text.toLowerCase() == `${m.username.toLowerCase()}#${m.discriminator}`);
		if(target && target.user) target = target.user;
		return target;
	};

	bot.resolveChannel = (msg, text) => {
		let g = msg.channel.guild;
		return g.channels.get(/<#(\d+)>/.test(text) && text.match(/<#(\d+)>/)[1]) || g.channels.get(text) || g.channels.find(m => m.name.toLowerCase() == text.toLowerCase());
	};

	bot.checkPermissions = (cmd, msg, args) => {
		return (msg.author.id === bot.owner) || (cmd.permitted(msg,args));
	};

	bot.printError = err => {
		if(err) return console.error(err);
	};

	bot.waitMessage = (msg) => {
		return new Promise((res, rej) => {
			bot.dialogs[msg.channel.id + msg.author.id] = res;
			setTimeout(() => {
				if(bot.dialogs[msg.channel.id + msg.author.id] != undefined) {
					delete bot.dialogs[msg.channel.id + msg.author.id];
					rej("timeout");
				}
			}, 10000);
		});
	};

	bot.send = async (channel, message, file, retry = true, author) => {
		if(!channel.id) return;
		let msg;
		try {
			if(bot.announcement && message.embed) {
				if(!message.content) message.content = "";
				message.content += "\n"+bot.announcement;
			}
			msg = await channel.createMessage(message, file);
		} catch(e) {
			if(e.message.startsWith("Request timed out") || e.code >= 500) {
				if(retry) return bot.send(channel,message,file,false);
				else return;
			} else if(e.code != 50007 && e.code != 10003) throw e;
		}
		return msg;
	};

	bot.noVariation = word => {
		return word.replace(/[\ufe0f]/g,"");
	};

	bot.getMatches = (string, regex) => {
		var matches = [];
		var match;
		while (match = regex.exec(string)) {
			match.splice(1).forEach(m => { if(m) matches.push(m); });
		}
		return matches;
	};

};
