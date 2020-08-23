module.exports = async (msg,bot) => {
	let ctx = await bot.getMessageContext(msg);
	if (!ctx.done && await bot.cmd(ctx) && msg.channel.guild && !(await bot.db.isBlacklisted(msg.channel.guild.id, msg.channel.id, true))) bot.proxy.executeProxy(ctx);
};
