import { EventEmitter } from "events";
import { applyMixins, YoutubeRawData } from "../common";
import { Chat, BaseVideo, BaseVideoAttributes, SuperChat } from ".";
import { LIVE_CHAT_END_POINT, LIVE_CHAT_REPLAY_END_POINT } from "../constants";

/** @hidden */
interface LiveVideoAttributes extends BaseVideoAttributes {
	watchingCount: number;
	chatContinuation?: string;
	isReplay: boolean;
}

interface LiveVideoEvents {
	chat: (chat: Chat) => void;
}

enum ChatType {
	CHAT,
	SUPERCHAT,
}

declare interface LiveVideo {
	on<T extends keyof LiveVideoEvents>(
		event: T,
		listener: LiveVideoEvents[T]
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): AsyncIterableIterator<any>;
	emit<T extends keyof LiveVideoEvents>(
		event: T,
		...args: Parameters<LiveVideoEvents[T]>
	): boolean;
}

/** Represents a video that's currently live, usually returned from `client.getVideo()` */
class LiveVideo extends BaseVideo implements LiveVideoAttributes {
	/** Number of people who's watching the live stream right now */
	watchingCount!: number;
	/** Current continuation token to load next chat  */
	chatContinuation!: string;
	/** Whether this video is a replay or currently live */
	isReplay!: boolean;

	private _startTime = Date.now();
	private _delay = 0;
	private _chatRequestPoolingTimeout!: NodeJS.Timeout;
	private _timeoutMs = 0;
	private _isChatPlaying = false;
	private _chatQueue: Chat[] = [];

	/** @hidden */
	constructor(video: Partial<LiveVideoAttributes> = {}) {
		super();
		Object.assign(this, video);
	}

	/**
	 * Load this instance with raw data from Youtube
	 *
	 * @hidden
	 */
	load(data: YoutubeRawData): LiveVideo {
		super.load(data);

		const videoInfo = BaseVideo.parseRawData(data);

		this.watchingCount = this.isReplay
			? videoInfo.viewCount
			: +videoInfo.viewCount.videoViewCountRenderer.viewCount.runs
					.map((r: YoutubeRawData) => r.text)
					.join(" ")
					.replace(/[^0-9]/g, "");

		this.chatContinuation =
			data[3].response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations[0].reloadContinuationData.continuation;

		return this;
	}

	/**
	 * Start polling for get live chat request
	 *
	 * @param delay chat delay in millisecond
	 */
	playChat(delay = 0): void {
		if (this._isChatPlaying) return;
		this._delay = delay;
		this._isChatPlaying = true;
		this.pollChatContinuation();
	}

	/** Stop request polling for live chat */
	stopChat(): void {
		if (!this._chatRequestPoolingTimeout) return;
		this._isChatPlaying = false;
		clearTimeout(this._chatRequestPoolingTimeout);
	}

	/** Start request polling */
	private async pollChatContinuation() {
		const response = await this.client.http.post(
			this.isReplay ? LIVE_CHAT_REPLAY_END_POINT : LIVE_CHAT_END_POINT,
			{
				data: {
					continuation: this.chatContinuation,
					currentPlayerState: { playerOffsetMs: `${Date.now() - this._startTime}` },
				},
			}
		);

		// console.log(response.data.continuationContents.liveChatContinuation.actions);

		this.parseChat(response.data);

		const contParent = response.data.continuationContents.liveChatContinuation.continuations[0];

		let timedContinuation = this.isReplay
			? contParent.liveChatReplayContinuationData
			: contParent.timedContinuationData;

		if (contParent.invalidationContinuationData)
			timedContinuation = contParent.invalidationContinuationData;

		if (contParent.playerSeekContinuationData)
			timedContinuation = contParent.playerSeekContinuationData;

		this._timeoutMs = this._delay; //timedContinuation.timeoutMs || this._delay;
		if (!timedContinuation) console.log(contParent);
		this.chatContinuation = timedContinuation.continuation;

		// console.log("polling", this._timeoutMs, Date.now());

		this._chatRequestPoolingTimeout = setTimeout(
			() => this.pollChatContinuation(),
			this._timeoutMs
		);
	}

	/** Parse chat data from Youtube and add to chatQueue */
	private parseChat(data: YoutubeRawData): void {
		try {
			if (!data.continuationContents.liveChatContinuation.actions) return;

			const chats = data.continuationContents.liveChatContinuation.actions.flatMap(
				(a: YoutubeRawData) => {
					let data = null;
					let offsetMsec = "0";

					if (a.replayChatItemAction) {
						offsetMsec = a.replayChatItemAction.videoOffsetTimeMsec;

						a = a.replayChatItemAction.actions[0];
					}

					if (a.addChatItemAction?.item) {
						let item = a.addChatItemAction?.item;

						if (item.liveChatTextMessageRenderer) {
							data = { ...item.liveChatTextMessageRenderer, type: ChatType.CHAT };
						} else if (item.liveChatPaidMessageRenderer) {
							data = {
								...item.liveChatPaidMessageRenderer,
								type: ChatType.SUPERCHAT,
							};
						}

						if (this.isReplay && data)
							data.timestampUsec = (+offsetMsec + this._startTime) * 1000;
					}

					return data || [];
				}
			);

			for (const rawChatData of chats) {
				let chat = new Chat({ client: this.client }).load(rawChatData);

				switch (rawChatData.data) {
					case ChatType.SUPERCHAT: {
						chat = new SuperChat({ client: this.client }).load(rawChatData);
						break;
					}
				}

				if (this._chatQueue.find((c) => c.id === chat.id)) continue;
				this._chatQueue.push(chat);

				setTimeout(() => {
					this.emit("chat", chat);
				}, chat.timestamp / 1000 - (Date.now() - this._delay));
			}
		} catch (error) {
			console.log(error);
			console.log(data.continuationContents.liveChatContinuation);
		}
	}
}

applyMixins(LiveVideo, [EventEmitter]);
export default LiveVideo;
