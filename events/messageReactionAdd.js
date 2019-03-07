let buttons = ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9", "\u0023\u20e3"];

module.exports = async (message, emoji, userID, bot) => {
	if(emoji.name == "\u274c" && bot.recent[message.channel.id] && bot.recent[message.channel.id].find(r => r.user_id == userID && message.id == r.id)) {
		if(!message.channel.guild || message.channel.permissionsOf(bot.user.id).has('manageMessages'))
			bot.deleteMessage(message.channel.id,message.id);
		return;
	} else if(emoji.name == "\u2753" && bot.recent[message.channel.id]) {
		let recent = bot.recent[message.channel.id].find(r => message.id == r.id);
		if(!recent) return;
		let response = `That proxy was sent by ${recent.tag}.`;
		let target;
		try {
			target = await bot.getDMChannel(userID);
			await bot.send(target,response);
		} catch(e) {
			target = message.channel;
			response = `<@${userID}>: ${response}\n(also I am unable to DM you!)`;
			try{await bot.send(target,response);}catch(e){}
		}
		try{await bot.removeMessageReaction(message.channel.id, message.id, emoji.name, userID);}catch(e){}
		return;
	}
	if(!bot.pages[message.id] || bot.pages[message.id].user != userID || !buttons.includes(emoji.name)) return;
	let data = bot.pages[message.id];
	try {
		if(message.channel.type != 1 && message.channel.permissionsOf(bot.user.id).has("manageMessages"))
			await bot.removeMessageReaction(message.channel.id, message.id, emoji.name, userID);
	} catch(e) {
		if(!e.message.startsWith("Request timed out") && e.code != 500) bot.err(message,e,false);
	}
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
			delete bot.pages[message.id];
			if(message.channel.type != null && message.channel.type != 1 && !message.channel.permissionsOf(bot.user.id).has("manageMessages")) return;
			try {
				return await bot.deleteMessage(message.channel.id, message.id);
			} catch(e) {
				return console.error(e.stack);
			}

		case "\u0023\u20e3": //go to num
			if(bot.dialogs[message.channel.id + userID]) return;
			let msg1,msg2;
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
					setTimeout(() => bot.deleteMessage(message.channel.id,id), 3000);
					msg1 = null;
				}
			} catch(e) {
				if(e == "timeout") {
					msg1.edit("Timed out - canceling.");
					let id = msg1.id;
					setTimeout(() => {
						bot.deleteMessage(message.channel.id,id).catch(dontCare => {});
					},3000);
					msg1 = null;
				} else {
					console.error(e.stack);
				}
			}
			if(msg1) msg1.delete();
			if(msg2 && msg2.channel.type != 1) msg2.delete();
			break;
	}
	try {
		await bot.editMessage(message.channel.id, message.id, data.pages[data.index]);
	} catch(e) {
		if(e.code != 10008) bot.err(message, e, false);
	}
};