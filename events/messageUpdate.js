module.exports = async (msg,_,bot) => {
	// occasionally errors on bot message embeds for some reason?
	if (!msg.author) return;
        // ignore messages sent more than 10 minutes ago
        if (Date.now() - msg.timestamp > 1000*60*10) return;
        bot.msg(bot, msg);
};
