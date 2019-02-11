const request = require("got");
const strlen = require('string-length');
const { PermissionsError, EmptyError } = require('./errors');

module.exports = bot => {  

	bot.replaceMessage = async (msg, cfg, tulpa, content, retry = true) => {
		const hook = await bot.fetchWebhook(msg.channel);
		let groupTag;
		if(tulpa.group_id) groupTag = (await bot.db.query('SELECT tag FROM Groups WHERE id = $1',[tulpa.group_id])).rows[0].tag;
		const data = {
			wait: true,
			content: content,
			username: `${tulpa.name} ${tulpa.tag ? tulpa.tag : ""}${bot.checkTulpaBirthday(tulpa) ? "\uD83C\uDF70" : ""}`.trim(),
			avatarURL: tulpa.avatar_url,
		};
		if(groupTag) {
			let l = (32-data.username.length)
			if(l > 4) {
				if(groupTag.length > l) groupTag = groupTag.slice(0,l-4) + "..";
				data.username += " " + groupTag;
			}
		}

		//discord treats astral characters (many emojis) as one character, so add a little dot to make it two
		let len = strlen(data.username);
		if(len == 0) data.username += "\u00b7\u00b7";
		else if(len == 1) data.username += "\u00b7";
		//discord collapses same-name messages, so if two would be sent by different users, break them up with a tiny space

		if(bot.recent[msg.channel.id] && msg.author.id !== bot.recent[msg.channel.id][0].user_id && data.username === bot.recent[msg.channel.id][0].name) {
			data.username = data.username.substring(0,1) + "\u200a" + data.username.substring(1);
		}
		//discord prevents the name 'clyde' being used in a webhook, so break it up with a tiny space
		let c = data.username.toLowerCase().indexOf("clyde");
		if(c > -1) data.username = data.username.substring(0,c+1) + "\u200a" + data.username.substring(c+1);

		if(msg.attachments[0]) {
			return bot.sendAttachmentsWebhook(msg, cfg, data, content, hook, tulpa);
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
				return await bot.replaceMessage(msg,cfg,tulpa,content,false);
			} else throw e;
		}

		if(cfg.log_channel && msg.channel.guild.channels.has(cfg.log_channel)) {
			bot.send(msg.channel.guild.channels.get(cfg.log_channel),
				`Name: ${tulpa.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
		}

		bot.db.updateTulpa(tulpa.user_id,tulpa.name,"posts",tulpa.posts+1);
		if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages")) {
			bot.send(msg.channel, `Warning: I do not have permission to delete messages. Both the original message and proxied message will show.`);
		}
		bot.updateRecent(msg, {
			user_id: msg.author.id,
			name: data.username,
			rawname: tulpa.name,
			id: webmsg.id
		});
	};

	bot.err = (msg, error, tell = true) => {
		console.error(`[ERROR ch:${msg.channel.id} usr:${msg.author ? msg.author.id : "UNKNOWN"}]\n(${error.code}) ${error.stack} `);
		if(tell) bot.send(msg.channel,`There was an error performing the operation. Please report this to the support server if issues persist. (${error.code || error.message})`);
		bot.sentry.captureException(error);
	};

	bot.checkTulpa = (msg, tulpa, clean) => {
		for(let i=0; i<tulpa.brackets.length/2; i++) {
			if(clean.startsWith(tulpa.brackets[i*2]) && clean.endsWith(tulpa.brackets[i*2+1]) && ((clean.length == (tulpa.brackets[i*2].length + tulpa.brackets[i*2+1].length) && msg.attachments[0]) || clean.length > (tulpa.brackets[i*2].length + tulpa.brackets[i*2+1].length)))
				return i;
		}
		return -1;
	};

	bot.sendAttachmentsWebhook = async (msg, cfg, data, content, hook, tulpa) => {
		let files = [];
		for(let i = 0; i < msg.attachments.length; i++) {
			files.push({ file: await bot.attach(msg.attachments[i].url), name: msg.attachments[i].filename });
		}
		data.file = files;
		try {
			let webmsg = await bot.executeWebhook(hook.id,hook.token,data);
			if(cfg.log_channel && msg.channel.guild.channels.has(cfg.log_channel)) {
				let logchannel = msg.channel.guild.channels.get(cfg.log_channel);
				if(!logchannel.permissionsOf(bot.user.id).has("sendMessages")) {
					bot.send(msg.channel, "Warning: There is a log channel configured but I do not have permission to send messages to it. Logging has been disabled.");
					await bot.db.updateCfg(msg.channel.guild.id,'log_channel',null);
				}
				else bot.send(logchannel, `Name: ${tulpa.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
			}
			bot.db.updateTulpa(tulpa.user_id,tulpa.name,"posts",tulpa.posts+1);
			if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
				bot.send(msg.channel, "Warning: I do not have permission to delete messages. Both the original message and " + cfg.lang + " webhook message will show.");
			bot.updateRecent(msg, {
				user_id: msg.author.id,
				name: data.username,
				rawname: tulpa.name,
				id: webmsg.id
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
	}

	bot.fetchWebhook = async channel => {
		let q = await bot.db.query("SELECT * FROM Webhooks WHERE channel_id = $1", [channel.id]);
		if(q.rows[0])
			return q.rows[0];
		else if(!channel.permissionsOf(bot.user.id).has("manageWebhooks"))
			throw new PermissionsError("Manage Webhooks");
		else {
			let hook;
			try {
				hook = await channel.createWebhook({ name: "Tupperhook" })
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

	bot.generateTulpaField = (tulpa,group = null) => {
		return {
			name: tulpa.name + "\u200b",
			value: `${(group != null) ? "Group: " + group.name + "\n" : ""}${tulpa.tag ? ("Tag: " + tulpa.tag + "\n") : ""}Brackets: ${bot.getBrackets(tulpa)}\nAvatar URL: ${tulpa.avatar_url}${tulpa.birthday ? ("\nBirthday: "+tulpa.birthday.toDateString()) : ""}\nTotal messages sent: ${tulpa.posts}${tulpa.description ? ("\n"+tulpa.description) : ""}`
		};
	};

	bot.getBrackets = tulpa => {
		let out = [];
		for(let i=0; i<tulpa.brackets.length; i+=2) {
			out.push(tulpa.brackets[i] + "text" + tulpa.brackets[i+1]);
		}
		return out.join(" | ");
	}

	let buttons = ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9"];
	bot.paginate = async (msg, data) => {
		if(!(msg.channel.type == 1) && !msg.channel.permissionsOf(bot.user.id).has("addReactions")) {
			for(let e of data) {
				await bot.send(msg.channel, e);
			}
			return "'Add Reactions' permission missing, cannot use reaction buttons.\nUntil the permission is added, all pages will be sent at once and this message shall repeat each time the command is used.";
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
		}, 300000);
	};

	bot.checkTulpaBirthday = tulpa => {
		if(!tulpa.birthday) return false;
		let now = new Date();
		return tulpa.birthday.getUTCDate() == now.getUTCDate() && tulpa.birthday.getUTCMonth() == now.getUTCMonth();
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

	bot.send = async (channel, message, file, retry = true) => {
		if(!channel.id) return;
		let msg;
		try {
			if(bot.announcement && message.embed) message.embed.footer.text += bot.announcement;
			msg = await channel.createMessage(message, file);
		} catch(e) {
			if(e.code == 50001) throw new PermissionsError("View Channel", message);
			else if(e.code == 50013) throw new PermissionsError("Send Messages", message);
			else if(e.code == 500) {
				if(retry) return bot.send(channel,message,file,false);
			} else throw e;
		}
		return msg;
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