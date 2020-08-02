module.exports = async (msg,_,bot) => {
    if (!msg.author) return; // occasionally errors on bot message embeds for some reason?
	let ctx = await bot.getMessageContext(msg);
	if (!ctx.done && msg.channel.guild) bot.proxy(ctx);
}