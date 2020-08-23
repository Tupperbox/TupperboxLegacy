
module.exports = async (message, emoji, userID, bot) => {
	if(emoji.user && emoji.user.bot) return;

	if(emoji.name == "\u274c" && bot.recent[message.channel.id] && bot.recent[message.channel.id].find(r => r.user_id == userID && message.id == r.id)) {
		if(!message.channel.guild || message.channel.permissionsOf(bot.user.id).has("manageMessages"))
			bot.deleteMessage(message.channel.id,message.id);
		return;
	}
	else if(emoji.name == "\u2753" && bot.recent[message.channel.id]) return await bot.proxy.sendMsgInfo(bot, message);

	if(!bot.paginator.cache[message.id] || bot.paginator.cache[message.id].user != userID || !bot.paginator.buttons.includes(emoji.name)) return;

	bot.paginator.handleReaction(bot, message, emoji, userID);
};