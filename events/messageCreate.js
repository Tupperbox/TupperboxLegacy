module.exports = async (msg,bot) => {
	let ctx = await bot.getMessageContext(msg);
	if (ctx.done) return;
	if (await bot.cmd(ctx) && msg.channel.guild) await bot.proxy(ctx);
};
