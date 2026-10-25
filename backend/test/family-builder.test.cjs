const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { FamilyBuilderService } = require('../dist/family-builder/family-builder.service');

function createPrisma(overrides = {}) {
  const prisma = {
    personClaim: {
      findFirst: async () => null,
      count: async () => 0,
    },
    person: {
      findUnique: async () => ({ id: 'person', names: [] }),
    },
    familySpaceMember: {
      findUnique: async () => null,
      upsert: async () => ({}),
    },
    familyInvitation: {
      create: async () => ({ id: 'invitation', relationshipType: 'SIBLING', targetPersonId: 'person-a' }),
      findUnique: async () => null,
      findMany: async () => [],
      updateMany: async () => ({ count: 1 }),
    },
    personMatchCandidate: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
    },
    relationship: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'relationship', ...data }),
    },
    parentChildRelationship: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'parent-child', ...data }),
    },
    union: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'union', ...data }),
    },
    user: {
      findUnique: async () => null,
    },
    auditLog: {
      create: async () => ({}),
    },
  };
  Object.assign(prisma, overrides);
  prisma.$transaction = async (callback) => callback(prisma);
  return prisma;
}

test('direct connection cannot attach a person claimed by another account', async () => {
  let relationshipWrites = 0;
  const prisma = createPrisma({
    personClaim: {
      findFirst: async ({ where }) => {
        if (where.personId === 'person-a') return { personId: 'person-a', userId: 'user-a' };
        if (where.userId?.not === 'user-a') return { personId: 'person-b', userId: 'user-b' };
        return null;
      },
      count: async () => 0,
    },
    person: {
      findUnique: async () => ({ id: 'person-b', names: [] }),
    },
    relationship: {
      findFirst: async () => null,
      create: async () => {
        relationshipWrites++;
        return {};
      },
    },
  });
  const service = new FamilyBuilderService(prisma);

  await assert.rejects(
    service.connectExisting('user-a', {
      selfPersonId: 'person-a',
      otherPersonId: 'person-b',
      relationshipType: 'SIBLING',
    }),
    (error) => error.getStatus() === 403,
  );
  assert.equal(relationshipWrites, 0);
});

test('family-space invitations require active membership of the inviter', async () => {
  let invitationWrites = 0;
  const prisma = createPrisma({
    personClaim: {
      findFirst: async ({ where }) => where.personId === 'person-a' && where.userId === 'user-a'
        ? { personId: 'person-a', userId: 'user-a' }
        : null,
      count: async () => 0,
    },
    familyInvitation: {
      create: async () => {
        invitationWrites++;
        return {};
      },
    },
    familySpaceMember: {
      findUnique: async () => null,
      upsert: async () => ({}),
    },
  });
  const service = new FamilyBuilderService(prisma);

  await assert.rejects(
    service.createInvitation('user-a', {
      inviterPersonId: 'person-a',
      familySpaceId: 'family-space',
      relationshipType: 'SIBLING',
    }),
    (error) => error.getStatus() === 403,
  );
  assert.equal(invitationWrites, 0);
});

test('a user cannot invite another claimed person without that person owner', async () => {
  let invitationWrites = 0;
  const prisma = createPrisma({
    personClaim: {
      findFirst: async ({ where }) => {
        if (where.personId === 'person-a' && where.userId === 'user-a') {
          return { personId: 'person-a', userId: 'user-a' };
        }
        if (where.userId?.not === 'user-a') {
          return { personId: 'person-b', userId: 'user-b' };
        }
        return null;
      },
      count: async () => 0,
    },
    person: {
      findUnique: async () => ({ id: 'person-b', names: [] }),
    },
    familyInvitation: {
      create: async () => {
        invitationWrites++;
        return {};
      },
    },
  });
  const service = new FamilyBuilderService(prisma);

  await assert.rejects(
    service.createInvitation('user-a', {
      inviterPersonId: 'person-a',
      targetPersonId: 'person-b',
      relationshipType: 'SIBLING',
    }),
    (error) => error.getStatus() === 403,
  );
  assert.equal(invitationWrites, 0);
});

