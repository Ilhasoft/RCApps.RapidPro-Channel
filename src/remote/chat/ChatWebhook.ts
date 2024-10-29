import { IHttp, IHttpRequest, ILogger, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';

import IChatWebhook from '../../data/chat/IChatWebhook';
import { ChatType } from '../../domain/ChatType';
import { RC_SERVER_URL } from '../../settings/Constants';
import AttachmentUtils from '../../utils/AttachmentUtils';
import { ILivechatRoom, ILivechatTransferEventContext } from '@rocket.chat/apps-engine/definition/livechat';

export default class ChatWebhook implements IChatWebhook {

    constructor(
        private readonly read: IRead,
        private readonly http: IHttp,
        private readonly secret: string,
        private readonly flowsOrgToken: string,
        private readonly roomFieldName: string,
        private readonly logger: ILogger,
        private readonly debugEnabled: boolean,
    ) { }

    private debug(...items: Array<any>): void {
        if (this.debugEnabled) {
            this.logger.debug(items);
        }
    }

    public async onDirectMessage(
        callbackUrl: string,
        userUsername: string,
        userFullName: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ): Promise<void> {
        this.debug(`Sending direct message to ${userUsername}`);
        const reqOptions = this.requestOptions();
        reqOptions['data'] = await this.createPayload(ChatType.DIRECT, userUsername, userUsername, userFullName, message, attachments);

        const res = await this.http.post(callbackUrl, reqOptions);
        this.debug(`Direct message sent to ${userUsername}`, res);
    }

    public async onLivechatMessage(
        callbackUrl: string,
        visitorToken: string,
        userUsername: string,
        userFullName: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ): Promise<Error | void> {
        this.debug(`Sending livechat message from ${visitorToken}`);
        const reqOptions = this.requestOptions();
        reqOptions['data'] = await this.createPayload(ChatType.LIVECHAT, visitorToken, userUsername, userFullName, message, attachments);
        this.debug(`Prepared livechat message payload`, reqOptions);
        let res = await this.http.post(callbackUrl, reqOptions);
        if (res.statusCode !== 200) {
            this.debug(`Error sending livechat message from ${visitorToken}, going to retry`, res);
            
            const retryCount = 3
            const retryTimeout = 1000
            let retry = 0

            while (res.statusCode !== 200 && retry < retryCount) {
                this.debug(`Retrying livechat message from ${visitorToken} in ${retryTimeout}ms, attempt ${retry + 1}`);
                await new Promise(resolve => setTimeout(resolve, retryTimeout))
                res = await this.http.post(callbackUrl, reqOptions);
                retry += 1
            }

            if (res.statusCode !== 200) {
                this.debug(`Error sending livechat message from ${visitorToken} after ${retryCount} attempts`, res);
                return new Error(`Error sending livechat message from ${visitorToken}`);
            }
        }
        this.debug(`Livechat message successfully sent from ${visitorToken}`, res);
    }

    private async getAttachments(attachments: Array<IMessageAttachment>): Promise<any> {
        const attachmentsPayload: { [key: string]: any } = [];
        const serverUrl = await this.read.getEnvironmentReader().getServerSettings().getValueById(RC_SERVER_URL);

        attachments.forEach((attachment) => {
            const url = AttachmentUtils.getUrl(serverUrl, attachment);
            let type = AttachmentUtils.getType(attachment);
            attachmentsPayload.push({ type, url });
        });

        return attachmentsPayload;
    }

    private async createPayload(
        type: ChatType,
        userUrn: string,
        userUsername: string,
        userFullName: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ) {

        const payload = {
            user: {
                urn: `${type}:${userUrn}`,
                username: userUsername,
                full_name: userFullName,
            },
        };

        message && (payload['text'] = message);
        attachments && (payload['attachments'] = await this.getAttachments(attachments));

        return payload;
    }

    private requestOptions(): IHttpRequest {
        return {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${this.secret}`,
            },
        };
    }

    private flowsRequestOptions(): IHttpRequest {
        return {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${this.flowsOrgToken}`,
            }
        }
    }

    public async updateVisitorRoomId(visitorToken: string, roomId: string): Promise<void> {
        const reqOptions = this.flowsRequestOptions();

        reqOptions.params = {
            urn: `rocketchat:livechat:${visitorToken}`,
        }

        reqOptions.data = {
            fields: {
                [this.roomFieldName]: roomId,
            },
        };

        const res = await this.http.post('https://flows.weni.ai/api/v2/contacts.json', reqOptions);
    }

    public async onLivechatRoomClosed(visitorToken: string, flowUuid: string, roomData: ILivechatRoom): Promise<void> {
        const reqOptions = this.flowsRequestOptions();

        reqOptions.data = {
            flow: flowUuid,
            urns: [`rocketchat:livechat:${visitorToken}`],
            extra: roomData,
        }

        await this.http.post('https://flows.weni.ai/api/v2/flow_starts.json', reqOptions);
    }

    public async onLivechatRoomTransferred(visitorToken: string, flowUuid: string, context: ILivechatTransferEventContext): Promise<void> {
        const reqOptions = this.flowsRequestOptions();

        reqOptions.data = {
            flow: flowUuid,
            urns: [`rocketchat:livechat:${visitorToken}`],
            extra: context,
        }

        await this.http.post('https://flows.weni.ai/api/v2/flow_starts.json', reqOptions);
    }
}
