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
import { ILivechatRoom, ILivechatTransferEventContext, IPostLivechatRoomClosed, IPostLivechatRoomTransferred, IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';

import ChatRepositoryImpl from './src/data/chat/ChatRepositoryImpl';
import { CheckSecretEndpoint } from './src/endpoint/CheckSecretEndpoint';
import InstanceHelper from './src/endpoint/helpers/InstanceHelper';
import { MessageEndpoint } from './src/endpoint/MessageEndpoint';
import { SettingsEndpoint } from './src/endpoint/SettingsEndpoint';
import { APP_SETTINGS, CONFIG_ADVANCED_LOGGING, CONFIG_APP_SECRET, CONFIG_CLOSE_ROOM_FLOW, CONFIG_FLOWS_ORG_TOKEN, CONFIG_ROOM_FIELD_NAME, CONFIG_TRANSFER_ROOM_FLOW } from './src/settings/Constants';

export class RapidProIntegrationApp extends App implements IPostMessageSent, IPostLivechatRoomClosed, IPostLivechatRoomTransferred {

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

    private debug(enabled: boolean, ...items: Array<any>): void {
        if (enabled) {
            this.getLogger().debug(items);
        }
    }

    public async executePostMessageSent(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify,
    ): Promise<void> {
        const debugEnabled = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ADVANCED_LOGGING);

        // Do not foward any message that a bot has sent
        if (message.sender.roles && message.sender.roles.includes('bot')) {
            this.debug(debugEnabled, 'Bot message, ignoring', message.id);
            return;
        }

        const secret = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_APP_SECRET);
        const flowsOrgToken = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_FLOWS_ORG_TOKEN);
        const roomFieldName = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ROOM_FIELD_NAME);

        const chatRepo = new ChatRepositoryImpl(
            await InstanceHelper.newDefaultChatInternalDataSource(read, modify, http),
            await InstanceHelper.newDefaultChatWebhook(http, read, secret, flowsOrgToken, roomFieldName, this.getLogger(), debugEnabled),
            await InstanceHelper.newDefaultAppPersistence(read.getPersistenceReader(), persistence),
            this.getLogger(),
            debugEnabled
        );

        // empty message handle
        if (!message.attachments && !message.text) {
            this.debug(debugEnabled, 'Empty message, ignoring', message.id);
            return;
        }

        if (message.room.type === RoomType.LIVE_CHAT) {
            const room = message.room as ILivechatRoom;

            // user is still on queue and doesnt have an configured agent yet
            if (!room.servedBy || (message.sender.roles && message.sender.roles.includes('livechat-agent'))) {
                this.debug(debugEnabled, 'User is still on queue or is an agent message, ignoring', message.id);
                return;
            }

            if (roomFieldName.trim() && flowsOrgToken) {
                await chatRepo.onVisitorRoomIdField(room.visitor.token, room.id);
                this.debug(debugEnabled, 'Visitor room id updated', room.visitor.token, room.id);
            }

            this.debug(debugEnabled, 'Valid livechat message, preparing to send webhook', message.id);
            const error = await chatRepo.onLivechatMessage(
                room.visitor.token,
                room.servedBy.username,
                room.visitor.name,
                room.visitor.username,
                message.text,
                message.attachments
            );
            if (error) {
                this.debug(debugEnabled, 'Livechat message failed to be sent', message.id);
                return;
            }
            this.debug(debugEnabled, 'Livechat message sent', message.id);
        } else if (message.room.type === RoomType.DIRECT_MESSAGE) {
            const room = message.room;
            if (room['_unmappedProperties_'].usernames.length > 2) {
                this.debug(debugEnabled, 'Group chat, ignoring', message.id);
                return;
            }
            // since this is a direct chat, there's always only two users, then we remove the sender and get the other one to check if is a valid bot
            const directUsers = room['_unmappedProperties_'].usernames;
            const botUsername = directUsers.filter((value, index, arr) => {
                return value !== message.sender.username;
            })[0];

            this.debug(debugEnabled, 'Valid direct message, preparing to send webhook', message.id);
            await chatRepo.onDirectMessage(message.sender.username, botUsername, message.sender.name, message.text, message.attachments);
            this.debug(debugEnabled, 'Direct message sent', message.id);
        }

    }

    public async executePostLivechatRoomClosed(
        data: ILivechatRoom,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify,
    ) {
        const debugEnabled = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ADVANCED_LOGGING);

        try {
            const visitor: IVisitor = data.visitor as IVisitor;

            const secret = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_APP_SECRET);
            const flowsOrgToken = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_FLOWS_ORG_TOKEN);
            const roomFieldName = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ROOM_FIELD_NAME);
            const flowUuid = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_CLOSE_ROOM_FLOW);

            const chatRepo = new ChatRepositoryImpl(
                await InstanceHelper.newDefaultChatInternalDataSource(read, modify, http),
                await InstanceHelper.newDefaultChatWebhook(http, read, secret, flowsOrgToken, roomFieldName, this.getLogger(), debugEnabled),
                await InstanceHelper.newDefaultAppPersistence(read.getPersistenceReader(), persistence),
                this.getLogger(),
                debugEnabled
            );

            if (flowUuid) {
                this.debug(debugEnabled, 'Valid livechat room closed, preparing to send webhook', data.id);
                await chatRepo.onLivechatRoomClosed(visitor.token, flowUuid, data);
                this.debug(debugEnabled, 'Livechat room closed sent', data.id);
            }
        } catch (e) {
            this.getLogger().error(e.message);
        }
    }

    public async executePostLivechatRoomTransferred(context: ILivechatTransferEventContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
        const debugEnabled = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ADVANCED_LOGGING);

        try {
            const visitor: any = (context.room as ILivechatRoom).visitor;

            const secret = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_APP_SECRET);
            const flowsOrgToken = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_FLOWS_ORG_TOKEN);
            const roomFieldName = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ROOM_FIELD_NAME);
            const flowUuid = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_TRANSFER_ROOM_FLOW);

            const chatRepo = new ChatRepositoryImpl(
                await InstanceHelper.newDefaultChatInternalDataSource(read, modify, http),
                await InstanceHelper.newDefaultChatWebhook(http, read, secret, flowsOrgToken, roomFieldName, this.getLogger(), debugEnabled),
                await InstanceHelper.newDefaultAppPersistence(read.getPersistenceReader(), persistence),
                this.getLogger(),
                debugEnabled
            );

            if (flowUuid) {
                this.debug(debugEnabled, 'Valid livechat room transferred, preparing to send webhook', context.room.id);
                await chatRepo.onLivechatRoomTransferred(visitor.token, flowUuid, context);
                this.debug(debugEnabled, 'Livechat room transferred sent', context.room.id);
            }
        } catch (e) {
            this.getLogger().error(e.message);
        }
    }

}
