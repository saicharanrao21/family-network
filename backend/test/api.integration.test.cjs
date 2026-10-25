const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { after, before, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { HttpExceptionFilter } = require('../dist/common/http-exception.filter');
const { PrismaService } = require('../dist/common/prisma.service');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to the dedicated loopback family_network_test database and apply prisma migrate deploy first.');
}

const parsedDatabaseUrl = new URL(databaseUrl);
if (
  !['127.0.0.1', '::1', 'localhost'].includes(parsedDatabaseUrl.hostname) ||
  parsedDatabaseUrl.pathname !== '/family_network_test'
) {
  throw new Error('Integration tests only run against the dedicated family_network_test database on loopback.');
}

let app;
let prisma;
let baseUrl;
const createdUserIds = [];
const createdPersonIds = [];
const createdCandidateIds = [];

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

async function registerAccount(email, name) {
  const response = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'integration-test-password', name }),
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  createdUserIds.push(response.body.userId);
  createdPersonIds.push(response.body.personId);
  return response.body;
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'integration-only-secret-not-used-outside-the-test-process';

  app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  prisma = app.get(PrismaService);
});

after(async () => {
  if (prisma) {
    if (createdUserIds.length) {
      await prisma.familyInvitation.deleteMany({
        where: {
          OR: [
            { inviterUserId: { in: createdUserIds } },
            { acceptedByUserId: { in: createdUserIds } },
          ],
        },
      });
    }
    if (createdCandidateIds.length || createdPersonIds.length) {
      await prisma.personMatchCandidate.deleteMany({
        where: {
          OR: [
            { id: { in: createdCandidateIds } },
            { personAId: { in: createdPersonIds } },
            { personBId: { in: createdPersonIds } },
          ],
        },
      });
    }
    if (createdPersonIds.length) {
      await Promise.all([
        prisma.relationship.deleteMany({
          where: {
            OR: [
              { personAId: { in: createdPersonIds } },
              { personBId: { in: createdPersonIds } },
            ],
          },
        }),
        prisma.parentChildRelationship.deleteMany({
          where: {
            OR: [
              { parentId: { in: createdPersonIds } },
              { childId: { in: createdPersonIds } },
            ],
          },
        }),
        prisma.union.deleteMany({
          where: {
            OR: [
              { partnerAId: { in: createdPersonIds } },
              { partnerBId: { in: createdPersonIds } },
            ],
          },
        }),
      ]);
      await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }
  if (app) await app.close();
});

test('two independent accounts connect family branches only after invitation acceptance', async () => {
  const unauthenticated = await request('/graph?focus=unknown');
  assert.equal(unauthenticated.status, 401);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const accountA = await registerAccount(`branch-a-${suffix}@example.test`, 'Branch A Root');
  const accountB = await registerAccount(`branch-b-${suffix}@example.test`, 'Branch B Root');
  const intruder = await registerAccount(`intruder-${suffix}@example.test`, 'Unrelated Person');
  process.env.ADMIN_USER_IDS = accountA.userId;
  const adminWithoutToken = await request('/admin/overview');
  assert.equal(adminWithoutToken.status, 401);
  const deniedAdmin = await request('/admin/overview', { token: intruder.accessToken });
  assert.equal(deniedAdmin.status, 401);
  const adminOverview = await request('/admin/overview', { token: accountA.accessToken });
  assert.equal(adminOverview.status, 200);
  const moderationReport = await request('/moderation/reports', {
    token: accountB.accessToken,
    method: 'POST',
    body: JSON.stringify({
      targetType: 'PERSON',
      targetId: accountA.personId,
      reason: 'PRIVACY',
      details: 'Integration test report.',
    }),
  });
  assert.equal(moderationReport.status, 201);
  const deniedAdminReports = await request('/admin/reports', {
    token: accountB.accessToken,
  });
  assert.equal(deniedAdminReports.status, 401);
  const resolveReport = await request(
    `/admin/reports/${moderationReport.body.id}/DISMISSED`,
    { token: accountA.accessToken, method: 'PATCH' },
  );
  assert.equal(resolveReport.status, 200);
  const resolvedReport = await prisma.moderationReport.findUnique({
    where: { id: moderationReport.body.id },
  });
  assert.equal(resolvedReport.status, 'DISMISSED');
  assert.equal(resolvedReport.resolvedByUserId, accountA.userId);

  const [selfA, selfB] = await Promise.all([
    request('/auth/me', { token: accountA.accessToken }),
    request('/auth/me', { token: accountB.accessToken }),
  ]);
  assert.equal(selfA.status, 200);
  assert.equal(selfB.status, 200);

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: `branch-a-${suffix}@example.test`,
      password: 'integration-test-password',
    }),
  });
  assert.equal(login.status, 201, JSON.stringify(login.body));
  const refresh = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: login.body.refreshToken }),
  });
  assert.equal(refresh.status, 201, JSON.stringify(refresh.body));
  const reusedRefresh = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: login.body.refreshToken }),
  });
  assert.equal(reusedRefresh.status, 401);
  const sessionRows = await request('/privacy/sessions', { token: refresh.body.accessToken });
  assert.equal(sessionRows.status, 200);
  const rotatedSession = await prisma.session.findFirst({
    where: { userId: accountA.userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  const revokedSession = await request(`/privacy/sessions/${rotatedSession.id}/revoke`, {
    token: refresh.body.accessToken,
    method: 'POST',
  });
  assert.equal(revokedSession.status, 201);
  const revokedAccess = await request('/privacy/sessions', {
    token: refresh.body.accessToken,
  });
  assert.equal(revokedAccess.status, 401);

  const missingStripeConfig = await request('/subscriptions/checkout', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({ planCode: 'PLUS', provider: 'stripe' }),
  });
  assert.equal(missingStripeConfig.status, 201);
  assert.equal(missingStripeConfig.body.mode, 'PROVIDER_CONFIGURATION_REQUIRED');

  const razorpaySecret = 'integration-only-razorpay-webhook-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = razorpaySecret;
  const razorpayEvent = {
    id: `razorpay-${suffix}`,
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `payment-${suffix}`,
          notes: { userId: accountA.userId, planCode: 'PLUS' },
        },
      },
    },
  };
  const razorpayBody = JSON.stringify(razorpayEvent);
  const razorpaySignature = createHmac('sha256', razorpaySecret)
    .update(razorpayBody)
    .digest('hex');
  const invalidRazorpaySignature = await request('/subscriptions/webhooks/razorpay', {
    method: 'POST',
    body: razorpayBody,
    headers: { 'x-webhook-signature': '0'.repeat(64) },
  });
  assert.equal(invalidRazorpaySignature.status, 401);
  const razorpayWebhook = await request('/subscriptions/webhooks/razorpay', {
    method: 'POST',
    body: razorpayBody,
    headers: { 'x-webhook-signature': razorpaySignature },
  });
  assert.equal(razorpayWebhook.status, 201, JSON.stringify(razorpayWebhook.body));
  assert.equal(razorpayWebhook.body.processed, true);
  const duplicateRazorpayWebhook = await request('/subscriptions/webhooks/razorpay', {
    method: 'POST',
    body: razorpayBody,
    headers: { 'x-webhook-signature': razorpaySignature },
  });
  assert.equal(duplicateRazorpayWebhook.status, 201);
  assert.equal(duplicateRazorpayWebhook.body.duplicate, true);
  const razorpaySubscription = await prisma.subscription.findFirst({
    where: { userId: accountA.userId, provider: 'razorpay', status: 'ACTIVE' },
  });
  assert.equal(razorpaySubscription.planCode, 'PLUS');

  const stripeSecret = 'integration-only-stripe-webhook-secret';
  process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;
  const stripeEvent = {
    id: `stripe-${suffix}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `checkout-${suffix}`,
        subscription: `subscription-${suffix}`,
        metadata: { userId: accountB.userId, planCode: 'FAMILY' },
      },
    },
  };
  const stripeBody = JSON.stringify(stripeEvent);
  const stripeTimestamp = Math.floor(Date.now() / 1000);
  const stripeSignature = createHmac('sha256', stripeSecret)
    .update(`${stripeTimestamp}.${stripeBody}`)
    .digest('hex');
  const staleStripeSignature = createHmac('sha256', stripeSecret)
    .update(`${stripeTimestamp - 600}.${stripeBody}`)
    .digest('hex');
  const staleStripeWebhook = await request('/subscriptions/webhooks/stripe', {
    method: 'POST',
    body: stripeBody,
    headers: { 'x-webhook-signature': `t=${stripeTimestamp - 600},v1=${staleStripeSignature}` },
  });
  assert.equal(staleStripeWebhook.status, 401);
  const stripeWebhook = await request('/subscriptions/webhooks/stripe', {
    method: 'POST',
    body: stripeBody,
    headers: { 'x-webhook-signature': `t=${stripeTimestamp},v1=${stripeSignature}` },
  });
  assert.equal(stripeWebhook.status, 201, JSON.stringify(stripeWebhook.body));
  const stripeSubscription = await prisma.subscription.findFirst({
    where: { userId: accountB.userId, provider: 'stripe', status: 'ACTIVE' },
  });
  assert.equal(stripeSubscription.planCode, 'FAMILY');
  const duplicateStripeWebhook = await request('/subscriptions/webhooks/stripe', {
    method: 'POST',
    body: stripeBody,
    headers: { 'x-webhook-signature': `t=${stripeTimestamp},v1=${stripeSignature}` },
  });
  assert.equal(duplicateStripeWebhook.status, 201);
  assert.equal(duplicateStripeWebhook.body.duplicate, true);
  const retryEventId = `stripe-retry-${suffix}`;
  const retryBody = (planCode) => JSON.stringify({
    id: retryEventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `retry-checkout-${suffix}`,
        subscription: `retry-subscription-${suffix}`,
        metadata: { userId: accountB.userId, planCode },
      },
    },
  });
  const signStripeBody = (body, timestamp) => createHmac('sha256', stripeSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  const retryTimestamp = Math.floor(Date.now() / 1000);
  const failedEventBody = retryBody('INVALID_PLAN');
  const failedEvent = await request('/subscriptions/webhooks/stripe', {
    method: 'POST',
    body: failedEventBody,
    headers: {
      'x-webhook-signature': `t=${retryTimestamp},v1=${signStripeBody(failedEventBody, retryTimestamp)}`,
    },
  });
  assert.equal(failedEvent.status, 400);
  const retriedEventBody = retryBody('PLUS');
  const retriedEvent = await request('/subscriptions/webhooks/stripe', {
    method: 'POST',
    body: retriedEventBody,
    headers: {
      'x-webhook-signature': `t=${retryTimestamp},v1=${signStripeBody(retriedEventBody, retryTimestamp)}`,
    },
  });
  assert.equal(retriedEvent.status, 201, JSON.stringify(retriedEvent.body));
  assert.equal(retriedEvent.body.processed, true);
  const failedPaymentEvent = {
    id: `stripe-failed-payment-${suffix}`,
    type: 'invoice.payment_failed',
    data: { object: { subscription: `retry-subscription-${suffix}` } },
  };
  const failedPaymentBody = JSON.stringify(failedPaymentEvent);
  const failedPaymentTimestamp = Math.floor(Date.now() / 1000);
  const failedPaymentWebhook = await request('/subscriptions/webhooks/stripe', {
    method: 'POST',
    body: failedPaymentBody,
    headers: {
      'x-webhook-signature': `t=${failedPaymentTimestamp},v1=${signStripeBody(failedPaymentBody, failedPaymentTimestamp)}`,
    },
  });
  assert.equal(failedPaymentWebhook.status, 201);
  const pastDueSubscription = await prisma.subscription.findFirst({
    where: { userId: accountB.userId, provider: 'stripe', externalSubscriptionId: `retry-subscription-${suffix}` },
  });
  assert.equal(pastDueSubscription.status, 'PAST_DUE');
  const canceledEvent = {
    id: `stripe-canceled-${suffix}`,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: `retry-subscription-${suffix}`,
        status: 'canceled',
        cancel_at_period_end: true,
      },
    },
  };
  const canceledBody = JSON.stringify(canceledEvent);
  const canceledTimestamp = Math.floor(Date.now() / 1000);
  const canceledWebhook = await request('/subscriptions/webhooks/stripe', {
    method: 'POST',
    body: canceledBody,
    headers: {
      'x-webhook-signature': `t=${canceledTimestamp},v1=${signStripeBody(canceledBody, canceledTimestamp)}`,
    },
  });
  assert.equal(canceledWebhook.status, 201);
  const canceledSubscription = await prisma.subscription.findFirst({
    where: {
      userId: accountB.userId,
      provider: 'stripe',
      externalSubscriptionId: `retry-subscription-${suffix}`,
    },
  });
  assert.equal(canceledSubscription.status, 'CANCELED');

  const otpDestination = `otp-signup-${suffix}@example.test`;
  const otpRequest = await request('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ destination: otpDestination, purpose: 'SIGNUP' }),
  });
  assert.equal(otpRequest.status, 201);
  assert.match(otpRequest.body.developmentCode, /^\d{6}$/);
  const otpSignup = await request('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({
      destination: otpDestination,
      code: otpRequest.body.developmentCode,
      purpose: 'SIGNUP',
    }),
  });
  assert.equal(otpSignup.status, 201, JSON.stringify(otpSignup.body));
  createdUserIds.push(otpSignup.body.userId);
  const otpReplay = await request('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({
      destination: otpDestination,
      code: otpRequest.body.developmentCode,
      purpose: 'SIGNUP',
    }),
  });
  assert.equal(otpReplay.status, 401);
  const otpLockedDestination = `otp-lock-${suffix}@example.test`;
  const lockOtp = await request('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ destination: otpLockedDestination, purpose: 'LOGIN' }),
  });
  assert.equal(lockOtp.status, 201);
  const wrongOtp = String((Number(lockOtp.body.developmentCode) % 900000) + 100000);
  for (let attempt = 0; attempt < 5; attempt++) {
    const invalidOtp = await request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({
        destination: otpLockedDestination,
        code: wrongOtp,
        purpose: 'LOGIN',
      }),
    });
    assert.equal(invalidOtp.status, 401);
  }
  const lockedOtp = await request('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({
      destination: otpLockedDestination,
      code: lockOtp.body.developmentCode,
      purpose: 'LOGIN',
    }),
  });
  assert.equal(lockedOtp.status, 401);

  const addBranchPerson = async (account, name) => {
    const response = await request('/family-builder/relative', {
      token: account.accessToken,
      method: 'POST',
      body: JSON.stringify({
        selfPersonId: account.personId,
        name,
        relationshipType: 'CHILD',
        parentType: 'BIOLOGICAL',
      }),
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    createdPersonIds.push(response.body.person.id);
    return response.body.person.id;
  };
  const [childA, childB] = await Promise.all([
    addBranchPerson(accountA, 'Branch A Child'),
    addBranchPerson(accountB, 'Branch B Child'),
  ]);

  const branchA = await prisma.person.findMany({
    where: { id: { in: [accountA.personId, childA] } },
    select: { id: true },
  });
  const branchB = await prisma.person.findMany({
    where: { id: { in: [accountB.personId, childB] } },
    select: { id: true },
  });
  assert.equal(branchA.length, 2);
  assert.equal(branchB.length, 2);
  assert.equal(
    branchA.some((person) => branchB.some((other) => other.id === person.id)),
    false,
  );
  assert.equal(
    await prisma.parentChildRelationship.count({
      where: {
        OR: [
          { parentId: { in: [accountA.personId, childA] }, childId: { in: [accountB.personId, childB] } },
          { parentId: { in: [accountB.personId, childB] }, childId: { in: [accountA.personId, childA] } },
        ],
      },
    }),
    0,
  );

  const familySpaceResponse = await request('/family-builder/family-spaces', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      name: 'Branch A Family Space',
      privacy: 'INVITE_ONLY',
    }),
  });
  assert.equal(familySpaceResponse.status, 201, JSON.stringify(familySpaceResponse.body));
  assert.equal(familySpaceResponse.body.members[0].role, 'OWNER');
  const familySpacesA = await request('/family-builder/family-spaces', {
    token: accountA.accessToken,
  });
  const familySpacesB = await request('/family-builder/family-spaces', {
    token: accountB.accessToken,
  });
  assert.equal(familySpacesA.body.length, 1);
  assert.equal(familySpacesB.body.length, 0);

  const directCrossBranchLink = await request('/family-builder/connect', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      selfPersonId: accountA.personId,
      otherPersonId: accountB.personId,
      relationshipType: 'SIBLING',
    }),
  });
  assert.equal(directCrossBranchLink.status, 403);
  const directRelationshipLink = await request('/relationships', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      personAId: accountA.personId,
      personBId: accountB.personId,
      type: 'SIBLING',
    }),
  });
  assert.equal(directRelationshipLink.status, 403);
  const directParentLink = await request('/relationships/parent-child', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      parentId: accountA.personId,
      childId: accountB.personId,
    }),
  });
  assert.equal(directParentLink.status, 403);
  const directUnionLink = await request('/relationships/union', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      partnerAId: accountA.personId,
      partnerBId: accountB.personId,
    }),
  });
  assert.equal(directUnionLink.status, 403);

  const candidateResponse = await request('/family-builder/matches', {
    token: accountB.accessToken,
    method: 'POST',
    body: JSON.stringify({
      personAId: accountB.personId,
      personBId: accountA.personId,
      reason: 'User-submitted possible match; names are not proof of identity',
    }),
  });
  assert.equal(candidateResponse.status, 201, JSON.stringify(candidateResponse.body));
  createdCandidateIds.push(candidateResponse.body.id);
  assert.equal(candidateResponse.body.status, 'PENDING');

  const noConnectionYet = await request(
    `/relationships/path?from=${encodeURIComponent(accountA.personId)}&to=${encodeURIComponent(accountB.personId)}`,
    { token: accountA.accessToken },
  );
  assert.equal(noConnectionYet.status, 200);
  assert.equal(noConnectionYet.body.connected, false);

  const outsiderCannotReview = await request(
    `/family-builder/matches/${candidateResponse.body.id}/resolve`,
    {
      token: intruder.accessToken,
      method: 'POST',
      body: JSON.stringify({ action: 'DISMISS' }),
    },
  );
  assert.equal(outsiderCannotReview.status, 403);

  const foreignGraph = await request(`/graph?focus=${encodeURIComponent(accountA.personId)}`, {
    token: accountB.accessToken,
  });
  assert.equal(foreignGraph.status, 403);

  await prisma.privacySetting.update({
    where: { personId: accountA.personId },
    data: { profileVisibility: 'PRIVATE', relationshipVisibility: 'PRIVATE' },
  });
  const privateProfileGraph = await request(
    `/graph?focus=${encodeURIComponent(accountB.personId)}&depth=3`,
    { token: accountB.accessToken },
  );
  assert.equal(privateProfileGraph.status, 200);
  assert.equal(
    privateProfileGraph.body.nodes.some((node) => node.id === accountA.personId),
    false,
  );
  assert.equal(
    privateProfileGraph.body.nodes.some((node) => node.id === childA),
    false,
  );
  const privatePeopleSearch = await request(
    `/search/people?q=${encodeURIComponent('Branch A Root')}`,
    { token: accountB.accessToken },
  );
  assert.equal(privatePeopleSearch.status, 200);
  assert.equal(
    privatePeopleSearch.body.results.some((person) => person.personId === accountA.personId),
    false,
  );
  const privateRelationshipSearch = await request(
    `/search/relationship-targets?q=${encodeURIComponent('Branch A Root')}`,
    { token: accountB.accessToken },
  );
  assert.equal(privateRelationshipSearch.status, 200);
  assert.equal(privateRelationshipSearch.body.length, 0);
  const privateSurnameSuggestions = await request(
    `/search/surname-suggestions?personId=${encodeURIComponent(accountB.personId)}`,
    { token: accountB.accessToken },
  );
  assert.equal(privateSurnameSuggestions.status, 200);
  assert.equal(
    privateSurnameSuggestions.body.some((person) => person.personId === accountA.personId),
    false,
  );
  const privatePersonArchiveAttempt = await request('/archive/memories', {
    token: accountB.accessToken,
    method: 'POST',
    body: JSON.stringify({
      title: 'Cross-branch private record',
      personIds: [accountA.personId],
    }),
  });
  assert.equal(privatePersonArchiveAttempt.status, 403);

  const privateMemory = await request('/archive/memories', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      title: 'Private branch record',
      body: 'Not accessible by the independent branch owner.',
      visibility: 'PRIVATE',
      personIds: [accountA.personId],
    }),
  });
  assert.equal(privateMemory.status, 201, JSON.stringify(privateMemory.body));
  const otherAccountMemories = await request('/archive/memories', {
    token: accountB.accessToken,
  });
  assert.equal(otherAccountMemories.status, 200);
  assert.equal(otherAccountMemories.body.length, 0);

  const invite = await request('/family-builder/invite', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      inviterPersonId: accountA.personId,
      relationshipType: 'SIBLING',
    }),
  });
  assert.equal(invite.status, 201, JSON.stringify(invite.body));
  const revokedInvite = await request(
    `/family-builder/invitations/${invite.body.invitation.id}/revoke`,
    {
      token: accountA.accessToken,
      method: 'POST',
    },
  );
  assert.equal(revokedInvite.status, 201);
  assert.equal(revokedInvite.body.status, 'REVOKED');
  const revokedInviteRetry = await request('/family-builder/invitations/accept', {
    token: accountB.accessToken,
    method: 'POST',
    body: JSON.stringify({ token: invite.body.token }),
  });
  assert.equal(revokedInviteRetry.status, 400);

  const activeInvite = await request('/family-builder/invite', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      inviterPersonId: accountA.personId,
      relationshipType: 'SIBLING',
    }),
  });
  assert.equal(activeInvite.status, 201);
  const forbiddenRevocation = await request(
    `/family-builder/invitations/${activeInvite.body.invitation.id}/revoke`,
    { token: accountB.accessToken, method: 'POST' },
  );
  assert.equal(forbiddenRevocation.status, 404);

  await prisma.familyInvitation.update({
    where: { id: activeInvite.body.invitation.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expiredAcceptance = await request('/family-builder/invitations/accept', {
    token: accountB.accessToken,
    method: 'POST',
    body: JSON.stringify({ token: activeInvite.body.token }),
  });
  assert.equal(expiredAcceptance.status, 400);

  const usableInvite = await request('/family-builder/invite', {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({
      inviterPersonId: accountA.personId,
      familySpaceId: familySpaceResponse.body.id,
      relationshipType: 'SIBLING',
    }),
  });
  assert.equal(usableInvite.status, 201);
  const accepted = await request('/family-builder/invitations/accept', {
    token: accountB.accessToken,
    method: 'POST',
    body: JSON.stringify({ token: usableInvite.body.token }),
  });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  assert.equal(accepted.body.connection.kind, 'RELATIONSHIP');
  const acceptedMembership = await prisma.familySpaceMember.findUnique({
    where: {
      familySpaceId_personId: {
        familySpaceId: familySpaceResponse.body.id,
        personId: accountB.personId,
      },
    },
  });
  assert.equal(acceptedMembership.status, 'ACTIVE');
  const familySpacesAfterAcceptance = await request('/family-builder/family-spaces', {
    token: accountB.accessToken,
  });
  assert.equal(familySpacesAfterAcceptance.body.length, 1);
  const duplicateAcceptance = await request('/family-builder/invitations/accept', {
    token: accountB.accessToken,
    method: 'POST',
    body: JSON.stringify({ token: usableInvite.body.token }),
  });
  assert.equal(duplicateAcceptance.status, 400);

  const connectedPath = await request(
    `/relationships/path?from=${encodeURIComponent(accountA.personId)}&to=${encodeURIComponent(accountB.personId)}`,
    { token: accountA.accessToken },
  );
  assert.equal(connectedPath.status, 200);
  assert.equal(connectedPath.body.connected, true);
  assert.equal(connectedPath.body.hops, 1);
  const privateRelationshipPath = await request(
    `/relationships/path?from=${encodeURIComponent(accountB.personId)}&to=${encodeURIComponent(accountA.personId)}`,
    { token: accountB.accessToken },
  );
  assert.equal(privateRelationshipPath.status, 403);
  const privateKinship = await request(
    `/relationships/kinship?from=${encodeURIComponent(accountB.personId)}&to=${encodeURIComponent(accountA.personId)}`,
    { token: accountB.accessToken },
  );
  assert.equal(privateKinship.status, 403);
  const connectedGraph = await request(
    `/graph?focus=${encodeURIComponent(accountB.personId)}&depth=2`,
    { token: accountB.accessToken },
  );
  assert.equal(connectedGraph.status, 200);
  assert.equal(
    connectedGraph.body.nodes.some((node) => node.id === accountA.personId),
    false,
  );

  const allFourPeople = await prisma.person.findMany({
    where: { id: { in: [accountA.personId, childA, accountB.personId, childB] } },
    select: { id: true },
  });
  assert.equal(allFourPeople.length, 4, 'Connecting branches must not merge distinct people');
  assert.equal(
    await prisma.relationship.count({
      where: {
        personAId: accountA.personId,
        personBId: accountB.personId,
        type: 'SIBLING',
        status: 'CONFIRMED',
      },
    }),
    1,
  );

  const stillPendingMatch = await prisma.personMatchCandidate.findUnique({
    where: { id: candidateResponse.body.id },
  });
  assert.equal(stillPendingMatch.status, 'PENDING');
  const review = await request(
    `/family-builder/matches/${candidateResponse.body.id}/resolve`,
    {
      token: accountB.accessToken,
      method: 'POST',
      body: JSON.stringify({ action: 'DISMISS' }),
    },
  );
  assert.equal(review.status, 201);
  assert.equal(review.body.status, 'DISMISSED');

  const wrongOwnerNameEdit = await request(`/persons/${accountB.personId}/names`, {
    token: accountA.accessToken,
    method: 'POST',
    body: JSON.stringify({ fullName: 'Unauthorized edit' }),
  });
  assert.equal(wrongOwnerNameEdit.status, 404);
});
