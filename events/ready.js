module.exports = bot => {  
	bot.updateStatus();
	setInterval(() => bot.updateStatus(), 1800000);
};