module.exports = async (msg,bot) => {
	let ctx = await bot.getMessageContext(msg);
	if (ctx.done) return;
	await bot.cmd(ctx); 
	if (msg.channel.guild) await bot.proxy(ctx);
};
