let discordBanned = false;

module.exports = (data,shard,bot)  => {
	if(typeof data != "string") return console.log(data);
	if(data.includes("op\":")) {
		if(!data.includes("op\":1")) return console.log(`Shard ${shard} sent: ${data.replace(bot.token, "##TOKEN##")}`);
	}
	if(data.includes(" 429 (")) {
		if(!discordBanned) console.log(data);
		if(data.includes("You are being blocked from accessing our API temporarily due to exceeding our rate limits frequently") && !discordBanned) discordBanned = true;  
	}
	if(data.includes("left | Reset")) return;
	if(data.includes("close") || data.includes("reconnect")) {
		console.log(`Shard ${shard} ${data}`);
	}
};