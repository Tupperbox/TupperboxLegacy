module.exports = bot => {  
	bot.logger.info(`Connected\nLogged in as:\n${bot.user.username} - (${bot.user.id})`);
	bot.updateStatus();
	setInterval(() => bot.updateStatus(), 1800000);
	bot.guilds.forEach(guild => bot.validateGuildCfg(guild));
};