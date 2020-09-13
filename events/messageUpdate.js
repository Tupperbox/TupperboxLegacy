module.exports = async (msg,_,bot) => {
	// occasionally errors on bot message embeds for some reason?
	if (msg.author) bot.msg(bot, msg);
};