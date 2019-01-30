let disconnects = 0;

module.exports = bot => {
	bot.logger.warn("Bot disconnected! Attempting to reconnect.");
	disconnects++;
	if(disconnects < 50)
		bot.connect();
};