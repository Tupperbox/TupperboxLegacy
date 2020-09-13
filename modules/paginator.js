
module.exports = {
	buttons: ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9", "\u0023\u20e3", "\uD83D\uDD20"],
	cache: {},

	paginate: async (bot, msg, data) => {
		if(!(msg.channel.type == 1)) {
			let perms = msg.channel.permissionsOf(bot.user.id);
			if(!perms.has("readMessages") || !perms.has("sendMessages") || !perms.has("embedLinks")) return;
			if(!perms.has("addReactions") || !perms.has("readMessageHistory")) {
				await bot.send(msg.channel, data[0]);
				if(!perms.has("addReactions")) return "'Add Reactions' permission missing, cannot use reaction module.exports.buttons. Only first page shown.";
				else return "'Read Message History' permission missing, cannot use reaction module.exports.buttons. (Discord requires this permission to add reactions.) Only first page shown.";
			}
		}
		let m = await bot.send(msg.channel, data[0]);
		module.exports.cache[m.id] = {
			user: msg.author.id,
			pages: data,
			index: 0
		};
		setTimeout(() => {
			if(!module.exports.cache[m.id]) return;
			if(msg.channel.guild && msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
				bot.removeMessageReactions(msg.channel.id,m.id).catch(bot.ignoreDeletion);  //discard "Unknown Message" - no way to know if the message has been deleted
			delete module.exports.cache[m.id];
		}, 900000);
		for(let i=0; i<module.exports.buttons.length; i++)
			await bot.addMessageReaction(msg.channel.id,m.id,module.exports.buttons[i]).catch(bot.ignoreDeletion);
	},

	generatePages: async (bot, arr, fieldGen, extra = {}) => {
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
	},

	generateMemberField: (bot, member,group = null,add = 0) => {
		let out = {
			name: member.name.trim().length < 1 ? member.name + "\u200b" : member.name,
			value: `${(group != null) ? "Group: " + group.name + "\n" : ""}${member.tag ? ("Tag: " + member.tag + "\n") : ""}Brackets: ${bot.getBrackets(member)}\nAvatar URL: ${member.avatar_url}${member.birthday ? ("\nBirthday: "+member.birthday.toDateString()) : ""}\nTotal messages sent: ${member.posts}${member.description ? ("\n"+member.description) : ""}`
		};
		if(out.value.length + add > 1023) out.value = out.value.slice(0,1020-add) + "...";
		return out;
	},
    
	handleReaction: async (bot, message, emoji, userID) => {
		let data = module.exports.cache[message.id];
		try {
			if(message.channel.type != 1 && message.channel.permissionsOf(bot.user.id).has("manageMessages"))
				await bot.removeMessageReaction(message.channel.id, message.id, emoji.name, userID);
		} catch(e) {
			if(!e.message.startsWith("Request timed out") && e.code != 500 && e.code != 10008) bot.err(message,e,false);
		}
		let msg1,msg2;
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
			delete module.exports.cache[message.id];
			if(message.channel.type != null && message.channel.type != 1 && !message.channel.permissionsOf(bot.user.id).has("manageMessages")) return;
			try {
				return await bot.deleteMessage(message.channel.id, message.id);
			} catch(e) {
				return bot.err(message, e, false);
			}

		case "\u0023\u20e3": //go to num
			if(bot.dialogs[message.channel.id + userID]) return;
			try {
				msg1 = await bot.send(message.channel, "Enter a page number to go to.");
				message.author = {id: userID};
				msg2 = await bot.waitMessage(message);
				if(!isNaN(Number(msg2.content))) {
					data.index = Math.round(Number(msg2.content)-1);
					if(data.index < 0) data.index = 0;
					if(data.index >= data.pages.length) data.index = data.pages.length - 1;
				} else {
					msg1.edit("Invalid number.");
					let id = msg1.id;
					//setTimeout(() => bot.deleteMessage(message.channel.id,id).catch(bot.ignoreDeletion), 3000);
					msg1 = null;
				}
			} catch(e) {
				if(e == "timeout") {
					msg1.edit("Timed out - canceling.").catch(bot.ignoreDeletion);
					let id = msg1.id;
					/*setTimeout(() => {
                            bot.deleteMessage(message.channel.id,id).catch(bot.ignoreDeletion);
                        },3000);*/
					msg1 = null;
				} else {
					bot.err(message, e, false);
				}
			}
			//if(msg1) msg1.delete().catch(bot.ignoreDeletion);
			//if(msg2 && msg2.channel.type != 1) msg2.delete().catch(bot.ignoreDeletion);
			break;

		case "\ud83d\udd20": //find in list
			if(bot.dialogs[message.channel.id + userID]) return;
			try {
				msg1 = await bot.send(message.channel, "Enter text to search for.");
				message.author = {id: userID};
				msg2 = await bot.waitMessage(message);
				let search = msg2.content.toLowerCase();
				let searchFunc = test => {
					for(let i = 0; i < data.pages.length; i++) {
						if(!data.pages[i].embed.fields || data.pages[i].embed.fields.length == 0) continue;
						for(let j = 0; j < data.pages[i].embed.fields.length; j++) {
							if(test(data.pages[i].embed.fields[j])) {
								return i;
							}
						}
					}
					return -1;
				};
				let res = searchFunc(f => f.name.toLowerCase() == search);
				if(res < 0) res = searchFunc(f => f.name.toLowerCase().includes(search));
				if(res < 0) res = searchFunc(f => f.value.toLowerCase().includes(search));
				if(res < 0) {
					msg1.edit("No result found.").catch(bot.ignoreDeletion);
					let id = msg1.id;
					/*setTimeout(() => {
                            bot.deleteMessage(message.channel.id,id).catch(bot.ignoreDeletion);
                        },3000);*/
					msg1 = null;
				} else data.index = res;
			} catch(e) {
				if(e == "timeout") {
					msg1.edit("Timed out - canceling.").catch(bot.ignoreDeletion);
					let id = msg1.id;
					/*setTimeout(() => {
                            bot.deleteMessage(message.channel.id,id).catch(bot.ignoreDeletion);
                        },3000);*/
					msg1 = null;
				} else {
					bot.err(message, e, false);
				}
			}
			//if(msg1) msg1.delete().catch(bot.ignoreDeletion);
			//if(msg2 && msg2.channel.type != 1) msg2.delete().catch(bot.ignoreDeletion);
			break;
		}
		try {
			await bot.editMessage(message.channel.id, message.id, data.pages[data.index]).catch(bot.ignoreDeletion); //ignore message already deleted
		} catch(e) {
			bot.err(message, e, false);
		}
	},

};