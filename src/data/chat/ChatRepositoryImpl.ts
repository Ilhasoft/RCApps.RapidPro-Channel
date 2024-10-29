import { HttpStatusCode, ILogger } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';

import AppError from '../../domain/AppError';
import IAttachment from '../../domain/Attachment';
import IAppDataSource from '../app/IAppDataSource';
import IChatInternalDataSource from './IChatInternalDataSource';
import IChatRepository from './IChatRepository';
import IChatWebhook from './IChatWebhook';
import { ILivechatRoom, ILivechatTransferEventContext } from '@rocket.chat/apps-engine/definition/livechat';

export default class ChatRepositoryImpl implements IChatRepository {

    constructor(
        private readonly internalDataSource: IChatInternalDataSource,
        private readonly chatWebhook: IChatWebhook,
        private readonly appPersis: IAppDataSource,
        private readonly logger: ILogger,
        private readonly debugEnabled: boolean,
    ) { }

    private debug(...items: Array<any>): void {
        if (this.debugEnabled) {
            this.logger.debug(items);
        }
    }

    public async sendMessage(userUrn: string, botUsername: string, text?: string, attachments?: Array<IAttachment>): Promise<string> {

        const botUser = await this.internalDataSource.getUserByUsername(botUsername);
        if (!botUser) {
            this.debug(`Could not find bot with username ${botUsername}`);
            throw new AppError(`Could not find bot with username ${botUsername}`, HttpStatusCode.NOT_FOUND);
        }
        // userIdentifier will be username if type === `direct` or token if type === `livechat`
        if (userUrn.indexOf(':') === -1) {
            this.debug(`Invalid user identification: ${userUrn}`);
            throw new AppError(`Invalid user identification: ${userUrn}`, HttpStatusCode.BAD_REQUEST);
        }
        const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];

        if (type === 'direct') {
            const user = await this.internalDataSource.getUserByUsername(userIdentifier);
            if (!user) {
                this.debug(`User not found ${userUrn}`);
                throw new AppError(`User not found ${userUrn}`, HttpStatusCode.BAD_REQUEST);
            }
            this.debug(`Sending message to user ${userUrn}`);
            return await this.internalDataSource.sendMessage(botUser, user, text, attachments);
        } else if (type === 'livechat') {
            const visitor = await this.internalDataSource.getVisitorByToken(userIdentifier);
            if (!visitor) {
                this.debug(`Could not find visitor with token: ${userIdentifier}`);
                throw new AppError(`Could not find visitor with token: ${userIdentifier}`, HttpStatusCode.NOT_FOUND);
            }
            this.debug(`Sending message to livechat visitor ${userUrn}`);
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
            this.debug(`Could not find callback url for bot ${botUsername}`);
            return;
        }

        this.debug(`Sending direct message to bot ${botUsername}, from user ${userUsername}`);
        await this.chatWebhook.onDirectMessage(callbackUrl, userUsername, userFullName, message, attachments);
    }
    public async onLivechatMessage(
        visitorToken: string,
        botUsername: string,
        userFullName: string,
        userUsername: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ): Promise<Error | void> {
        const callbackUrl = await this.getBotCallback(botUsername);
        if (!callbackUrl) {
            this.debug(`Could not find callback url for bot ${botUsername}`);
            return;
        }

        this.debug(`Sending livechat message to bot ${botUsername}`);
        return await this.chatWebhook.onLivechatMessage(callbackUrl, visitorToken, userUsername, userFullName, message, attachments);
    }

    private async getBotCallback(botUsername: string) {
        return await this.appPersis.getCallbackUrl(botUsername);
    }

    public async onVisitorRoomIdField(visitorToken: string, roomId: string) {
        await this.chatWebhook.updateVisitorRoomId(visitorToken, roomId);
    }

    public async onLivechatRoomClosed(visitorToken: string, flowUuid: string, roomData: ILivechatRoom): Promise<void> {
        await this.chatWebhook.onLivechatRoomClosed(visitorToken, flowUuid, roomData);
    }

    public async onLivechatRoomTransferred(visitorToken: string, flowUuid: string, context: ILivechatTransferEventContext): Promise<void> {
        await this.chatWebhook.onLivechatRoomTransferred(visitorToken, flowUuid, context);
    }
}
