import { Client, LiveVideo, SuperChat } from ".";

const youtube = new Client({ youtubeClientOptions: { hl: "en" } });

const LIVE_VIDEO_ID = "5qap5aO4i9A";

async function setupYouTubeI() {
	// get the video

	const youtube = new Client();

	const video = await youtube.getVideo(LIVE_VIDEO_ID);

	if (!video || !(video instanceof LiveVideo)) return;

	// add event listener
	video.on("chat", (chat) => {
		console.log(`${chat.author.name}:  ${chat.message}`);
	});

	video.playChat(-10004000); // start chat polling with 5000ms chat delay
}

setupYouTubeI();
