//dependencies
const Eris = require("eris");
const logger = require("winston");
const request = require("snekfetch");
const fs = require("fs");
const validUrl = require("valid-url");
const util = require("util");

//create data files if they don't exist
["/auth.json","/tulpae.json","/servercfg.json","/webhooks.json"].forEach(file => {
	if(!fs.existsSync(__dirname + file))
		fs.writeFileSync(__dirname + file, "{ }", (err) => { if(err) throw err; });
});
const auth = require("./auth.json");
const tulpae = require("./tulpae.json");
const config = require("./servercfg.json");
const webhooks = require("./webhooks.json");

const recent = {};

const feedbackID = "431722290971934721";

const zwsp = String.fromCharCode(8203); //zero-width space for embed formatting
var disconnects = 0;

logger.configure({
	level: "debug",
	transports: [
		new logger.transports.Console(),
		new logger.transports.File({ filename: "output.log" })
	],
	format: logger.format.combine(
		logger.format((info) => {info.message = util.format(info.message); return info; })(),
		logger.format.colorize(),
		logger.format.printf(info => `${info.level}: ${info.message}`)
	)
});

// Initialize Bot
var bot = new Eris(auth.discord);

bot.on("ready", () => {
	logger.info(`Connected\nLogged in as:\n${bot.user.username} - (${bot.user.id})`);
	updateStatus();
	setInterval(updateStatus, 1800000);
	bot.guilds.forEach(validateGuildCfg);
	validateRoles();
});

bot.on("guildCreate", validateGuildCfg);

bot.on("guildDelete", guild => {
	console.log("Removed from guild " + guild.id + ", deleting config data!");
	delete config[guild.id];
});

bot.on("guildMemberAdd", (guild, member) => {
	if(tulpae[member.id] && config[guild.id].rolesEnabled) {
		tulpae[member.id].forEach(tul => {
			bot.createRole(guild.id,{name:tul.name,mentionable:true}).then(role => member.addRole(role.id));
		});
	}
});

bot.on("guildMemberRemove", (guild, member) => {
	if(tulpae[member.id] && config[guild.id].rolesEnabled) {
		tulpae[member.id].filter(t => t.roles && t.roles[guild.id]).forEach(tul => {
			bot.deleteRole(guild.id,tul.roles[guild.id]);
			delete tul.roles[guild.id];
			if(Object.keys(tul.roles).length == 0) delete tul.roles;
		});
	}
});

bot.on("disconnect", function() {
	logger.warn("Bot disconnected! Attempting to reconnect.");
	disconnects++;
	if(disconnects < 50)
		bot.connect();
});

bot.on("error", console.error);

const pages = {};

let buttons = ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9"];
bot.on("messageReactionAdd", function(message, emoji, userID) {
	if(!pages[message.id] || pages[message.id].user != userID || !buttons.includes(emoji.name)) return;
	let data = pages[message.id];
	switch(emoji.name) {
		case "\u23ea": // first page
			data.index = 0;
		break;
		
		case "\u2b05": // previous page
			data.index--;
			if(data.index < 0) data.index = data.pages.length - 1;
		break;
		
		case "\u27a1": // next page
			data.index++;
			if(data.index >= data.pages.length) data.index = 0;
		break;
		
		case "\u23e9": // last page
			data.index = data.pages.length-1;
		break;
		
		case "\u23f9": // stop
			delete pages[message.id];
			return bot.deleteMessage(message.channel.id, message.id);
		break;
	}
	bot.editMessage(message.channel.id, message.id, data.pages[data.index]);
	bot.removeMessageReaction(message.channel.id, message.id, emoji.name, userID);
});


