import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.recording.deleteMany();

  await prisma.recording.createMany({
    data: [
      {
        id: 'rec_a1b2c3d4',
        rawText: 'So the main thing I wanted to note today is that we need to set up the authentication module and make sure we handle the error cases properly when the token expires. We should also look at the refresh token mechanism. It would be great to have automatic retry logic built in.',
        summary: 'Set up authentication module with token expiry handling and automatic retry logic for refresh tokens.',
        trelloCardId: 'trello_card_001',
        trelloCardUrl: 'https://trello.com/c/ABCDEFGH/1-set-up-authentication-module',
        status: 'COMPLETED',
        durationSeconds: 42,
      },
      {
        id: 'rec_b2c3d4e5',
        rawText: 'I was thinking about the onboarding experience for new users. We should have a 3-step walkthrough that shows them how to record a voice memo, how the AI extracts the task, and then how it automatically goes to the chosen board. Maybe with some nice animations.',
        summary: 'Design a 3-step onboarding walkthrough explaining the record → extract → task workflow, with animations.',
        trelloCardId: 'trello_card_002',
        trelloCardUrl: 'https://trello.com/c/BCDEFGHI/2-design-the-onboarding-flow',
        status: 'COMPLETED',
        durationSeconds: 38,
      },
      {
        id: 'rec_c3d4e5f6',
        rawText: 'Quick note — need to write tests for the recording pipeline. Cover the STT upload endpoint, the AI extraction call, and the Trello/Jira integrations. Mock all the external APIs so the tests are fast and reliable.',
        summary: 'Write unit tests covering STT upload, AI extraction, and Trello/Jira integrations with mocked external APIs.',
        trelloCardId: 'trello_card_003',
        trelloCardUrl: 'https://trello.com/c/CDEFGHIJ/3-write-unit-tests',
        status: 'COMPLETED',
        durationSeconds: 22,
      },
    ],
  });

  console.log('✅ Seed complete — 3 recordings inserted');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
