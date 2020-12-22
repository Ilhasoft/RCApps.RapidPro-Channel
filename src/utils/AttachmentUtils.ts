import { HttpStatusCode, IHttp, IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUpload } from '@rocket.chat/apps-engine/definition/uploads';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Buffer } from 'buffer';

import IAttachment from '../domain/Attachment';

export default class AttachmentUtils {

    public static getType(attachment: IMessageAttachment): string {
        return attachment['imageType'] || attachment['videoType'] || attachment['audioType'] || 'document';
    }

    public static getUrl(serverUrl: string, attachment: IMessageAttachment): string {
        return `${serverUrl}${attachment.title!.link}`;
    }

    public static async createRocketUpload(
        http: IHttp,
        modify: IModify,
        attachment: IAttachment,
        room: IRoom,
        sender: {
            visitorToken?: string,
            user?: IUser,
        },
    ): Promise<IUpload | undefined> {

        const response = await http.get(attachment.url, { encoding: null });

        if (response.statusCode === HttpStatusCode.OK) {
            const responseBuffer = Buffer.from(response.content!);
            // get only the filename with extension removing the url path and parameters
            const filename = attachment.url.split('/').pop()!.split('?')[0];
            const descriptor = { filename, room };
            // since this method will only be used on a normal chat or livechat one, this assignment will always work for the uploadBuffer
            sender.user ? descriptor['user'] = sender.user : descriptor['visitorToken'] = sender.visitorToken;
            return await modify.getCreator().getUploadCreator().uploadBuffer(responseBuffer, descriptor);
        }

        return undefined;
    }

}
