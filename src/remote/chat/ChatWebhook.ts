import { IHttp, IHttpRequest, IRead } from '@rocket.chat/apps-engine/definition/accessors';
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
    ) { }

    public async onDirectMessage(
        callbackUrl: string,
        userUsername: string,
        userFullName: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ): Promise<void> {

        const reqOptions = this.requestOptions();
        reqOptions['data'] = await this.createPayload(ChatType.DIRECT, userUsername, userUsername, userFullName, message, attachments);

        await this.http.post(callbackUrl, reqOptions);
    }

    public async onLivechatMessage(
        callbackUrl: string,
        visitorToken: string,
        userUsername: string,
        userFullName: string,
        message?: string,
        attachments?: Array<IMessageAttachment>,
    ): Promise<void> {
        const reqOptions = this.requestOptions();
        reqOptions['data'] = await this.createPayload(ChatType.LIVECHAT, visitorToken, userUsername, userFullName, message, attachments);
        await this.http.post(callbackUrl, reqOptions);
    }

    private async getAttachments(attachments: Array<IMessageAttachment>): Promise<any> {
        const attachmentsPayload: { [key: string]: any } = [];
        const serverUrl = await this.read.getEnvironmentReader().getServerSettings().getValueById(RC_SERVER_URL);

        attachments.forEach((attachment) => {
            const url = AttachmentUtils.getUrl(serverUrl, attachment);
            let type = AttachmentUtils.getType(attachment);

            if (type === 'document') {
                if (url.endsWith('.pdf')) {
                    type += '/pdf';
                    attachmentsPayload.push({ type, url });
                }
            } else {
                attachmentsPayload.push({ type, url });
            }
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
