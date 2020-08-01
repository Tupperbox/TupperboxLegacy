module.exports = (packet, shard, bot) => {
	if(packet.op != 0 && packet.op != 11) 
		console.log(`Shard ${shard} received: ${JSON.stringify(packet)}`);
};