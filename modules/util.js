const request = require("got");

module.exports = bot => {  

	bot.replaceMessage = async (msg, cfg, tulpa, content) => {
		const hook = await bot.fetchWebhook(msg.channel);
		const data = {
			wait: true,
			content: content,
			username: `${tulpa.name} ${tulpa.tag ? tulpa.tag : ""} ${bot.checkTulpaBirthday(tulpa) ? "\uD83C\uDF70" : ""}`,
			avatarURL: tulpa.avatar_url,
		};

		if(bot.recent[msg.channel.id] && msg.author.id !== bot.recent[msg.channel.id].user_id && data.username === bot.recent[msg.channel.id].name) {
			data.username = data.username.substring(0,1) + "\u200a" + data.username.substring(1);
		}
		let c = data.username.toLowerCase().indexOf("clyde");
		if(c > -1) data.username = data.username.substring(0,c+1) + "\u200a" + data.username.substring(c+1);

		if(msg.attachments[0]) {
			return bot.sendAttachmentsWebhook(msg, cfg, data, content, hook, tulpa);
		}

		try {
			await bot.executeWebhook(hook.id,hook.token,data);
		} catch (e) {
			console.log(e);
			if(e.code === 10015) {
				await bot.db.query('DELETE FROM Webhooks WHERE channel_id = $1', [msg.channel.id]);
				const hook = await bot.fetchWebhook(msg.channel);
				return bot.executeWebhook(hook.id,hook.token,data);
			}
		}

		if(cfg.log && msg.channel.guild.channels.has(cfg.log)) {
			bot.send(msg.channel.guild.channels.get(cfg.log),
				`Name: ${tulpa.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
		}

		bot.db.updateTulpa(tulpa.user_id,tulpa.name,'posts',tulpa.posts+1);
		if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages")) {
			bot.send(msg.channel, `Warning: I do not have permission to delete messages. Both the original message and ${cfg.lang} webhook message will show.`);
		}
		bot.recent[msg.channel.id] = {
			user_id: msg.author.id,
			name: data.username,
			tulpa: tulpa,
		};
	};

	bot.checkTulpa = (msg, tulpa, clean) => {
		return clean.startsWith(tulpa.brackets[0]) && clean.endsWith(tulpa.brackets[1]) && ((clean.length == (tulpa.brackets[0].length + tulpa.brackets[1].length) && msg.attachments[0]) || clean.length > (tulpa.brackets[0].length + tulpa.brackets[1].length));
	};

	bot.sendAttachmentsWebhook = async (msg, cfg, data, content, hook, tulpa) => {
		let files = [];
		for(let i = 0; i < msg.attachments.length; i++) {
			files.push({ file: await bot.attach(msg.attachments[i].url), name: msg.attachments[i].filename });
		}
		data.file = files;
		return new Promise((resolve, reject) => {
			bot.executeWebhook(hook.id,hook.token,data)
				.catch(async e => { 
					console.log(e);
					if(e.code == 10015) {
						await bot.db.query('DELETE FROM Webhooks WHERE channel_id = $1', [msg.channel.id]);
						return bot.fetchWebhook(msg.channel).then(hook => {
							return bot.executeWebhook(hook.id,hook.token,data);
						}).catch(e => reject("Webhook deleted and error creating new one. Check my permissions?"));
					}
				}).then(() => {
					if(cfg.log && msg.channel.guild.channels.has(cfg.log)) {
						let logchannel = msg.channel.guild.channels.get(cfg.log);
						if(!bot.recent[msg.channel.id] && !logchannel.permissionsOf(bot.user.id).has("sendMessages")) {
							bot.send(msg.channel, "Warning: There is a log channel configured but I do not have permission to send messages to it. Logging has been disabled.");
							cfg.log = null;
						}
						else if(logchannel.permissionsOf(bot.user.id).has("sendMessages"))
							bot.send(logchannel, `Name: ${tulpa.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
					}
					bot.db.updateTulpa(tulpa.user_id,tulpa.name,'posts',tulpa.posts+1);
					if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
						bot.send(msg.channel, "Warning: I do not have permission to delete messages. Both the original message and " + cfg.lang + " webhook message will show.");
					bot.recent[msg.channel.id] = { user_id: msg.author.id, name: data.username, tulpa: tulpa };
					resolve();
				}).catch(reject);
		});
	};

	bot.fetchWebhook = async channel => {
		let q = await bot.db.query('SELECT * FROM Webhooks WHERE channel_id = $1', [channel.id]);
		if(q.rows[0])
			return q.rows[0];
		else if(!channel.permissionsOf(bot.user.id).has("manageWebhooks"))
			throw "Proxy failed: Missing 'Manage Webhooks' permission in this channel.";
		else {
			return channel.createWebhook({ name: "Tupperhook" }).then(hook => {
				let wbhk = { id: hook.id, channel_id: channel.id, token: hook.token };
				bot.db.query('INSERT INTO Webhooks VALUES ($1,$2,$3)', [hook.id,channel.id,hook.token]);
				return wbhk;
			}).catch(e => { console.log(e); throw "Proxy failed with unknown reason: " + e.message; });
		}
	};

	bot.attach = async (url) => {
		return (await request(url, {encoding: null})).body;
	};
  
	bot.updateStatus = async () => {
		bot.editStatus({ name: `tul!help | ${(await bot.db.query('SELECT COUNT(*) FROM Members')).rows[0].count} registered`});
	};

	bot.generateTulpaField = tulpa => {
		return {
			name: tulpa.name,
			value: `${tulpa.tag ? ("Tag: " + tulpa.tag + "\n") : ""}Brackets: ${tulpa.brackets[0]}text${tulpa.brackets[1]}\nAvatar URL: ${tulpa.avatar_url}${tulpa.birthday ? ("\nBirthday: "+tulpa.birthday.toDateString()) : ""}\nTotal messages sent: ${tulpa.posts}${tulpa.description ? ("\n"+tulpa.description) : ""}`
		};
	};

	let buttons = ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9"];
	bot.paginate = async (msg, data) => {
		if(!(msg.channel.type == 1) && !msg.channel.permissionsOf(bot.user.id).has("addReactions")) {
			for(let e of data) {
				await bot.send(msg.channel, e);
			}
			return bot.send(msg.channel, "'Add Reactions' permission missing, cannot use reaction buttons.\nUntil the permission is added, all pages will be sent at once and this message shall repeat each time the command is used.");
		}
		return bot.send(msg.channel, data[0]).then(m => {
			buttons.forEach(b => bot.addMessageReaction(msg.channel.id,m.id,b));
			bot.pages[m.id] = {
				user: msg.author.id,
				pages: data,
				index: 0
			};
			setTimeout(() => {
				if(!bot.pages[m.id]) return;
				if(!(msg.channel.type == 1))
					bot.removeMessageReactions(msg.channel.id,m.id).catch(e => { if(e.code != 10008) console.error(e); }); 
				delete bot.pages[m.id];
			}, 300000);
		});
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

	bot.send = (channel, message, file) => {
		if(!channel.id) return;
		return channel.createMessage(message, file);
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