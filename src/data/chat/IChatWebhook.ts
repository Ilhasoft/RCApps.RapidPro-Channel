import { ILivechatRoom, ILivechatTransferEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';

export default interface IChatWebhook {

    onDirectMessage(callbackUrl: string, userUsername: string, userFullName: string, message?: string, attachments?: Array<IMessageAttachment>): Promise<void>;

    onLivechatMessage(callbackUrl: string, visitorToken: string, userUsername: string, userFullName: string, message?: string, attachments?: Array<IMessageAttachment>): Promise<void>;

    updateVisitorRoomId(visitorToken: string, roomId: string): Promise<void>;

    onLivechatRoomClosed(visitorToken: string, flowUuid: string, roomData: ILivechatRoom): Promise<void>;

    onLivechatRoomTransferred(visitorToken: string, flowUuid: string, context: ILivechatTransferEventContext): Promise<void>;
}
