module.exports = bot => {
	let buttons = ["\u23ea", "\u2b05", "\u27a1", "\u23e9", "\u23f9"];
  
	bot.on("messageReactionAdd", function(message, emoji, userID) {
		if(!bot.pages[message.id] || bot.pages[message.id].user != userID || !buttons.includes(emoji.name)) return;
		let data = bot.pages[message.id];
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
			return bot.deleteMessage(message.channel.id, message.id);
		}
		bot.editMessage(message.channel.id, message.id, data.pages[data.index]);
		if(message.channel.type != 1)
			bot.removeMessageReaction(message.channel.id, message.id, emoji.name, userID);
	});
};