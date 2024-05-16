import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { ILivechatRoom, ILivechatTransferEventContext } from '@rocket.chat/apps-engine/definition/livechat';

import IAttachment from '../../domain/Attachment';

export default interface IChatRepository {

    sendMessage(userUrn: string, botUsername: string, text?: string, attachments?: Array<IAttachment>): Promise<string>;

    onDirectMessage(userUsername: string, botUsername: string, userFullName: string, message?: string, attachments?: Array<IMessageAttachment>): Promise<void>;

    onLivechatMessage(visitorToken: string, botUsername: string, userFullName: string, userUsername: string, message?: string, attachments?: Array<IMessageAttachment>): Promise<void>;

    onLivechatRoomClosed(visitorToken: string, flowUuid: string, roomData: ILivechatRoom): Promise<void>;

    onLivechatRoomTransferred(visitorToken: string, flowUuid: string, context: ILivechatTransferEventContext): Promise<void>;
}
