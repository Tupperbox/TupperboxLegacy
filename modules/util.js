const request = require("got");
const strlen = require("string-length");
const { PermissionsError, EmptyError } = require("./errors");

let tagRegex = /(@[\s\S]+?#0000|@\S+)/g;
let ignoreEvents = ['INVITE_CREATE','INVITE_DELETE'];

module.exports = bot => {  
	bot.removeAllListeners('unknown');
	bot.on('unknown',data => {
		if(!ignoreEvents.includes(data.t)) console.log(`Unknown Packet ${data.t}`);
	});
	bot.removeAllListeners('debug');
	let discordBanned = false;
	bot.on('debug',(data,shard) => {
		if(typeof data != "string") return console.log(data);
		if(data.includes('op":')) {
			if(!data.includes('op":1')) return console.log(`Shard ${shard} sent: ${data.replace(bot.token, "##TOKEN##")}`);
		}
		if(data.includes(" 429 (")) {
			if(data.includes("You are being blocked from accessing our API temporarily due to exceeding our rate limits frequently") && !discordBanned) discordBanned = true;  
			if(!discordBanned) console.log(data);
		}
		if(data.includes("left | Reset")) return;
		if(data.includes("close") || data.includes("reconnect")) {
			console.log(`Shard ${shard} ${data}`);
		}
	});
	bot.removeAllListeners('rawWS');
	bot.on('rawWS', (packet, shard) => {
		if(packet.op != 0 && packet.op != 11) console.log(`Shard ${shard} received: ${JSON.stringify(packet)}`);
	});

	bot.cooldowns = {};

	bot.replaceMessage = async (msg, cfg, member, content, retry = 2) => {
		const hook = await bot.fetchWebhook(msg.channel);
		let ratelimit = bot.requestHandler.ratelimits[`/webhooks/${hook.id}/:token?wait=true`];
		if(ratelimit && ratelimit._queue.length > 5) {
			let res = { message: "autoban",  notify: false };
			//ratelimit._queue = [];
			if(!ratelimit.expire || Date.now() > ratelimit.expire) {
				ratelimit.expire = Date.now() + 10000;
				res.notify = true;
			}
			throw res;
		}
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
		data.username = data.username.replace(/(c)(lyde)/gi, "$1\u200a$2");
		if(data.username.length > 80) data.username = data.username.slice(0,78) + "..";

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
			} else if((e.code == 504 || e.code == "EHOSTUNREACH") && retry > 0) {
				return await bot.replaceMessage(msg,cfg,member,content,retry-1);
			} else throw e;
		}

		bot.logProxy(msg, cfg, member, content, webmsg);

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
		if(error.message.startsWith("Request timed out") || error.code == 500 || error.code == "ECONNRESET" || error.code == "EHOSTUNREACH") return; //Internal discord errors don't need reporting
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

	bot.logProxy = async (msg, cfg, member, content, webmsg) => {
		if(cfg.log_channel && msg.channel.guild.channels.has(cfg.log_channel)) {
			let logchannel = msg.channel.guild.channels.get(cfg.log_channel);
			if(logchannel.type != 0 || typeof(logchannel.createMessage) != "function") {
				cfg.log_channel = null;
				bot.send(msg.channel, "Warning: There is a log channel configured but it is not a text channel. Logging has been disabled.");
				await bot.db.updateCfg(msg.channel.guild.id,"log_channel",null,bot.defaultCfg);
			}
			else if(!logchannel.permissionsOf(bot.user.id).has("sendMessages") || !logchannel.permissionsOf(bot.user.id).has("readMessages")) {
				bot.send(msg.channel, "Warning: There is a log channel configured but I do not have permission to send messages to it. Logging has been disabled.");
				await bot.db.updateCfg(msg.channel.guild.id,"log_channel",null,bot.defaultCfg);
			}
			else bot.send(logchannel, {embed: {
				title: member.name,
				description: content + "\n",
				fields: [
					{ name: "Registered by", value: `<@!${msg.author.id}> (${msg.author.id})`, inline: true},
					{ name: "Channel", value: `<#${msg.channel.id}> (${msg.channel.id})`, inline: true },
					{ name: "\u200b", value: "\u200b", inline: true},
					{ name: "Original Message", value: `[jump](https://discord.com/channels/${msg.channel.guild ? msg.channel.guild.id : "@me"}/${msg.channel.id}/${webmsg.id})`, inline: true},
					{ name: "Attachments", value: msg.attachments[0] ? msg.attachments.map((att, i) => `[link ${i+1}](${att.url})`).join(', ') : "None", inline: true},
					{ name: "\u200b", value: "\u200b", inline: true},
				],
				thumbnail: {url: member.avatar_url},
				footer: {text: `Message ID ${webmsg.id}`}
			}});
		}
	}

	bot.sendAttachmentsWebhook = async (msg, cfg, data, content, hook, member) => {
		let files = [];
		for(let i = 0; i < msg.attachments.length; i++) {
			let head;
			try {
				head = await request.head(msg.attachments[i].url);
			} catch(e) { }
			if(head && head.headers["content-length"] && Number(head.headers["content-length"]) > 8388608) throw new Error("toolarge");
			files.push({ file: await bot.attach(msg.attachments[i].url), name: msg.attachments[i].filename });
		}
		data.file = files;
		try {
			let webmsg = await bot.executeWebhook(hook.id,hook.token,data);
			bot.logProxy(msg, cfg, member, data.content, webmsg);
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
			} else if(e.code == 40005) {
				throw new Error("toolarge");
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
				} else if(e.code != 10003) throw e;
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
		bot.editStatus({ name: `${bot.defaultCfg.prefix}help | ${(await bot.db.query("SELECT COUNT(*) FROM Members")).rows[0].count} registered`});
	};

	bot.ageOf = user => {
		return (Date.now() - user.createdAt)/(1000*60*60*24);
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

	bot.generateMemberField = (member,group = null,add = 0) => {
		let out = {
			name: member.name.trim().length < 1 ? member.name + "\u200b" : member.name,
			value: `${(group != null) ? "Group: " + group.name + "\n" : ""}${member.tag ? ("Tag: " + member.tag + "\n") : ""}Brackets: ${bot.getBrackets(member)}\nAvatar URL: ${member.avatar_url}${member.birthday ? ("\nBirthday: "+member.birthday.toDateString()) : ""}\nTotal messages sent: ${member.posts}${member.description ? ("\n"+member.description) : ""}`
		};
		if(out.value.length + add > 1023) out.value = out.value.slice(0,1020-add) + "...";
		return out;
	};

	bot.getBrackets = member => {
		let out = [];
		for(let i=0; i<member.brackets.length; i+=2) {
			out.push(member.brackets[i] + "text" + member.brackets[i+1]);
		}
		return out.join(" | ");
	};

	bot.findAllUsers = async guildID =>  {
		let targets = [];
		let amtFound = 1000;
		let lastId = "0";
		while(amtFound == 1000) {
			let found = await bot.requestHandler.request("GET", `/guilds/${guildID}/members`, true, {limit:1000,after:lastId});
			amtFound = found.length;
			if(found.length > 0) lastId = found[found.length-1].user.id;
			targets = targets.concat(found.map(m => m.user));
		}
		return targets;
	}

	let buttons = ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9", "\u0023\u20e3", "\uD83D\uDD20"];
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
		bot.pages[m.id] = {
			user: msg.author.id,
			pages: data,
			index: 0
		};
		setTimeout(() => {
			if(!bot.pages[m.id]) return;
			if(msg.channel.guild && msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
				bot.removeMessageReactions(msg.channel.id,m.id).catch(e => { if(e.code != 10008) throw e; });  //discard "Unknown Message" - no way to know if the message has been deleted
			delete bot.pages[m.id];
		}, 900000);
		for(let i=0; i<buttons.length; i++)
			await bot.addMessageReaction(msg.channel.id,m.id,buttons[i]).catch(e => { if(e.code != 10008) throw e; });
	};

	bot.checkMemberBirthday = member => {
		if(!member.birthday) return false;
		let now = new Date();
		return member.birthday.getUTCDate() == now.getUTCDate() && member.birthday.getUTCMonth() == now.getUTCMonth();
	};

    bot.resolveUser = async (msg, text) => {
        let uid = /<@!?(\d+)>/.test(text) && text.match(/<@!?(\d+)>/)[1] || text;
        if (/^\d+$/.test(uid)) {
			let target = null;
			target = await bot.getRESTUser(uid).catch(e => { if(e.code != 10013) throw e; return null }); //return null if user wasn't found, otherwise throw
            if (target && target.user) target = target.user;
            return target;
        } else return null;
	};

	bot.resolveChannel = (msg, text) => {
		let g = msg.channel.guild;
		return g.channels.get(/<#(\d+)>/.test(text) && text.match(/<#(\d+)>/)[1]) || g.channels.get(text) || g.channels.find(m => m.name.toLowerCase() == text.toLowerCase());
	};

	bot.getConfig = async (guild) => {
		let cfg;
		if(guild) cfg = await bot.db.getCfg(guild.id);
		if(!cfg) cfg = { ...bot.defaultCfg };
		return cfg;
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

	bot.send = async (channel, message, file, retry = 2) => {
		if(!channel.id) return;
		let msg;
		try {
			if(bot.announcement && message.embed) {
				if(!message.content) message.content = "";
				message.content += "\n"+bot.announcement;
			}
			msg = await channel.createMessage(message, file);
		} catch(e) {
			if(e.message.startsWith("Request timed out") || (e.code >= 500 && e.code <= 599) || e.code == "EHOSTUNREACH") {
				if(retry > 0) return bot.send(channel,message,file,retry-1);
				else return;
			} else throw e;
		}
		return msg;
	};

	bot.sanitizeName = name => {
		return name.trim();
	};

	bot.noVariation = word => {
		return word.replace(/[\ufe0f]/g,"");
	};

	bot.banAbusiveUser = async (userID, notifyChannelID) => {
		if(userID == bot.user.id) return;
		let membersDeleted = await bot.db.query("DELETE FROM members WHERE user_id = $1",[userID]);
		let blacklistedNum = 0;
		try {
			blacklistedNum = (await bot.db.query("INSERT INTO global_blacklist values($1::VARCHAR(50))",[userID])).rowCount;
		} catch(e) { console.log(e.message); }
		console.log(`blacklisted ${blacklistedNum} user ${userID} and deleted ${membersDeleted.rowCount} tuppers`);
		bot.createMessage(notifyChannelID,`User <@${userID}> (${userID}) is now blacklisted for abuse.`);
	};

	bot.checkBlacklist = async (member, channel, proxy) => {
		//these conditions are split up because otherwise it's very difficult to read
		if(!channel) return false;
		if(!channel.guild) return false;
		if(!member) return false;
		if(member.permission.has("manageGuild")) return false;
		if(await bot.db.isBlacklisted(channel.guild.id,channel.id,proxy)) return true;
		return (channel.parentID && await bot.db.isBlacklisted(channel.guild.id,channel.parentID,proxy));
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
