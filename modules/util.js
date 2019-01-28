const request = require("got");
const auth = require("../auth.json");

module.exports = bot => {
	let tulpae = bot.tulpae;
	let config = bot.config;
	let webhooks = bot.webhooks;
  
	bot.replaceMessage = async (msg, cfg, tulpa, content) => {
		const hook = await bot.fetchWebhook(msg.channel);
		const data = {
			wait: true,
			content: content,
			username: `${tulpa.name} ${tulpa.tag ? tulpa.tag : ""} ${bot.checkTulpaBirthday(tulpa) ? "\uD83C\uDF70" : ""}`,
			avatarURL: tulpa.url,
		};

		if(bot.recent[msg.channel.id] && msg.author.id !== bot.recent[msg.channel.id].userID && data.username === bot.recent[msg.channel.id].name) {
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
				delete webhooks[msg.channel.id];
				const hook = await bot.fetchWebhook(msg.channel);
				return bot.executeWebhook(hook.id,hook.token,data);
			}
		}

		if(cfg.log && msg.channel.guild.channels.has(cfg.log)) {
			bot.send(msg.channel.guild.channels.get(cfg.log),
				`Name: ${tulpa.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
		}

		if(!tulpa.posts) tulpa.posts = 0;
		tulpa.posts++;
		if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages")) {
			bot.send(msg.channel, `Warning: I do not have permission to delete messages. Both the original message and ${cfg.lang} webhook message will show.`);
		}
		bot.recent[msg.channel.id] = {
			userID: msg.author.id,
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
				.catch(e => { 
					console.log(e);
					if(e.code == 10015) {
						delete webhooks[msg.channel.id];
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
					if(!tulpa.posts) tulpa.posts = 0;
					tulpa.posts++;
					if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
						bot.send(msg.channel, "Warning: I do not have permission to delete messages. Both the original message and " + cfg.lang + " webhook message will show.");
					bot.recent[msg.channel.id] = { userID: msg.author.id, name: data.username, tulpa: tulpa };
					resolve();
				}).catch(reject);
		});
	};

	bot.fetchWebhook = channel => {
		return new Promise((resolve, reject) => {
			if(webhooks[channel.id])
				resolve(webhooks[channel.id]);
			else if(!channel.permissionsOf(bot.user.id).has("manageWebhooks"))
				reject("Proxy failed: Missing 'Manage Webhooks' permission in this channel.");
			else {
				channel.createWebhook({ name: "Tupperhook" }).then(hook => {
					webhooks[channel.id] = { id: hook.id, token: hook.token };
					resolve(webhooks[channel.id]);
				}).catch(e => { console.log(e); reject("Proxy failed with unknown reason: " + e.message); });
			}
		});
	};

	bot.attach = (url, name) => {
		return new Promise(function(resolve, reject) {
			request(url, {encoding: null}).then(res => resolve(res.body));
		});
	};
  
	bot.updateStatus = () => {
		bot.editStatus({ name: `tul!help | ${Object.values(tulpae).reduce((acc,val) => acc + val.length, 0)} registered`});
	};

	bot.validateGuildCfg = guild => {
		if(!config[guild.id])
			config[guild.id] = {};
		if(config[guild.id].prefix == undefined)
			config[guild.id].prefix = "tul!";
		if(config[guild.id].rolesEnabled == undefined)
			config[guild.id].rolesEnabled = false;
		if(config[guild.id].lang == undefined)
			config[guild.id].lang = "tulpa";
		if(config[guild.id].log == undefined)
			config[guild.id].log = null;
	};

	bot.validateRoles = async () => {
		let tuppers = Object.values(tulpae).reduce((acc, val) => acc.concat(val),[]).filter(t => t.roles);
		let changes = 0;
		console.log("preliminary check of roles for guilds the bot is no longer in");
		tuppers.forEach(t => {
			Object.keys(t.roles).forEach(gid => {
				if(!bot.guilds.has(gid)) {
					console.log("Tupper",t.name,"of host",t.host,"has role for nonexistant guild",gid);
					changes++;
					delete t.roles[gid];
				}
			});
		});
		console.log("entering guild loop!");
		bot.guilds.forEach(guild => {
			let cfg = config[guild.id];
			let roled = tuppers.filter(t => t.roles && t.roles[guild.id]);
			roled.forEach(t => {
				if(!guild.members.has(t.host) || !guild.roles.has(t.roles[guild.id])) {
					console.log("Member",t.host,"role should be deleted in guild",guild.name);
					changes++;
					if(guild.roles.has(t.roles[guild.id]) && guild.members.get(bot.user.id).permission.has("manageRoles")) guild.deleteRole(t.roles[guild.id]);
					delete t.roles[guild.id];
				}
			});
			if(cfg.rolesEnabled) {
				guild.members.filter(m => tulpae[m.id]).forEach(m => {
					tulpae[m.id].forEach(t => {
						if(!t.roles || !t.roles[guild.id]) {
							console.log("Member",m.username,"tulpa",t.name,"missing role in",guild.name);
							if(guild.members.get(bot.user.id).permission.has("manageRoles")) {
								if(guild.roles.size > 245) {
									if(cfg.rolesEnabled)
										bot.disableRoles(guild);
									return console.log("Server has too many roles, canceling.");
								} else {
									changes++;
									guild.createRole({name:t.name,mentionable:true}).then(role => {
										if(!t.roles) t.roles = {};
										t.roles[guild.id] = role.id;
										m.addRole(role.id);
									});
								}
							}
						}
					});
				});
			} else {
				guild.members.filter(m => tulpae[m.id]).forEach(m => {
					tulpae[m.id].filter(t => t.roles).forEach(t => {
						if(t.roles[guild.id]) {
							console.log("Member",m.username,"tulpa",t.name,"has illegal role entry in",guild.name);
							changes++;
							if(guild.roles.has(t.roles[guild.id]) && guild.members.get(bot.user.id).permission.has("manageRoles")) guild.deleteRole(t.roles[guild.id]);
							delete t.roles[guild.id];
						}
					});
				});
			}
		});
		tuppers.forEach(tul => {
			if(tul.roles && Object.keys(tul.roles).length == 0) delete tul.roles;
		});
		console.log("Changes:",changes);
	};

	bot.disableRoles = guild => {
		config[guild.id].rolesEnabled = false;
		Object.keys(tulpae).filter(t => guild.members.has(t)).forEach(t => {
			let mem = guild.members.get(t);
			tulpae[t].forEach(tul => {
				if(tul.roles && tul.roles[guild.id]) {
					guild.deleteRole(tul.roles[guild.id]);
					delete tul.roles[guild.id];
					if(!Object.keys(tul.roles)[0]) delete tul.roles;
				}
			});
		});
	};

	bot.enableRoles = guild => {
		config[guild.id].rolesEnabled = true;
		Promise.all(Object.keys(tulpae).filter(t => guild.members.has(t)).map(t => {
			let mem = guild.members.get(t);
			return Promise.all(tulpae[t].map(tul => {
				if(!mem.roles.find(r => guild.roles.get(r).name === tul.name))
					return guild.createRole({name: tul.name, mentionable: true}).then(r => {
						mem.addRole(r.id);
						if(!tul.roles) tul.roles = {};
						tul.roles[guild.id] = r.id;
					});
				return true;
			}));
		})).then(() => {
		});
	};
  
	bot.saveAll = () => {
		console.log("Saving...");
		require("fs").writeFile("./tulpae.json",JSON.stringify(bot.tulpae,null,2), (err) => {
			if(err) return console.error(err);
			console.log("Tulpae saved.");
			require("fs").writeFile("./servercfg.json",JSON.stringify(bot.config,null,2), (err) => {
				if(err) return console.error(err);
				console.log("Server config saved.");
				require("fs").writeFile("./webhooks.json",JSON.stringify(bot.webhooks,null,2), (err) => {
					if(err) return console.error(err);
					console.log("Webhooks saved.\nAll done!");
				});
			});
		});
	};
  
	bot.backupAll = () => {
		console.log("Backing up...");
		let now = Date.now();
		let tp = `./backups/tulpae-${now}.json`;
		let cp = `./backups/servercfg-${now}.json`;
		let wp = `./backups/webhooks-${now}.json`;
		require("fs").writeFile(tp,JSON.stringify(bot.tulpae,null,2), (err) => {
			if(err) return console.error(err);
			console.log(`Tulpae saved to ${tp}`);
			require("fs").writeFile(cp,JSON.stringify(bot.config,null,2), (err) => {
				if(err) return console.error(err);
				console.log(`Server config saved to ${cp}`);
				require("fs").writeFile(wp,JSON.stringify(bot.webhooks,null,2), (err) => {
					if(err) return console.error(err);
					console.log(`Webhooks saved to ${wp}\nAll done!`);
				});
			});
		});
	};

	bot.generateTulpaField = tulpa => {
		return {
			name: tulpa.name,
			value: `${tulpa.tag ? ("Tag: " + tulpa.tag + "\n") : ""}Brackets: ${tulpa.brackets[0]}text${tulpa.brackets[1]}\nAvatar URL: ${tulpa.url}${tulpa.birthday ? ("\nBirthday: "+new Date(tulpa.birthday).toDateString()) : ""}\nTotal messages sent: ${tulpa.posts}${tulpa.desc ? ("\n"+tulpa.desc) : ""}`
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
		let day = new Date(tulpa.birthday);
		let now = new Date();
		return day.getDate() == now.getDate() && day.getMonth() == now.getMonth();
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
		return (msg.author.id === auth.owner) || (bot.cmds[cmd].permitted(msg,args));
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