bot.on("messageCreate", async function (msg) {
	if(msg.author.bot) return;
	let cfg = msg.channel.guild && config[msg.channel.guild.id] || { prefix: "tul!", rolesEnabled: false, lang: "tulpa"};
	if (msg.content.startsWith(cfg.prefix) && (!cfg.cmdblacklist || !cfg.cmdblacklist.includes(msg.channel.id))) {
		var args = msg.content.substr(cfg.prefix.length).split(" ");
		var cmd = args.shift();
		
		if(bot.cmds[cmd] && checkPermissions(cmd,msg,args)) {
			logger.info(`${msg.channel.guild ? msg.channel.guild.name + ": " : "private message: "}${msg.author.username} executed command ${msg.content}`);
			return bot.cmds[cmd].execute(msg, args, cfg);
		}
	} else if(tulpae[msg.author.id] && !(msg.channel instanceof Eris.PrivateChannel) && (!cfg.blacklist || !cfg.blacklist.includes(msg.channel.id))) {
		let clean = msg.cleanContent || msg.content;
		clean = clean.replace(/(<:.+?:\d+?>)|(<@!?\d+?>)/,"cleaned");
		let cleanarr = clean.split("\n");
		let lines = msg.content.split("\n");
		let replace = [];
		let current = null;
		for(let i = 0; i < lines.length; i++) {
			let found = false;
			tulpae[msg.author.id].forEach(t => {
				if(checkTulpa(msg, t, cleanarr[i])) {
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
			for(let t of tulpae[msg.author.id]) {
				if(checkTulpa(msg, t, clean)) {
					replace.push([msg, cfg, t, t.showbrackets ? msg.content : msg.content.substring(t.brackets[0].length, msg.content.length-t.brackets[1].length)]);
					break;
				}
			}
		}
			
		if(replace[0]) {
			Promise.all(replace.map(r => replaceMessage(...r)))
				.then(() => {
					if(msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
						msg.delete().catch(e => { if(e.code == 50013) { send(msg.channel, "Warning: I'm missing permissions needed to properly replace messages."); }});
					save("tulpae",tulpae);
				}).catch(e => send(msg.channel, e.toString()));
		}
	}
});

async function replaceMessage(msg, cfg, tulpa, content) {
	const hook = await fetchWebhook(msg.channel);
	const data = {
		wait: true,
		content: content,
		username: `${tulpa.name} ${tulpa.tag ? tulpa.tag : ""} ${checkTulpaBirthday(tulpa) ? "\uD83C\uDF70" : ""}`,
		avatarURL: tulpa.url,
	};

	if(recent[msg.channel.id] && msg.author.id !== recent[msg.channel.id].userID && data.username === recent[msg.channel.id].name) {
		data.username = data.username.substring(0,1) + "\u200a" + data.username.substring(1);
	}

	if(msg.attachments[0]) {
		return sendAttachmentsWebhook(msg, cfg, data, content, hook, tulpa);
	}

	try {
		await bot.executeWebhook(hook.id,hook.token,data);
	} catch (e) {
		console.log(e);
		if(e.code === 10015) {
			delete webhooks[msg.channel.id];
			const hook = await fetchWebhook(msg.channel);
			return bot.executeWebhook(hook.id,hook.token,data);
		}
	}

	if(cfg.log && msg.channel.guild.channels.has(cfg.log)) {
		send(msg.channel.guild.channels.get(cfg.log),
			`Name: ${tulpa.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
	}

	if(!tulpa.posts) tulpa.posts = 0;
	tulpa.posts++;
	if(!recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages")) {
		send(msg.channel, `Warning: I do not have permission to delete messages. Both the original message and ${cfg.lang} webhook message will show.`);
	}
	recent[msg.channel.id] = {
		userID: msg.author.id,
		name: data.username,
		tulpa: tulpa,
	};
}

function checkTulpa(msg, tulpa, clean) {
	return clean.startsWith(tulpa.brackets[0]) && clean.endsWith(tulpa.brackets[1]) && ((clean.length == (tulpa.brackets[0].length + tulpa.brackets[1].length) && msg.attachments[0]) || clean.length > (tulpa.brackets[0].length + tulpa.brackets[1].length));
}

async function sendAttachmentsWebhook(msg, cfg, data, content, hook, tulpa) {
	let files = [];
	for(let i = 0; i < msg.attachments.length; i++) {
		files.push({ file: await attach(msg.attachments[i].url), name: msg.attachments[i].filename });
	}
	data.file = files;
	return new Promise((resolve, reject) => {
		bot.executeWebhook(hook.id,hook.token,data)
			.catch(e => { 
				console.log(e);
				if(e.code == 10015) {
					delete webhooks[msg.channel.id];
					return fetchWebhook(msg.channel).then(hook => {
						return bot.executeWebhook(hook.id,hook.token,data);
					}).catch(e => reject("Webhook deleted and error creating new one. Check my permissions?"));
				}
			}).then(() => {
				if(cfg.log && msg.channel.guild.channels.has(cfg.log)) {
					let logchannel = msg.channel.guild.channels.get(cfg.log);
					if(!recent[msg.channel.id] && !logchannel.permissionsOf(bot.user.id).has("sendMessages")) {
						send(msg.channel, "Warning: There is a log channel configured but I do not have permission to send messages to it. Logging has been disabled.");
						cfg.log = null;
						save("servercfg",config);
					}
					else if(logchannel.permissionsOf(bot.user.id).has("sendMessages"))
						send(logchannel, `Name: ${tulpa.name}\nRegistered by: ${msg.author.username}#${msg.author.discriminator}\nChannel: <#${msg.channel.id}>\nMessage: ${content}`);
				}
				if(!tulpa.posts) tulpa.posts = 0;
				tulpa.posts++;
				if(!recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
					send(msg.channel, "Warning: I do not have permission to delete messages. Both the original message and " + cfg.lang + " webhook message will show.");
				recent[msg.channel.id] = { userID: msg.author.id, name: data.username, tulpa: tulpa };
				resolve();
			}).catch(reject);
	});
}

function fetchWebhook(channel) {
	return new Promise((resolve, reject) => {
		if(webhooks[channel.id])
			resolve(webhooks[channel.id]);
		else if(!channel.permissionsOf(bot.user.id).has("manageWebhooks"))
			reject("Proxy failed: Missing 'Manage Webhooks' permission in this channel.");
		else {
			channel.createWebhook({ name: "Tupperhook" }).then(hook => {
				webhooks[channel.id] = { id: hook.id, token: hook.token };
				resolve(webhooks[channel.id]);
				save("webhooks",webhooks);
			}).catch(e => { reject("Proxy failed with unknown reason: Error " + e.code); });
		}
	});
}

function attach(url, name) {
	return new Promise(function(resolve, reject) {
		request.get(url).then(res => {
			resolve(res.raw);
		});
	});
}

bot.cmds = {
	help: {
		help: cfg => "Print this message, or get help for a specific command",
		usage: cfg =>  ["help - print list of commands", 
			"help [command] - get help on a specific command"],
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let output = "";
			if(args[0]) { //help for a specific command
				if(bot.cmds[args[0]] && checkPermissions(args[0],msg,args) && bot.cmds[args[0]].usage) {
					output = { embed: {
						title: "Bot Command | " + args[0],
						description: bot.cmds[args[0]].help(cfg) + "\n\n**Usage:**\n",
						timestamp: new Date().toJSON(),
						color: 0x999999,
						author: {
							name: "Tupperware",
							icon_url: bot.user.avatarURL
						},
						footer: {
							text: "If something is wrapped in <> or [], do not include the brackets when using the command. They indicate whether that part of the command is required <> or optional []."
						}
					}};
					for(let u of bot.cmds[args[0]].usage(cfg))
						output.embed.description += `${cfg.prefix + u}\n`;
					if(bot.cmds[args[0]].desc)
						output.embed.description += `\n${bot.cmds[args[0]].desc(cfg)}`;
				} else output += "Command not found.";
			} else { //general help
				output = { embed: {
					title: "Tupperware | Help",
					description: "I am Tupperware, a bot made to give " + cfg.lang + "s a voice using Discord webhooks.\nTo get started, register " + article(cfg) + " " + cfg.lang + " with `" + cfg.prefix + "register` and enter a message with the brackets you set!\n\n**Command List**\nType `"+cfg.prefix+"help command` for detailed help on a command.\n" + zwsp + "\n",
					timestamp: new Date().toJSON(),
					color: 0x999999,
					author: {
						name: "Tupperware",
						icon_url: bot.user.avatarURL
					},
					footer: {
						text: "By Keter#1730"
					}
				}};
				for(let cmd of Object.keys(bot.cmds)) {
					if(bot.cmds[cmd].help && bot.cmds[cmd].permitted(msg,args))
						output.embed.description += `**${cfg.prefix + cmd}**  -  ${bot.cmds[cmd].help(cfg)}\n`;
				}
			}
			send(msg.channel, output);
		}
	},
	
	//owner-only eval command for testing and on-the-spot hotfixes/changes
	js: {
		permitted: (msg) => { return msg.author.id === auth.owner; },
		execute: function(msg, args, cfg) {
			if(msg.author.id != auth.owner) return;
			let message = msg.content.substr(7);
			let out = "";
			try {
				out = eval(message);
			} catch(e) {
				out = e.toString();
			}
			send(msg.channel, util.inspect(out).slice(0,2000));
		}
	},
	
	//owner-only feedback reply command
	reply: {
		permitted: (msg) => { return msg.author.id === auth.owner; },
		execute: function(msg, args, cfg) {
			if(msg.author.id != auth.owner) return;
			bot.getMessage(feedbackID, args[0]).then(async message => {
				let parts = message.content.split("\n");
				if(parts[3] && parts[0].startsWith("User") && parts[1].startsWith("Server") && parts[2].startsWith("Channel") && parts[3].startsWith("Message")) {
					let user = bot.users.get(parts[0].split(" ")[1]);
					let server = bot.guilds.get(parts[1].split(" ")[1]);
					let channel = server && server.channels.get(parts[2].split(" ")[1]) || await bot.getDMChannel(user.id);
					let message = parts[3].split(" ").slice(1).join(" ");
					let embed = { embed: {
						title: "Reply to Feedback",
						description: `**Original by ${user.username}#${user.discriminator}**\n${message}\n\n**Reply**\n${args.slice(1).join(" ")}`,
						timestamp: new Date().toJSON(),
						color: 0x999999,
						footer: {
							text: "Keter#1730",
							icon_url: bot.users.get(auth.owner).avatarURL
						}
					}};
					send(channel, embed);
				}
			}).catch(e => send(msg.channel, e.toString()));
		}
	},
	
	//attach webhook(s) to channel(s)
	hook: {
		permitted: () => true,
		execute: function(msg, args, cfg) {
			send(msg.channel, "This command no longer has a purpose. Webhooks have been changed to opt-out rather than opt-in: they are automatically generated for non-blacklisted channels when a user attempts to proxy in them.");
		}
	},
	
	//register new tulpa
	register: {
		help: cfg => "Register a new " + cfg.lang + "",
		usage: cfg =>  ["register <name> <brackets> - Register a new " + cfg.lang + ".\n\t<name> - the " + cfg.lang + "'s name, for multi-word names surround this argument in `''`\n\t<brackets> - the word 'text' surrounded by any characters on one or both sides"],
		desc: cfg => "Example use: `register Test >text<` - registers " + article(cfg) + " " + cfg.lang + " named 'Test' that is triggered by messages surrounded by ><\nBrackets can be anything, one sided or both. For example `text<<` and `T:text` are both valid\nNote that you can enter multi-word names by surrounding the full name in apostrophes `''`.",
		permitted: () => true,
		execute: function(msg, args, cfg) {
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			let out = "";
			let brackets;
			if(args[0])
				brackets = msg.content.slice(msg.content.indexOf(args[0])+args[0].length+1).trim().split("text");
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["register"], cfg);
			} else if(!args[1]) {
				out = "Missing argument 'brackets'. Try `" + cfg.prefix + "help register` for usage details.";
			} else if(args[0].length < 2 || args[0].length > 28) {
				out = "Name must be between 2 and 28 characters.";
			} else if(brackets.length < 2) {
				out = "No 'text' found to detect brackets with. For the last part of your command, enter the word 'text' surrounded by any characters.\nThis determines how the bot detects if it should replace a message.";
			} else if(!brackets[0] && !brackets[1]) {
				out = "Need something surrounding 'text'.";
			} else if(tulpae[msg.author.id] && tulpae[msg.author.id].find(t => t.name === args[0])) {
				out = proper(cfg.lang) + " with that name under your user account already exists.";
			} else if(tulpae[msg.author.id] && tulpae[msg.author.id].find(t => t.brackets[0] == brackets[0] && t.brackets[1] == brackets[1])) {
				out = proper(cfg.lang) + " with those brackets under your user account already exists.";
			} else {
				if(!tulpae[msg.author.id]) tulpae[msg.author.id] = [];
				let tulpa = {
					name: args[0],
					url: "https://i.imgur.com/ZpijZpg.png",
					brackets: brackets,
					posts: 0,
					host: msg.author.id
				};
				tulpae[msg.author.id].push(tulpa);
				let guilds = Object.keys(config).filter(id => config[id].rolesEnabled && bot.guilds.has(id) && bot.guilds.get(id).members.has(msg.author.id)).map(id => bot.guilds.get(id));
				if(guilds[0]) {
					tulpa.roles = {};
					Promise.all(guilds.map(g => {
						if(g.roles.size >= 249) {
							console.log("Maximum roles reached in guild",g.id);
							disableRoles(g);
							return true;
						}
						return g.createRole({ name: tulpa.name, mentionable: true}).then(r => {
							tulpa.roles[g.id] = r.id;
							g.members.get(msg.author.id).addRole(r.id);
						});
					})).then(() => {
						save("tulpae",tulpae);
					});
				}
				save("tulpae",tulpae);
				out = proper(cfg.lang) + " registered successfully!\nName: " + tulpa.name + "\nBrackets: " + `${brackets[0]}text${brackets[1]}` + "\nUse `" + cfg.prefix + "rename`, `" + cfg.prefix + "brackets`, and `" + cfg.prefix + "avatar` to set/update your " + cfg.lang + "'s info."; 
			}
			send(msg.channel, out);
		}
	},
	
	//unregister tulpa
	remove: {
		help: cfg => "Unregister " + article(cfg) + " " + cfg.lang + "",
		usage: cfg =>  ["remove <name> - Unregister the named " + cfg.lang + " from your list"],
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			let name = args.join(" ");
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["remove"], cfg);
			} else if(!tulpae[msg.author.id]) {
				out = "You do not have any " + cfg.lang + "s registered.";
			} else if(!tulpae[msg.author.id].find(t => t.name.toLowerCase() == name.toLowerCase())) {
				out = "Could not find " + cfg.lang + " with that name registered under your account.";
			} else {
				out = proper(cfg.lang) + " unregistered.";
				let arr = tulpae[msg.author.id];
				let tul = arr.find(t => t.name.toLowerCase() == name.toLowerCase());
				if(tul.roles) {
					Object.keys(tul.roles).filter(id => config[id].rolesEnabled).forEach(id => {
						if(bot.guilds.get(id).roles.has(tul.roles[id]))
							bot.deleteRole(id,tul.roles[id]);
					});
				}
				arr.splice(arr.indexOf(tul), 1);
				save("tulpae",tulpae);
			}
			send(msg.channel, out);
		}
	},
	
	list: {
		help: cfg => "Get a detailed list of yours or another user's registered " + cfg.lang + "s",
		usage: cfg =>  ["list [user] - Sends a list of the user's registered " + cfg.lang + "s, their brackets, post count, and birthday (if set). If user is not specified it defaults to the message author. If 'all' or '*' is given, gives a short form list of all tuppers in the server."],
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			if(args[0] == "all" || args[0] == "*") { //short list of all tuppers
				let tups = msg.channel.guild.members.filter(m => tulpae[m.id] && tulpae[m.id].length > 0).map(m => tulpae[m.id]);

				let embeds = [];
				let current = { embed: {
					title: `${tups.reduce((acc,val) => acc+val.length,0)} total registered ${cfg.lang}s in this server`,
					author: {
						name: msg.channel.guild.name,
						icon_url: msg.channel.guild.iconURL
					},
					fields: []
				}};
				let len = 200;
				let page = 1;
				tups.forEach(t => {
					let user = bot.users.get(t[0].host);
					let field = {
						name: `${user.username}#${user.discriminator}`,
						value: t.map(tul => tul.name).join(', ')
					};
					len += field.name.length;
					len += field.value.length;
					if(len < 5000 && current.embed.fields.length < 5) {
						current.embed.fields.push(field);
					} else {
						embeds.push(current);
						len = 200;
						page++;
						current = { embed: {
							title: `${tups.reduce((acc,val) => acc+val.length,0)} total registered ${cfg.lang}s in this server`,
							author: {
								name: msg.channel.guild.name,
								icon_url: msg.channel.guild.iconURL
							},
							fields: []
						}};
					}
				});
				embeds.push(current);
				out = embeds[0];
				if(page > 1) {
					for(let i = 0; i < embeds.length; i++)
						embeds[i].embed.title += ` (page ${i+1}/${embeds.length})`
					return paginate(msg, embeds);
				}
				return send(msg.channel, out);
			}
			let target;
			if(args[0]) {
				if(msg.channel instanceof Eris.PrivateChannel) return send(msg.channel,"Cannot search for members in a DM.");
				else target = resolveUser(msg, args.join(" "));
			} else {
				target = msg.author;
			}
			if(!target) {
				out = "User not found.";
			} else if(!tulpae[target.id]) {
				out = (target.id == msg.author.id) ? "You have not registered any " + cfg.lang + "s." : "That user has not registered any " + cfg.lang + "s.";
			} else {
				let embeds = [];
				let current = { embed: {
					title: `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`,
					author: {
						name: target.username,
						icon_url: target.avatarURL
					},
					fields: []
				}};
				let len = 200;
				let page = 1;
				tulpae[target.id].forEach(t => {
					let field = generateTulpaField(t);
					len += field.name.length;
					len += field.value.length;
					if(len < 5000 && current.embed.fields.length < 5) {
						current.embed.fields.push(field);
					} else {
						embeds.push(current);
						len = 200;
						page++;
						current = { embed: {
							title: `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`,
							author: {
								name: target.username,
								icon_url: target.avatarURL
							},
							fields: [field]
						}};
					}
				});
				embeds.push(current);
				out = embeds[0];
				if(page > 1) {
					for(let i = 0; i < embeds.length; i++)
						embeds[i].embed.title += ` (page ${i+1}/${embeds.length}, ${tulpae[target.id].length} total)`
					return paginate(msg, embeds);
				}
				
			}
			send(msg.channel, out);
		}
	},
	
	rename: {
		help: cfg => "Change " + article(cfg) + " " + cfg.lang + "'s name",
		usage: cfg =>  ["rename <name> <newname> - Set a new name for the " + cfg.lang + ""],
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["rename"], cfg);
			} else if(!args[1]) {
				out = "Missing argument 'newname'.";
			} else if(args[1].length < 2 || args[1].length > 28) {
				out = "New name must be between 2 and 28 characters.";
			} else if(!tulpae[msg.author.id] || !tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else if(tulpae[msg.author.id].find(t => t.name == args[1])) {
				out = "You already have " + article(cfg) + " " + cfg.lang + " with that new name.";
			} else {
				tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).name = args[1];
				save("tulpae",tulpae);
				out = proper(cfg.lang) + " renamed successfully.";
			}
			send(msg.channel, out);
		}
	},
	
	avatar: {
		help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s avatar",
		usage: cfg =>  ["avatar <name> [url] - if url is specified, change the " + cfg.lang + "'s avatar, if not, simply echo the current one"],
		permitted: () => true,
		desc: cfg => "The specified URL must be a direct link to an image - that is, the URL should end in .jpg or .png or another common image filetype. Also, it can't be over 1mb in size, as Discord doesn't accept images over this size as webhook avatars.",
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["avatar"], cfg);
			} else if(!tulpae[msg.author.id] || !tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else if(!args[1]) {
				out = tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).url;
			} else if(!validUrl.isWebUri(args[1])) {
				out = "Malformed url.";
			} else {
				request.head(args[1]).then(res => {
					if(!res.headers["content-type"] || !res.headers["content-type"].startsWith("image")) return send(msg.channel, "I couldn't find an image at that URL. Make sure it's a direct link (ends in .jpg or .png for example).");
					if(Number(res.headers["content-length"]) > 1000000) {
						return send(msg.channel, "That image is too large and Discord will not accept it. Please use an image under 1mb.");
					}
					tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).url = args[1];
					save("tulpae",tulpae);
					send(msg.channel, "Avatar changed successfully.");
				}).catch(err => send(msg.channel, "I couldn't find an image at that URL. Make sure it's a direct link (ends in .jpg or .png for example)."));
				return;
			}
			send(msg.channel, out);
		}
	},
	
	describe: {
		help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s description",
		usage: cfg =>  ["describe <name> [desc] - if desc is specified, change the " + cfg.lang + "'s describe, if not, simply echo the current one"],
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["describe"], cfg);
			} else if(!tulpae[msg.author.id] || !tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else if(!args[1]) {
				out = "Current description: " + tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).desc;
			} else {
				tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).desc = args.slice(1).join(" ").slice(0,500);
				save("tulpae",tulpae);
				out = "Description updated successfully.";
			}
			send(msg.channel, out);
		}
	},
		
	
	birthday: {
		help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s birthday, or see upcoming birthdays",
		usage: cfg =>  ["birthday [name] [date] -\n\tIf name and date are specified, set the named " + cfg.lang + "'s birthday to the date.\n\tIf name only is specified, show the " + cfg.lang + "'s birthday.\n\tIf neither are given, show the next 5 birthdays on the server."],
		desc: cfg => "Date must be given in format MM/DD/YY",
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				let tulps = Object.keys(tulpae)
					.filter(id => id == msg.author.id || (msg.channel.guild && msg.channel.guild.members.has(id)))
					.reduce((arr, tul) => arr.concat(tulpae[tul]), []);
				if(!tulps[0])
					return send(msg.channel, "No " + cfg.lang + "s have been registered on this server.");
				tulps = tulps.filter(t => !!t.birthday);
				if(!tulps[0])
					return send(msg.channel, "No " + cfg.lang + "s on this server have birthdays set.");
				let n = new Date();
				let now = new Date(n.getFullYear(),n.getMonth(),n.getDate());
				out = "Here are the next few upcoming " + cfg.lang + " birthdays in this server:\n" +
					tulps.sort((a,b) => {
						let first = new Date(a.birthday);
						first.setFullYear(now.getFullYear());
						if(first < now) first.setFullYear(now.getFullYear()+1);
						let second = new Date(b.birthday);
						second.setFullYear(now.getFullYear());
						if(second < now) second.setFullYear(now.getFullYear()+1);
						return first.getTime()-second.getTime();
					}).slice(0,5)
						.map(t => {
							let bday = new Date(t.birthday);
							bday.setFullYear(now.getFullYear());
							if(bday < now) bday.setFullYear(now.getFullYear()+1);
							return (bday.getTime() == now.getTime()) ? `${t.name}: Birthday today! \uD83C\uDF70` : `${t.name}: ${bday.toDateString()}`;
						}).join("\n");
			} else if(!tulpae[msg.author.id] || !tulpae[msg.author.id].find(t => t.name.toLowerCase() === args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else if(!args[1]) {
				let bday = tulpae[msg.author.id].find(t => t.name.toLowerCase() === args[0].toLowerCase()).birthday;
				out = bday ? new Date(bday).toDateString() : "No birthday currently set for " + args[0];
			} else if(!(new Date(args[1]).getTime())) {
				out = "I can't understand that date. Please enter in the form MM/DD/YYYY with no spaces.";
			} else {
				let date = new Date(args[1]);
				tulpae[msg.author.id].find(t => t.name.toLowerCase() === args[0].toLowerCase()).birthday = date.getTime();
				save("tulpae",tulpae);
				out = `${proper(cfg.lang)} '${args[0]}' birthday set to ${date.toDateString()}.`;
			}
			send(msg.channel, out);
		}
	},
	
	brackets: {
		help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s brackets",
		usage: cfg =>  ["brackets <name> [brackets] - if brackets are given, change the " + cfg.lang + "'s brackets, if not, simply echo the current one"],
		desc: cfg => "Brackets must be the word 'text' surrounded by any symbols or letters, i.e. `[text]` or `>>text`",
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["brackets"], cfg);
			} else if(!tulpae[msg.author.id] || !tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else if(!args[1]) {
				let brackets = tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).brackets;
				out = `Brackets for ${args[0]}: ${brackets[0]}text${brackets[1]}`;
			} else {
				let brackets = msg.content.slice(msg.content.indexOf(args[0])+args[0].length+1).trim().split("text");
				if(brackets.length < 2) {
					out = "No 'text' found to detect brackets with. For the last part of your command, enter the word 'text' surrounded by any characters.\nThis determines how the bot detects if it should replace a message.";
				} else if(!brackets[0] && !brackets[1]) {
					out = "Need something surrounding 'text'.";
				} else {
					tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).brackets = brackets;
					save("tulpae",tulpae);
					out = "Brackets updated successfully.";
				}
			}
			send(msg.channel, out);
		}
	},
	
	togglebrackets: {
		help: cfg => "Toggles whether the brackets are included or stripped in proxied messages for the given " + cfg.lang,
		usage: cfg =>  ["togglebrackets <name> - toggles showing brackets on or off for the given " + cfg.lang],
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["togglebrackets"], cfg);
			} else if(!tulpae[msg.author.id] || !tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else {
				let tup = tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase());
				if(!tup.showbrackets) tup.showbrackets = false;
				tup.showbrackets = !tup.showbrackets;
				out = `Now ${tup.showbrackets ? "showing" : "hiding"} brackets in proxied messages for ${tup.name}.`;
			}
			send(msg.channel, out);
		}
	},
	
	tag: {
		help: cfg => "Remove or change " + article(cfg) + " " + cfg.lang + "'s tag (displayed next to name when proxying)",
		usage: cfg => ["tag <name> [tag] - if tag is given, change the " + cfg.lang + "'s tag, if not, clear the tag"],
		desc: cfg => proper(article(cfg)) + " " + cfg.lang + "'s tag is shown next to their name when speaking.",
		permitted: () => true,
		execute: function(msg, args, cfg) {
			let out = "";
			args = getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				return bot.cmds.help.execute(msg, ["tag"], cfg);
			} else if(!tulpae[msg.author.id] || !tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else if(!args[1]) {
				delete tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).tag;
				save("tulpae",tulpae);
				out = "Tag cleared.";
			} else if (args.slice(1).join(" ").length + tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).name.length > 27) {
				out = "That tag is too long to use with that " + cfg.lang + "'s name. The combined total must be less than 28 characters.";
			} else {
				tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).tag = args.slice(1).join(" ");
				save("tulpae",tulpae);
				out = "Tag updated successfully.";
			}
			send(msg.channel, out);
		}
	},
		
	
	showuser: {
		help: cfg => "Show the user that registered the " + cfg.lang + " that last spoke",
		usage: cfg =>  ["showuser - Finds the user that registered the " + cfg.lang + " that last sent a message in this channel"],
		permitted: (msg) => true,
		execute: function(msg, args, cfg) {
			if(!recent[msg.channel.id]) send(msg.channel, "No " + cfg.lang + "s have spoken in this channel since I last started up, sorry.");
			else {
				let user = bot.users.get(recent[msg.channel.id].userID);
				send(msg.channel, `Last ${cfg.lang} message sent by ${recent[msg.channel.id].tulpa.name}, registered to ${user ? user.username + "#" + user.discriminator : "(unknown user " + recent[msg.channel.id].userID + ")"}`);
			}
		}
	},
	
	find: {
		help: cfg => "Find and display info about " + cfg.lang + "s by name",
		usage: cfg =>  ["find <name> - Attempts to find " + article(cfg) + " " + cfg.lang + " with exactly the given name, and if none are found, tries to find " + cfg.lang + "s with names containing the given name."],
		permitted: (msg) => true,
		execute: function(msg, args, cfg) {
			if(msg.channel instanceof Eris.PrivateChannel)
				return send(msg.channel, "This command cannot be used in private messages.");
			if(!args[0])
				return bot.cmds.help.execute(msg, ["find"], cfg);
			let all = Object.keys(tulpae)
				.filter(id => msg.channel.guild.members.has(id))
				.reduce((arr, tul) => arr.concat(tulpae[tul]), []);
			if(!all[0]) {
				return send(msg.channel, "There are no " + cfg.lang + "s registered on this server.");
			}
			let search = args.join(" ").toLowerCase();
			let tul = all.filter(t => t.name.toLowerCase() == search);
			if(!tul[0])
				tul = all.filter(t => t.name.toLowerCase().includes(search));
			if(!tul[0])
				send(msg.channel, "Couldn't find " + article(cfg) + " " + cfg.lang + " with that name.");
			else {
				if(tul.length == 1) {
					let t = tul[0];
					let host = bot.users.get(t.host);
					let embed = { embed: {
						author: {
							name: t.name,
							icon_url: t.url
						},
						description: `Host: ${host ? host.username + "#" + host.discriminator : "Unknown user " + t.host}\n${generateTulpaField(t).value}`,
					}};
					send(msg.channel, embed);
				} else {
					tul = tul.slice(0,10);
					let embed = { embed: {
						title: "Results",
						fields: []
					}};
					tul.forEach(t => {
						let host = bot.users.get(t.host);
						embed.embed.fields.push({name: t.name, value: `Host: ${host ? host.username + "#" + host.discriminator : "Unknown user " + t.host}\n${generateTulpaField(t).value}`});
					});
					send(msg.channel, embed);
				}
			}
		}
	},
	
	invite: {
		help: cfg => "Get the bot's invite URL",
		usage: cfg =>  ["invite - sends the bot's oauth2 URL in this channel"],
		permitted: (msg) => true,
		execute: function(msg, args, cfg) {
			send(msg.channel, `https://discordapp.com/api/oauth2/authorize?client_id=${auth.inviteCode}&permissions=805314560&scope=bot`);
		}
	},
	
	feedback: {
		help: cfg => "Send a message to the developer, who may reply through the bot",
		usage: cfg =>  ["feedback <message> - send the message to the developer"],
		desc: cfg => "Dev note: I'm always happy to answer questions too, or just to chat!",
		permitted: (msg) => true,
		execute: function(msg, args, cfg) {
			if(!args[0]) return bot.cmds.help.execute(msg, ["feedback"], cfg);
			bot.createMessage("431722290971934721", `User: ${msg.author.id} ${msg.author.username}#${msg.author.discriminator}\nServer: ${msg.channel.guild ? msg.channel.guild.id + " " + msg.channel.guild.name : "DM"}\nChannel: ${msg.channel.id} ${msg.channel.name}\nMessage: ${args.join(" ")}`);
			send(msg.channel, "I've passed along your message, thank you.");
		}
	},
	
	cfg: {
		help: cfg => "Configure server-specific settings",
		usage: cfg =>  ["cfg prefix <newPrefix> - Change the bot's prefix",
			"cfg roles <enable|disable> - Enable or disable automatically managed mentionable " + cfg.lang + " roles, so that users can mention " + cfg.lang + "s",
			"cfg rename <newname> - Change all instances of the default name 'tulpa' in bot replies in this server to the specified term",
			"cfg log <channel> - Enable the bot to send a log of all " + cfg.lang + " messages and some basic info like who registered them. Useful for having a searchable channel and for distinguishing between similar names.",
			"cfg blacklist <add|remove> <channel(s)> - Add or remove channels to the bot's proxy blacklist - users will be unable to proxy in blacklisted channels.",
			"cfg cmdblacklist <add|remove> <channel(s)> - Add or remove channels to the bot's command blacklist - users will be unable to issue commands in blacklisted channels."],
		
		permitted: (msg) => (msg.member && msg.member.permission.has("administrator")),
		execute: function(msg, args, cfg) {
			let out = "";
			if(msg.channel instanceof Eris.PrivateChannel) {
				out = "This command cannot be used in private messages.";
			} else if(!args[0] || !["prefix","roles","rename","log","blacklist","cmdblacklist"].includes(args[0])) {
				return bot.cmds.help.execute(msg, ["cfg"], cfg);
			} else if(args[0] == "prefix") {
				if(!args[1]) {
					out = "Missing argument 'prefix'.";
				} else {
					cfg.prefix = args[1];
					out = "Prefix changed to " + args[1];
					save("servercfg",config);
				}
			} else if(args[0] == "roles") {
				if(!msg.channel.guild.members.get(bot.user.id).permission.has("manageRoles")) {
					out = "I don't have permission to manage roles.";
				} else if(args[1] === "enable") {
					let guild = msg.channel.guild;
					if(cfg.rolesEnabled)
						out = proper(cfg.lang) + " roles already enabled on this server.";
					else if(Object.keys(tulpae).filter(t => guild.members.has(t)).map(t => tulpae[t].length).reduce((acc,val) => acc+val, 0) + guild.roles.size > 245) {
						out = "Discord has a hard limit of 250 roles in a server, so I am unable to enable auto roles.";
					} else {
						enableRoles(guild);
						out = proper(cfg.lang) + " roles enabled. Adding the roles may take some time.";
					}
				} else if(args[1] === "disable") {
					let guild = msg.channel.guild;
					if(!cfg.rolesEnabled)
						out = proper(cfg.lang) + " roles already disabled on this server.";
					else {
						disableRoles(guild);
						out = proper(cfg.lang) + " roles disabled. Deleting the roles may take some time.";
					}
				} else {
					out = "Missing argument 'enable|disable'.";
				}
			} else if(args[0] == "rename") {
				if(!args[1]) {
					out = "Missing argument 'newname'";
				} else {
					cfg.lang = args.slice(1).join(" ");
					out = "Entity name changed to " + cfg.lang;
					save("servercfg",config);
				}
			} else if(args[0] == "log") {
				if(!args[1]) {
					out = "Logging channel unset. Logging is now disabled.";
					cfg.log = null;
					save("servercfg",config);
				} else {
					let channel = resolveChannel(msg,args[1]);
					if(!channel) {
						out = "Channel not found.";
					} else {
						out = `Logging channel set to <#${channel.id}>`;
						cfg.log = channel.id;
						save("servercfg",config);
					}
				}
			} else if(args[0] == "blacklist") {
				if(!args[1]) {
					if(cfg.blacklist) out = `Currently blacklisted channels: ${cfg.blacklist.map(id => "<#"+id+">").join(" ")}`;
					else out = "No channels currently blacklisted.";
				} else if(args[1] == "add") {
					if(!args[2]) {
						out = "Must provide name/mention/id of channel to blacklist.";
					} else {
						let channels = args.slice(2).map(arg => resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
						if(!channels.find(ch => ch != undefined)) {
							out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
						} else if(channels.find(ch => ch == undefined)) {
							out = "Could not find these channels: ";
							for(let i = 0; i < channels.length; i++)
								if(!channels[i]) out += args.slice(2)[i];
						} else {
							if(!cfg.blacklist) cfg.blacklist = [];
							cfg.blacklist = cfg.blacklist.concat(channels);
							out = `Channel${channels.length > 1 ? "s" : ""} blacklisted successfully.`;
							save("servercfg",config);
						}
					}
				} else if(args[1] == "remove") {
					if(!args[2]) {
						out = "Must provide name/mention/id of channel to allow.";
					} else {
						let channels = args.slice(2).map(arg => resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
						if(!channels.find(ch => ch != undefined)) {
							out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
						} else if(channels.find(ch => ch == undefined)) {
							out = "Could not find these channels: ";
							for(let i = 0; i < channels.length; i++)
								if(!channels[i]) out += args.slice(2)[i] + " ";
						} else {
							if(!cfg.blacklist) cfg.blacklist = [];
							channels.forEach(ch => { if(cfg.blacklist.includes(ch)) cfg.blacklist.splice(cfg.blacklist.indexOf(ch),1); });
							out = `Channel${channels.length > 1 ? "s" : ""} removed from blacklist.`;
							if(!cfg.blacklist[0]) delete cfg.blacklist;
							save("servercfg",config);
						}
					}
				} else {
					out = "Invalid argument: must be 'add' or 'remove'";
				}
			} else if(args[0] == "cmdblacklist") {
				if(!args[1]) {
					if(cfg.cmdblacklist) out = `Currently cmdblacklisted channels: ${cfg.cmdblacklist.map(id => "<#"+id+">").join(" ")}`;
					else out = "No channels currently cmdblacklisted.";
				} else if(args[1] == "add") {
					if(!args[2]) {
						out = "Must provide name/mention/id of channel to cmdblacklist.";
					} else {
						let channels = args.slice(2).map(arg => resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
						if(!channels.find(ch => ch != undefined)) {
							out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
						} else if(channels.find(ch => ch == undefined)) {
							out = "Could not find these channels: ";
							for(let i = 0; i < channels.length; i++)
								if(!channels[i]) out += args.slice(2)[i];
						} else {
							if(!cfg.cmdblacklist) cfg.cmdblacklist = [];
							cfg.cmdblacklist = cfg.cmdblacklist.concat(channels);
							out = `Channel${channels.length > 1 ? "s" : ""} blacklisted successfully.`;
							save("servercfg",config);
						}
					}
				} else if(args[1] == "remove") {
					if(!args[2]) {
						out = "Must provide name/mention/id of channel to allow.";
					} else {
						let channels = args.slice(2).map(arg => resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
						if(!channels.find(ch => ch != undefined)) {
							out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
						} else if(channels.find(ch => ch == undefined)) {
							out = "Could not find these channels: ";
							for(let i = 0; i < channels.length; i++)
								if(!channels[i]) out += args.slice(2)[i] + " ";
						} else {
							if(!cfg.cmdblacklist) cfg.cmdblacklist = [];
							channels.forEach(ch => { if(cfg.cmdblacklist.includes(ch)) cfg.cmdblacklist.splice(cfg.cmdblacklist.indexOf(ch),1); });
							out = `Channel${channels.length > 1 ? "s" : ""} removed from cmdblacklist.`;
							if(!cfg.cmdblacklist[0]) delete cfg.cmdblacklist;
							save("servercfg",config);
						}
					}
				} else {
					out = "Invalid argument: must be 'add' or 'remove'";
				}
			}
			send(msg.channel, out);
		}
	}
};

bot.cmds.showhost = {
	permitted: true,
	execute: bot.cmds.showuser.execute
};

if (!auth.inviteCode) {
	delete bot.cmds.invite;
}

function updateStatus() {
	bot.editStatus({ name: `tul!help | ${Object.values(tulpae).reduce((acc,val) => acc + val.length, 0)} registered`});
}

function validateGuildCfg(guild) {
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
	save("servercfg",config);
}

function validateRoles() {
	let tuppers = Object.values(tulpae).reduce((acc, val) => acc.concat(val),[]).filter(t => t.roles);
	let changes = 0;
	console.log("preliminary check of roles for guilds the bot is no longer in");
	tuppers.forEach(t => {
		Object.keys(t.roles).forEach(gid => {
			if(!bot.guilds.has(gid)) {
				console.log("Tupper",t.name,"of host",t.host,"has role for nonexistant guild",gid)
				changes++;
				delete t.roles[gid];
			}
		});
	});
	console.log("entering guild loop!");
	bot.guilds.forEach(guild => {
		let cfg = config[guild.id];
		let roled = tuppers.filter(t => t.roles[guild.id]);
		roled.forEach(t => {
			if(!guild.members.has(t.host) || !guild.roles.has(t.roles[guild.id])) {
				console.log("Member",t.host,"role should be deleted in guild",guild.name)
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
						changes++;
						if(guild.members.get(bot.user.id).permission.has("manageRoles"))
							guild.createRole({name:t.name,mentionable:true}).then(role => {
								if(!t.roles) t.roles = {};
								t.roles[guild.id] = role.id;
								m.addRole(role.id);
							});
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
		if(Object.keys(tul.roles).length == 0) delete tul.roles;
	});
	console.log("Changes:",changes);
	save("tulpae",tulpae);
}

function disableRoles(guild) {
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
	save("tulpae",tulpae);
	save("servercfg",config);
}

function enableRoles(guild) {
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
		save("tulpae",tulpae);
	});
	save("servercfg",config);
}

function proper(text) {
	return text.substring(0,1).toUpperCase() + text.substring(1);
}
let vowels = ["a","e","i","o","u"];
function article(cfg) {
	return vowels.includes(cfg.lang.slice(0,1)) ? "an" : "a";
}

function save(name, obj) {
	return fs.writeFile(`${__dirname}/${name}.json`,JSON.stringify(obj,null,2), printError);
}

function generateTulpaField(tulpa) {
	return {
		name: tulpa.name,
		value: `${tulpa.tag ? ("Tag: " + tulpa.tag + "\n") : ""}Brackets: ${tulpa.brackets[0]}text${tulpa.brackets[1]}\nAvatar URL: ${tulpa.url}${tulpa.birthday ? ("\nBirthday: "+new Date(tulpa.birthday).toDateString()) : ""}\nTotal messages sent: ${tulpa.posts}${tulpa.desc ? ("\n"+tulpa.desc) : ""}`
	};
}

async function paginate(msg, data) {
	if(!(msg.channel instanceof Eris.PrivateChannel) && !msg.channel.permissionsOf(bot.user.id).has("addReactions")) {
			for(let e of data) {
				await send(msg.channel, e);
			}
			return send(msg.channel, "'Add Reactions' permission missing, cannot use reaction buttons.\nUntil the permission is added, all pages will be sent at once and this message shall repeat each time the command is used.")
	}
	return send(msg.channel, data[0]).then(m => {
		buttons.forEach(b => bot.addMessageReaction(msg.channel.id,m.id,b));
		pages[m.id] = {
			user: msg.author.id,
			pages: data,
			index: 0
		};
		setTimeout(() => {
			if(!pages[m.id]) return;
			if(!(msg.channel instanceof Eris.PrivateChannel))
				bot.removeMessageReactions(msg.channel.id,m.id); 
			delete pages[m.id];
		}, 300000); //5 minutes
	});
}

function checkTulpaBirthday(tulpa) {
	if(!tulpa.birthday) return false;
	let day = new Date(tulpa.birthday);
	let now = new Date();
	return day.getDate() == now.getDate() && day.getMonth() == now.getMonth();
}

function resolveUser(msg, text) {
	let target = bot.users.get(/<@!?(\d+)>/.test(text) && text.match(/<@!?(\d+)>/)[1]) || bot.users.get(text) || msg.channel.guild.members.find(m => m.username.toLowerCase() == text.toLowerCase() || (m.nick && m.nick.toLowerCase()) == text.toLowerCase() || text.toLowerCase() == `${m.username.toLowerCase()}#${m.discriminator}`);
	if(target && target.user) target = target.user;
	return target;
}

function resolveChannel(msg, text) {
	let g = msg.channel.guild;
	return g.channels.get(/<#(\d+)>/.test(text) && text.match(/<#(\d+)>/)[1]) || g.channels.get(text) || g.channels.find(m => m.name.toLowerCase() == text.toLowerCase());
}

function checkPermissions(cmd, msg, args) {
	return (msg.author.id === auth.owner) || (bot.cmds[cmd].permitted(msg,args));
}

function printError(err) {
	if(err) return console.error(err);
}

function send(channel, message, file) {
	return channel.createMessage(message, file);
}

function getMatches(string, regex) {
	var matches = [];
	var match;
	while (match = regex.exec(string)) {
		match.splice(1).forEach(m => { if(m) matches.push(m); });
	}
	return matches;
}

process.on("unhandledRejection", console.log);

bot.connect();
