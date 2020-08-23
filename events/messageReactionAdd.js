
module.exports = async (message, emoji, userID, bot) => {
	if(emoji.user && emoji.user.bot) return;

	if(emoji.name == "\u274c" && bot.recent[message.channel.id] && bot.recent[message.channel.id].find(r => r.user_id == userID && message.id == r.id)) {
		if(!message.channel.guild || message.channel.permissionsOf(bot.user.id).has("manageMessages"))
			bot.deleteMessage(message.channel.id,message.id);
		return;
	} else if(emoji.name == "\u2753" && bot.recent[message.channel.id]) {
		let recent = bot.recent[message.channel.id].find(r => message.id == r.id);
		if(!recent) return;
		let response = { content: `That proxy was sent by <@!${recent.user_id}> (tag at time of sending: ${recent.tag} - id: ${recent.user_id}).`, allowedMentions: { users: false } };
		let target;
		try {
			target = await bot.getDMChannel(userID);
			await bot.send(target,response);
		} catch(e) {
			target = message.channel;
			response.content = `<@${userID}>: ${response.content}\n(also I am unable to DM you!)`;
			await bot.send(target,response);
		}
		await bot.removeMessageReaction(message.channel.id, message.id, emoji.name, userID);
		return;
	}

	if(!bot.paginator.cache[message.id] || bot.paginator.cache[message.id].user != userID || !bot.paginator.buttons.includes(emoji.name)) return;

	bot.paginator.handleReaction(bot, message, emoji, userID);
};