import { HttpStatusCode } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';

import AppError from '../../domain/AppError';
import IAttachment from '../../domain/Attachment';
import IAppDataSource from '../app/IAppDataSource';
import IChatInternalDataSource from './IChatInternalDataSource';
import IChatRepository from './IChatRepository';
import IChatWebhook from './IChatWebhook';

export default class ChatRepositoryImpl implements IChatRepository {

    constructor(
        private readonly internalDataSource: IChatInternalDataSource,
        private readonly chatWebhook: IChatWebhook,
        private readonly appPersis: IAppDataSource,
    ) { }

    public async sendMessage(userUrn: string, botUsername: string, text?: string, attachments?: Array<IAttachment>): Promise<string> {

        const botUser = await this.internalDataSource.getUserByUsername(botUsername);
        if (!botUser) {
            throw new AppError(`Could not find bot with username ${botUsername}`, HttpStatusCode.NOT_FOUND);
        }
        // userIdentifier will be username if type === `direct` or token if type === `livechat`
        if (userUrn.indexOf(':') === -1) {
            throw new AppError(`Invalid user identification: ${userUrn}`, HttpStatusCode.BAD_REQUEST);
        }
        const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];

        if (type === 'direct') {
            const user = await this.internalDataSource.getUserByUsername(userIdentifier);
            if (!user) {
                throw new AppError(`User not found ${userUrn}`, HttpStatusCode.BAD_REQUEST);
            }
            return await this.internalDataSource.sendMessage(botUser, user, text, attachments);
        } else if (type === 'livechat') {
            const visitor = await this.internalDataSource.getVisitorByToken(userIdentifier);
            if (!visitor) {
                throw new AppError(`Could not find visitor with token: ${userIdentifier}`, HttpStatusCode.NOT_FOUND);
            }

            return await this.internalDataSource.sendLivechatMessage(botUser, visitor, text, attachments);
        } else {
            throw new AppError(`Invalid room type: ${type}`, HttpStatusCode.BAD_REQUEST);
        }
    }

    public async onDirectMessage(
        userUsername: string,
        botUsername: string,
        userFullName: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ): Promise<void> {

        const callbackUrl = await this.getBotCallback(botUsername);
        if (!callbackUrl) {
            return;
        }

        await this.chatWebhook.onDirectMessage(callbackUrl, userUsername, userFullName, message, attachments);
    }
    public async onLivechatMessage(
        visitorToken: string,
        botUsername: string,
        userFullName: string,
        userUsername: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ): Promise<void> {
        const callbackUrl = await this.getBotCallback(botUsername);
        if (!callbackUrl) {
            return;
        }

        await this.chatWebhook.onLivechatMessage(callbackUrl, visitorToken, userUsername, userFullName, message, attachments);
    }

    private async getBotCallback(botUsername: string) {
        return await this.appPersis.getCallbackUrl(botUsername);
    }

    public async onVisitorRoomIdField(visitorToken: string, roomId: string) {
        await this.chatWebhook.updateVisitorRoomId(visitorToken, roomId);
    }
}
