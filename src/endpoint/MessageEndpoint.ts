import { HttpStatusCode, IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest } from '@rocket.chat/apps-engine/definition/api';
import { IApiResponseJSON } from '@rocket.chat/apps-engine/definition/api/IResponse';

import ChatRepositoryImpl from '../data/chat/ChatRepositoryImpl';
import { CONFIG_ADVANCED_LOGGING, CONFIG_APP_SECRET, CONFIG_FLOWS_ORG_TOKEN, CONFIG_ROOM_FIELD_NAME } from '../settings/Constants';
import RequestBodyValidator from '../utils/RequestBodyValidator';
import RequestHeadersValidator from '../utils/RequestHeadersValidator';
import InstanceHelper from './helpers/InstanceHelper';

export class MessageEndpoint extends ApiEndpoint {

    public path = 'message';

    private bodyConstraints = {
        text: {
            presence: false,
            type: 'string',
        },
        attachments: {
            presence: false,
            type: 'array',
        },
        user: {
            presence: {
                allowEmpty: false,
            },
            type: 'string',
        },
        bot: {
            presence: {
                allowEmpty: false,
            },
            type: 'string',
        },
    };

    private debug(enabled: boolean, ...items: Array<any>): void {
        if (enabled) {
            this.app.getLogger().debug(items);
        }
    }

    public async post(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponseJSON> {
        const debugEnabled = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ADVANCED_LOGGING);
        this.debug(debugEnabled, 'Received MessageEndpoint - post');

        await RequestHeadersValidator.validate(read, request.headers);
        await RequestBodyValidator.validate(this.bodyConstraints, request.content);

        const secret = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_APP_SECRET);
        const flowsOrgToken = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_FLOWS_ORG_TOKEN);
        const roomFieldName = await read.getEnvironmentReader().getSettings().getValueById(CONFIG_ROOM_FIELD_NAME);

        const chatRepo = new ChatRepositoryImpl(
            await InstanceHelper.newDefaultChatInternalDataSource(read, modify, http),
            await InstanceHelper.newDefaultChatWebhook(http, read, secret, flowsOrgToken, roomFieldName, this.app.getLogger(), debugEnabled),
            await InstanceHelper.newDefaultAppPersistence(read.getPersistenceReader(), persis),
            this.app.getLogger(),
            debugEnabled,
        );

        const content = request.content;
        const msgId = await chatRepo.sendMessage(content.user, content.bot, content.text, content.attachments);

        this.debug(debugEnabled, 'Message received and processed successfully', msgId);

        return this.json({ status: HttpStatusCode.CREATED, content: { id: msgId } });
    }

}
