import 'mocha';

import { HttpStatusCode } from '@rocket.chat/apps-engine/definition/accessors';
import { assert } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';

import IAppDataSource from '../../../src/data/app/IAppDataSource';
import ChatRepositoryImpl from '../../../src/data/chat/ChatRepositoryImpl';
import IChatInternalDataSource from '../../../src/data/chat/IChatInternalDataSource';
import IChatRepository from '../../../src/data/chat/IChatRepository';
import IChatWebhook from '../../../src/data/chat/IChatWebhook';
import AppError from '../../../src/domain/AppError';
import userFactory from '../../factories/UserFactory';
import visitorFactory from '../../factories/VisitorFactory';

describe('IChatRepository', () => {

    let mockedInternal: IChatInternalDataSource;
    let mockedWebhook: IChatWebhook;
    let mockedPersistence: IAppDataSource;
    let chatRepo: IChatRepository;

    describe('#sendMessage()', () => {

        beforeEach(() => {
            mockedInternal = mock<IChatInternalDataSource>();
            mockedWebhook = mock<IChatWebhook>();
            mockedPersistence = mock<IAppDataSource>();
            chatRepo = new ChatRepositoryImpl(
                instance(mockedInternal),
                instance(mockedWebhook),
                instance(mockedPersistence));
        });

        it(`should throw an error when the bot User doesn't exists`, async () => {
            const userUrn = 'direct:userName';
            const botUsername = 'botName';
            const text = 'hello';
            const attachments = [];

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(undefined);

            try {
                await chatRepo.sendMessage(userUrn, botUsername, text, attachments);
                assert.fail('should have thrown an error');
            } catch (e) {
                assert.equal(e.constructor.name, AppError.name);
                assert.equal(e.message, `Could not find bot with username ${botUsername}`);
                assert.equal(e.statusCode, HttpStatusCode.NOT_FOUND);
            }
        });

        it(`should throw an error when the user urn is invalid`, async () => {
            const invalidUserUrn = 'directuserName';
            const botUsername = 'botName';
            const text = 'hello';
            const attachments = [];

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);

            try {
                await chatRepo.sendMessage(invalidUserUrn, botUsername, text, attachments);
                assert.fail('should have thrown an error');
            } catch (e) {
                assert.equal(e.constructor.name, AppError.name);
                assert.equal(e.message, `Invalid user identification: ${invalidUserUrn}`);
                assert.equal(e.statusCode, HttpStatusCode.BAD_REQUEST);
            }
        });

        it(`should throw an error when the user is not found`, async () => {
            const userUrn = 'direct:userName';
            const botUsername = 'botName';
            const text = 'hello';
            const attachments = [];

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });
            const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);
            when(mockedInternal.getUserByUsername(userIdentifier)).thenResolve(undefined);

            try {
                await chatRepo.sendMessage(userUrn, botUsername, text, attachments);
                assert.fail('should have thrown an error');
            } catch (e) {
                assert.equal(e.constructor.name, AppError.name);
                assert.equal(e.message, `User not found ${userUrn}`);
                assert.equal(e.statusCode, HttpStatusCode.BAD_REQUEST);
            }
        });

        it(`should send the message with no attachments when the user is found`, async () => {
            const userUrn = 'direct:userName';
            const botUsername = 'botName';
            const text = 'hello';
            const attachments = undefined;

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });
            const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];
            const user = userFactory.build({ username: userIdentifier });

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);
            when(mockedInternal.getUserByUsername(userIdentifier)).thenResolve(user);
            when(mockedInternal.sendMessage(botUser, user, text, attachments)).thenResolve('3YffpUPb957Ca2Zx');

            try {
                const messageId = await chatRepo.sendMessage(userUrn, botUsername, text, attachments);
                assert.equal(messageId, '3YffpUPb957Ca2Zx');
            } catch (e) {
                assert.fail(e.message);
            }
        });

        it(`should send the message with attachments when the user is found`, async () => {
            const userUrn = 'direct:userName';
            const botUsername = 'botName';
            const text = 'hello';
            const attachments = [];

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });
            const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];
            const user = userFactory.build({ username: userIdentifier });

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);
            when(mockedInternal.getUserByUsername(userIdentifier)).thenResolve(user);
            when(mockedInternal.sendMessage(botUser, user, text, attachments)).thenResolve('3YffpUPb957Ca2Zx');

            try {
                const messageId = await chatRepo.sendMessage(userUrn, botUsername, text, attachments);
                assert.equal(messageId, '3YffpUPb957Ca2Zx');
            } catch (e) {
                assert.fail(e.message);
            }
        });

        it(`should throw an error when the visitor is not found`, async () => {
            const userUrn = 'livechat:1234';
            const botUsername = 'botName';
            const text = 'hello';

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });
            const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);
            when(mockedInternal.getVisitorByToken(userIdentifier)).thenResolve(undefined);

            try {
                await chatRepo.sendMessage(userUrn, botUsername, text);
                assert.fail('should have thrown an error');
            } catch (e) {
                assert.equal(e.constructor.name, AppError.name);
                assert.equal(e.message, `Could not find visitor with token: ${userIdentifier}`);
                assert.equal(e.statusCode, HttpStatusCode.NOT_FOUND);
            }
        });

        it(`should send the message with no attachments when the visitor is found`, async () => {
            const userUrn = 'livechat:1234';
            const botUsername = 'botName';
            const text = 'hello';
            const attachments = undefined;

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });
            const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];
            const visitor = visitorFactory.build({ token: userIdentifier });

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);
            when(mockedInternal.getVisitorByToken(userIdentifier)).thenResolve(visitor);
            when(mockedInternal.sendLivechatMessage(botUser, visitor, text, attachments)).thenResolve('3YffpUPb957Ca2Zx');

            try {
                const messageId = await chatRepo.sendMessage(userUrn, botUsername, text, attachments);
                assert.equal(messageId, '3YffpUPb957Ca2Zx');
            } catch (e) {
                assert.fail(e.message);
            }
        });

        it(`should send the message with attachments when the visitor is found`, async () => {
            const userUrn = 'livechat:1234';
            const botUsername = 'botName';
            const text = 'hello';
            const attachments = [];

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });
            const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];
            const visitor = visitorFactory.build({ token: userIdentifier });

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);
            when(mockedInternal.getVisitorByToken(userIdentifier)).thenResolve(visitor);
            when(mockedInternal.sendLivechatMessage(botUser, visitor, text, attachments)).thenResolve('3YffpUPb957Ca2Zx');

            try {
                const messageId = await chatRepo.sendMessage(userUrn, botUsername, text, attachments);
                assert.equal(messageId, '3YffpUPb957Ca2Zx');
            } catch (e) {
                assert.fail(e.message);
            }
        });

        it(`should throw an error due to invalid room type`, async () => {
            const userUrn = 'invalid:1234';
            const botUsername = 'botName';
            const text = 'hello';

            const botUser = userFactory.build({ username: botUsername, roles: ['bot'] });
            const [type, userIdentifier] = [userUrn.substring(0, userUrn.indexOf(':')), userUrn.substring(userUrn.indexOf(':') + 1)];

            when(mockedInternal.getUserByUsername(botUsername)).thenResolve(botUser);

            try {
                await chatRepo.sendMessage(userUrn, botUsername, text);
                assert.fail('should have thrown an error');
            } catch (e) {
                assert.equal(e.constructor.name, AppError.name);
                assert.equal(e.message, `Invalid room type: ${type}`);
                assert.equal(e.statusCode, HttpStatusCode.BAD_REQUEST);
            }
        });

    });

    describe('#onDirectMessage()', () => {

        beforeEach(() => {
            mockedInternal = mock<IChatInternalDataSource>();
            mockedWebhook = mock<IChatWebhook>();
            mockedPersistence = mock<IAppDataSource>();
            chatRepo = new ChatRepositoryImpl(
                instance(mockedInternal),
                instance(mockedWebhook),
                instance(mockedPersistence));
        });

        it('should call from app persistence', async () => {
            const userUsername = 'user1';
            const botUsername = 'botName';
            const userFullName = 'john travolta';
            const message = 'hello';
            const attachments = [];
            const validCallback = 'https://webhook.valid.url.com';

            when(mockedPersistence.getCallbackUrl(botUsername)).thenResolve(validCallback);

            await chatRepo.onDirectMessage(userUsername, botUsername, userFullName, message, attachments);
            verify(mockedPersistence.getCallbackUrl(botUsername)).once();
        });

        it('should call webhook due to valid callback url', async () => {
            const userUsername = 'user1';
            const botUsername = 'botName';
            const userFullName = 'john travolta';
            const message = 'hello';
            const attachments = [];
            const validCallback = 'https://webhook.valid.url.com';

            when(mockedPersistence.getCallbackUrl(botUsername)).thenResolve(validCallback);
            when(mockedWebhook.onDirectMessage(validCallback, userUsername, userFullName, message, attachments)).thenResolve();

            await chatRepo.onDirectMessage(userUsername, botUsername, userFullName, message, attachments);
            verify(mockedWebhook.onDirectMessage(validCallback, userUsername, userFullName, message, attachments)).once();
        });

        it('should not call webhook due to invalid callback url', async () => {
            const userUsername = 'user1';
            const botUsername = 'botName';
            const userFullName = 'john travolta';
            const message = 'hello';
            const attachments = [];
            const validCallback = 'https://webhook.valid.url.com';

            when(mockedPersistence.getCallbackUrl(botUsername)).thenResolve(undefined);
            when(mockedWebhook.onDirectMessage(validCallback, userUsername, userFullName, message, attachments)).thenResolve();

            await chatRepo.onDirectMessage(userUsername, botUsername, userFullName, message, attachments);
            verify(mockedWebhook.onDirectMessage(validCallback, userUsername, userFullName, message, attachments)).never();
        });

    });

    describe('#onLivechatMessage()', () => {

        beforeEach(() => {
            mockedInternal = mock<IChatInternalDataSource>();
            mockedWebhook = mock<IChatWebhook>();
            mockedPersistence = mock<IAppDataSource>();
            chatRepo = new ChatRepositoryImpl(
                instance(mockedInternal),
                instance(mockedWebhook),
                instance(mockedPersistence));
        });

        it('should call from app persistence', async () => {
            const visitorToken = '1234';
            const botUsername = 'botName';
            const userFullName = 'john travolta';
            const userUsername = 'user1';
            const message = 'hello';
            const validCallback = 'https://webhook.valid.url.com';
            const attachments = [];

            when(mockedPersistence.getCallbackUrl(botUsername)).thenResolve(validCallback);

            await chatRepo.onLivechatMessage(visitorToken, botUsername, userFullName, userUsername, message, attachments);
            verify(mockedPersistence.getCallbackUrl(botUsername)).once();
        });

        it('should call webhook due to valid callback url', async () => {
            const visitorToken = '1234';
            const botUsername = 'botName';
            const userFullName = 'john travolta';
            const userUsername = 'user1';
            const message = 'hello';
            const validCallback = 'https://webhook.valid.url.com';
            const attachments = [];

            when(mockedPersistence.getCallbackUrl(botUsername)).thenResolve(validCallback);
            when(mockedWebhook.onLivechatMessage(validCallback, visitorToken, userUsername, userFullName, message, attachments)).thenResolve();

            await chatRepo.onLivechatMessage(visitorToken, botUsername, userFullName, userUsername, message, attachments);
            verify(mockedWebhook.onLivechatMessage(validCallback, visitorToken, userUsername, userFullName, message, attachments)).once();
        });

        it('should not call webhook due to invalid callback url', async () => {
            const visitorToken = '1234';
            const botUsername = 'botName';
            const userFullName = 'john travolta';
            const userUsername = 'user1';
            const message = 'hello';
            const validCallback = 'https://webhook.valid.url.com';
            const attachments = [];

            when(mockedPersistence.getCallbackUrl(botUsername)).thenResolve(undefined);
            when(mockedWebhook.onLivechatMessage(validCallback, visitorToken, userUsername, userFullName, message, attachments)).thenResolve();

            await chatRepo.onLivechatMessage(visitorToken, botUsername, userFullName, userUsername, message, attachments);
            verify(mockedWebhook.onLivechatMessage(validCallback, visitorToken, userUsername, userFullName, message, attachments)).never();
        });

    });
});
