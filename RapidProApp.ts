import {
    IAppAccessors,
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { ApiSecurity, ApiVisibility, IApi } from '@rocket.chat/apps-engine/definition/api';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';

import ChatRepositoryImpl from './src/data/chat/ChatRepositoryImpl';
import { CheckSecretEndpoint } from './src/endpoint/CheckSecretEndpoint';
import InstanceHelper from './src/endpoint/helpers/InstanceHelper';
import { MessageEndpoint } from './src/endpoint/MessageEndpoint';
import { SettingsEndpoint } from './src/endpoint/SettingsEndpoint';
import { APP_SETTINGS, CONFIG_APP_SECRET } from './src/settings/Constants';

export class RapidProIntegrationApp extends App implements IPostMessageSent {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async initialize(configurationExtend: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
        await this.extendConfiguration(configurationExtend);
        await configurationExtend.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [
                new CheckSecretEndpoint(this),
                new SettingsEndpoint(this),
                new MessageEndpoint(this),
            ],
        } as IApi);
    }

    public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        APP_SETTINGS.forEach((setting) => configuration.settings.provideSetting(setting));
    }

    public async executePostMessageSent(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify,
    ): Promise<void> {
        // Do not foward any message that a bot has sent
        if (message.sender.roles && message.sender.roles.includes('bot')) {
            return;
        }

        const secret = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_APP_SECRET);

        const chatRepo = new ChatRepositoryImpl(
            await InstanceHelper.newDefaultChatInternalDataSource(read, modify, http),
            await InstanceHelper.newDefaultChatWebhook(http, read, secret),
            await InstanceHelper.newDefaultAppPersistence(read.getPersistenceReader(), persistence),
        );

        // empty message handle
        if (!message.attachments && !message.text) {
            return;
        }

        if (message.room.type === RoomType.LIVE_CHAT) {
            const room = message.room as ILivechatRoom;

            // user is still on queue and doesnt have an configured agent yet
            if (!room.servedBy || (message.sender.roles && message.sender.roles.includes('livechat-agent'))) {
                return;
            }

            await chatRepo.onLivechatMessage(
                room.visitor.token,
                room.servedBy.username,
                room.visitor.name,
                room.visitor.username,
                message.text,
                message.attachments);
        } else if (message.room.type === RoomType.DIRECT_MESSAGE) {
            const room = message.room;
            if (room['_unmappedProperties_'].usernames.length > 2) {
                return;
            }
            // since this is a direct chat, there's always only two users, then we remove the sender and get the other one to check if is a valid bot
            const directUsers = room['_unmappedProperties_'].usernames;
            const botUsername = directUsers.filter((value, index, arr) => {
                return value !== message.sender.username;
            })[0];
            await chatRepo.onDirectMessage(message.sender.username, botUsername, message.sender.name, message.text, message.attachments);
        }

    }

}