test('destination-bound invitations reject accounts without the verified destination', async () => {
  const prisma = createPrisma({
    familyInvitation: {
      findUnique: async () => ({
        id: 'invitation',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        inviteeDestination: 'invited@example.test',
        inviterUserId: 'user-a',
        targetPersonId: 'person-a',
        relationshipType: 'SIBLING',
      }),
    },
    user: {
      findUnique: async () => ({
        email: 'different@example.test',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
      }),
    },
  });
  const service = new FamilyBuilderService(prisma);

  await assert.rejects(
    service.acceptInvitation('user-b', 'secret-token'),
    (error) => error.getStatus() === 403,
  );
});

test('verified invite acceptance connects independently claimed branches atomically', async () => {
  const token = 'secret-token';
  const expectedTokenHash = createHash('sha256').update(token).digest('hex');
  let acceptedInvitationWhere;
  let relationshipData;
  const prisma = createPrisma({
    familyInvitation: {
      findUnique: async ({ where }) => {
        assert.equal(where.tokenHash, expectedTokenHash);
        return {
          id: 'invitation',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 60_000),
          inviteeDestination: 'invitee@example.test',
          inviterUserId: 'user-a',
          targetPersonId: 'person-a',
          familySpaceId: null,
          relationshipType: 'SIBLING',
        };
      },
      updateMany: async ({ where, data }) => {
        acceptedInvitationWhere = where;
        assert.equal(data.status, 'ACCEPTED');
        return { count: 1 };
      },
    },
    personClaim: {
      findFirst: async ({ where }) => {
        if (where.userId?.not === 'user-a') return null;
        if (where.userId === 'user-b') return { personId: 'person-b', userId: 'user-b' };
        return null;
      },
      count: async () => 0,
    },
    user: {
      findUnique: async () => ({
        email: 'Invitee@Example.Test ',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
      }),
    },
    relationship: {
      findFirst: async () => null,
      create: async ({ data }) => {
        relationshipData = data;
        return { id: 'relationship', ...data };
      },
    },
  });
  const service = new FamilyBuilderService(prisma);

  const result = await service.acceptInvitation('user-b', token);

  assert.equal(result.invitationId, 'invitation');
  assert.equal(result.connection.kind, 'RELATIONSHIP');
  assert.equal(acceptedInvitationWhere.status, 'PENDING');
  assert.deepEqual(
    [relationshipData.personAId, relationshipData.personBId],
    ['person-a', 'person-b'],
  );
  assert.equal(relationshipData.status, 'CONFIRMED');
});

test('either owner can dismiss a match candidate regardless of canonical ID ordering', async () => {
  let updated;
  const prisma = createPrisma({
    personMatchCandidate: {
      findUnique: async () => ({
        id: 'candidate',
        personAId: 'aaa-person',
        personBId: 'zzz-person',
      }),
      update: async ({ data }) => {
        updated = data;
        return data;
      },
    },
    personClaim: {
      findFirst: async ({ where }) => where.personId?.in?.includes('zzz-person')
        ? { personId: 'zzz-person', userId: 'user-b' }
        : null,
      count: async () => 0,
    },
  });
  const service = new FamilyBuilderService(prisma);

  const result = await service.resolveMatch('user-b', 'candidate', 'DISMISS');

  assert.equal(result.status, 'DISMISSED');
  assert.equal(updated.resolvedByUserId, 'user-b');
});

test('match merge does not update a candidate after its person is removed', async () => {
  let mergeArguments;
  let candidateUpdates = 0;
  const prisma = createPrisma({
    personMatchCandidate: {
      findUnique: async () => ({
        id: 'candidate',
        personAId: 'person-a',
        personBId: 'person-b',
      }),
      update: async () => {
        candidateUpdates++;
        throw new Error('The candidate is removed with the duplicate person');
      },
    },
    personClaim: {
      findFirst: async ({ where }) => {
        if (where.personId?.in?.includes('person-a')) return { personId: 'person-a' };
        if (where.personId === 'person-a') return { personId: 'person-a' };
        return null;
      },
      count: async () => 0,
    },
  });
  const service = new FamilyBuilderService(prisma);
  service.mergePerson = async (...args) => {
    mergeArguments = args;
  };

  const result = await service.resolveMatch('user-a', 'candidate', 'MERGE_A');

  assert.deepEqual(mergeArguments, ['user-a', 'person-a', 'person-b', 'candidate']);
  assert.equal(candidateUpdates, 0);
  assert.deepEqual(result, {
    status: 'MERGED',
    keptPersonId: 'person-a',
    removedPersonId: 'person-b',
  });
});
